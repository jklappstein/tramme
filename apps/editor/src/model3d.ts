// Bringing a .glb into the composition: the file is already an asset of the
// project (joined to a message, or brought with the sources), this tool adds
// the model.3d layer that draws it, centred on the time asked.

import { pointer, type ToolContext, type ToolType } from '@tramme/core';
import { freshId, mediaAssetsOf } from './model.ts';
import { t } from './i18n/index.ts';

export const MODEL_TOOLS: ToolType[] = [
  {
    name: 'model',
    title: '3D model',
    description: 'places a .glb model (glTF 2.0) that is already an asset of the project as a model.3d layer',
    input: {
      type: 'object',
      properties: {
        asset: { type: 'string', format: 'asset', assetType: 'model', title: 'Model' },
        at: { type: 'number', title: 'At (s)' },
        duration: { type: 'number', title: 'Duration (s)' },
        height: { type: 'number', title: 'Height (px)' },
      },
    },
    run({ asset: wanted, at, duration, height }, ctx: ToolContext) {
      const assets = Object.entries(ctx.doc.assets).filter(([, a]) => a.type === 'model');
      const id = wanted ?? mediaAssetsOf(ctx.doc, ctx.compId, ctx.selection, ['model'])[0] ?? assets.at(-1)?.[0];
      if (!id) throw new Error('the project has no .glb asset: join one to a message (or bring one in) and run again');
      const c = ctx.doc.compositions[ctx.compId];
      const start = Math.max(0, Math.min(at ?? ctx.time, c.duration - 0.5));
      const dur = Math.max(0.5, Math.min(duration ?? 5, c.duration - start));
      const taken: Record<string, unknown> = { ...c.layers };
      const lid = freshId(taken, id);
      return {
        label: t('model.placed', { name: ctx.doc.assets[id].name ?? id }),
        ops: [
          { op: 'add', path: pointer('compositions', ctx.compId, 'layers', lid), value: { type: 'model.3d', name: ctx.doc.assets[id].name ?? id, in: start, out: start + dur, props: { source: id, ...(height ? { height } : {}) } } },
          { op: 'replace', path: pointer('compositions', ctx.compId, 'order'), value: [...c.order, lid] },
        ],
        text: `The model "${id}" is placed as the layer "${lid}" from ${start.toFixed(2)} s to ${(start + dur).toFixed(2)} s, centred in the frame. It turns with spin (°/s) and stands under yaw/pitch; explode drifts its parts apart, light chooses studio, sun or flat. Animate spin or explode with keys for a reveal.`,
      };
    },
  },
];
