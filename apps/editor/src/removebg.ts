// Removing a picture's background: the U²-Net matte (the person, or the main
// subject) becomes the alpha of a PNG saved as a new image asset, and placed
// in the composition as its own layer — titles can pass behind it.

import { pointer, type Op, type ToolContext, type ToolType } from '@tramme/core';
import { canvas, loadImage } from './perception.ts';
import { keep, matting } from './cutout.ts';
import { freshId } from './model.ts';
import { t } from './i18n/index.ts';

export const REMOVEBG_TOOLS: ToolType[] = [
  {
    name: 'remove-bg',
    title: 'Remove the background',
    description: 'cuts the background out of a picture: a PNG with transparency (the person or the main subject kept), added to the project',
    input: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'asset', assetType: 'image', title: 'Image' },
        subject: { type: 'string', enum: ['any', 'person'], title: 'Subject', description: 'the main subject, or a person only' },
        place: { type: 'boolean', title: 'Place it', description: 'add the cut picture to the composition as its own layer (yes by default)' },
      },
    },
    ai: { when: 'a picture whose background must go (a product, a person on a busy background): titles and graphics then pass behind the subject' },
    async run({ image: wanted, subject = 'any', place = true }, ctx: ToolContext) {
      const images = Object.entries(ctx.doc.assets).filter(([, a]) => a.type === 'image');
      const id = wanted ?? images.find(([aid]) => ctx.selection.includes(aid))?.[0] ?? images.at(-1)?.[0];
      if (!id) throw new Error('the project has no picture: bring one in first');
      const img = await loadImage(ctx.assetUrl(id));
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const { c, g } = canvas(iw, ih);
      g.drawImage(img, 0, 0, iw, ih);
      ctx.progress?.(1, 3, t('removebg.reading'));
      const matte = keep(await (await matting(subject))(c), null);
      ctx.progress?.(2, 3, t('removebg.reading'));
      const px = g.getImageData(0, 0, iw, ih);
      for (let i = 0; i < matte.length; i++) px.data[i * 4 + 3] = matte[i];
      g.putImageData(px, 0, 0);
      const blob = await new Promise<Blob>((done, fail) => c.toBlob((b) => (b ? done(b) : fail(new Error('the PNG could not be made'))), 'image/png'));
      const path = await ctx.writeFile(`assets/cutout/${id}.png`, blob);
      const had = !!ctx.doc.assets[`${id}-cut`];
      const nid = `${id}-cut`.slice(0, 64);
      const ops: Op[] = [{ op: had ? 'replace' : 'add', path: pointer('assets', nid), value: { type: 'image', src: path, name: ctx.doc.assets[id].name ? `${ctx.doc.assets[id].name} cut out` : nid } }];
      const comp = ctx.doc.compositions[ctx.compId];
      if (place) {
        const k = Math.min(1, (comp.width * 0.92) / iw, (comp.height * 0.92) / ih);
        const taken: Record<string, unknown> = { ...comp.layers };
        const lid = freshId(taken, nid);
        ops.push(
          { op: 'add', path: pointer('compositions', ctx.compId, 'layers', lid), value: { type: 'image', name: ctx.doc.assets[id].name ? `${ctx.doc.assets[id].name} cut out` : nid, in: ctx.time, props: { image: nid, size: [Math.round(iw * k), Math.round(ih * k)], fit: 'contain' }, transform: { position: [Math.round(comp.width / 2), Math.round(comp.height / 2)] } } },
          { op: 'replace', path: pointer('compositions', ctx.compId, 'order'), value: [...comp.order, lid] },
        );
      }
      return {
        ops, reload: had ? [nid] : [], label: t('removebg.done', { name: ctx.doc.assets[id].name ?? id }),
        text: [
          `The background of "${id}" is cut out: the subject kept, saved as the image asset "${nid}" (${iw}×${ih}, transparent elsewhere).`,
          ...(place ? [`Placed as its own layer at ${ctx.time.toFixed(2)} s, centred. Titles put under it in the stack pass behind the subject.`] : []),
          'Run it again to read the matte again (the model runs on the GPU, on the processor when it refuses). For a video, the cutout tool cuts every frame instead.',
        ].join('\n'),
        notice: t('removebg.done', { name: ctx.doc.assets[id].name ?? id }),
      };
    },
  },
];
