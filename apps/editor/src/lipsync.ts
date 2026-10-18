// Lip sync for a drawn character: the words of a transcript become mouth keys
// (the nine classic visemes) written on a sequence's `drawing`, so the rig's
// drawings play while the voice speaks and close between the words.

import { mouthKeys, pointer, type ToolContext, type ToolType, type Viseme } from '@tramme/core';
import { transcriptOfDoc } from './model.ts';
import { t } from './i18n/index.ts';

/** the drawing a viseme shows, 1-based in the sequence's order */
const DEFAULT_MOUTHS: Record<Viseme, number> = { closed: 1, mbp: 2, fv: 3, ai: 4, e: 5, o: 6, u: 7, l: 8, d: 9 };

export const LIPSYNC_TOOLS: ToolType[] = [
  {
    name: 'lipsync',
    title: 'Lip sync',
    description: 'keys a drawn sequence’s drawings to the words of a transcript, so the mouth speaks on the voice',
    input: {
      type: 'object',
      properties: {
        sequence: { type: 'string', format: 'layer', layerType: 'sequence', title: 'Character' },
        transcript: { type: 'string', format: 'asset', assetType: 'json', title: 'Transcript' },
        mouths: { type: 'string', format: 'json', title: 'Mouths', description: '{"closed":1,"mbp":2,"fv":3,"ai":4,"e":5,"o":6,"u":7,"l":8,"d":9}: which drawing each mouth shape shows' },
      },
    },
    async run({ sequence: wanted, transcript, mouths }, ctx: ToolContext) {
      const c = ctx.doc.compositions[ctx.compId];
      const ok = (id: string) => c.layers[id]?.type === 'sequence';
      const id = wanted ?? ctx.selection.find(ok) ?? Object.keys(c.layers).find(ok);
      if (!id) throw new Error('the composition has no sequence layer: place the character first');
      const asset = transcript ?? transcriptOfDoc(ctx.doc);
      let words: { w: string; s: number; e: number }[] = [];
      let language: string | undefined;
      if (asset && ctx.doc.assets[asset]) {
        const text = await ctx.readText(ctx.doc.assets[asset].src);
        const raw = text ? JSON.parse(text) as unknown : null;
        words = (Array.isArray(raw) ? raw : (raw as { words?: { w: string; s: number; e: number }[] })?.words ?? []);
        language = !Array.isArray(raw) && typeof (raw as { language?: unknown })?.language === 'string' ? (raw as { language: string }).language : undefined;
      }
      if (!words.length) throw new Error('no transcript to read: transcribe the voice first (the Transcribe button, or get_transcript)');
      let mouthsOf = DEFAULT_MOUTHS;
      if (typeof mouths === 'string' && mouths.trim()) mouthsOf = { ...DEFAULT_MOUTHS, ...(JSON.parse(mouths) as Partial<Record<Viseme, number>>) };
      else if (mouths && typeof mouths === 'object') mouthsOf = { ...DEFAULT_MOUTHS, ...(mouths as Partial<Record<Viseme, number>>) };
      const l = c.layers[id], inPoint = l.in ?? 0;
      const keys = mouthKeys(words, { language }).map((k) => ({ ...k, t: k.t + inPoint, v: mouthsOf[k.v] }));
      return {
        label: t('lipsync.done', { name: l.name ?? id }),
        ops: [{ op: l.props?.drawing === undefined ? 'add' : 'replace', path: pointer('compositions', ctx.compId, 'layers', id, 'props', 'drawing'), value: { $k: keys } }],
        text: [
          `The mouth of "${l.name ?? id}" now speaks with the transcript "${asset}": ${words.length} words, ${keys.length} mouth keys on props.drawing.`,
          'The nine shapes map to the drawings in order: 1 closed (rest), 2 M/B/P, 3 F/V, 4 A/I, 5 E, 6 O, 7 U/W/Q, 8 L, 9 everything else (T, D, N, S…).',
          'Order the drawings that way (frames 1 to 9) or pass a mouths map like {"ai":2,"mbp":1}. Delete the keys on drawing to bring the exposure sheet back.',
        ].join('\n'),
      };
    },
  },
];
