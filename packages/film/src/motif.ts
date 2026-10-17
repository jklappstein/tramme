// The film's motif: one shape that comes back (bars like frames going by, a
// circle, a square, a line, a dot, a frame, a plus, the logo itself), drawn
// at any size, filled or outlined. The backgrounds scatter it, the passes
// between scenes sweep it across the frame, the motif element makes an image
// of it: the signature a viewer remembers.

import type { Layer } from '@tramme/core';
import { px, v2, type Ctx } from './build.ts';
import type { Motif } from './style.ts';

/** the motif as one layer (a group for the bars), `size` px wide, centred at the origin of its transform: in a scene, or in the film itself */
export function motifLayer(ctx: Pick<Ctx, 'c' | 'film'>, motif: Motif, o: { size: number; color: string; outline?: boolean; transform?: Layer['transform']; name?: string; blend?: Layer['blend']; effects?: Layer['effects'] }, parent?: string): string {
  const s = o.size, stroke = o.outline ? { fill: null, stroke: o.color, strokeWidth: px(Math.max(2, s * 0.05)) } : { fill: o.color };
  const base = { name: o.name ?? `Motif · ${motif}`, transform: o.transform, ...(o.blend ? { blend: o.blend } : {}), ...(o.effects ? { effects: o.effects } : {}) };
  switch (motif) {
    case 'circle': case 'dot':
      return ctx.c.add('motif', { ...base, type: 'shape.ellipse', props: { size: v2(motif === 'dot' ? s * 0.35 : s, motif === 'dot' ? s * 0.35 : s), ...stroke } }, parent);
    case 'square': case 'frame':
      return ctx.c.add('motif', { ...base, type: 'shape.rect', props: { size: v2(s, s), radius: px(motif === 'frame' ? s * 0.18 : s * 0.06), ...(motif === 'frame' ? { fill: null, stroke: o.color, strokeWidth: px(Math.max(2, s * 0.07)) } : stroke) } }, parent);
    case 'line':
      return ctx.c.add('motif', { ...base, type: 'shape.rect', props: { size: v2(s, Math.max(2, s * 0.06)), radius: px(s * 0.03), fill: o.color } }, parent);
    case 'plus':
      return ctx.c.group('motif', base, (g) => {
        ctx.c.add('bar', { type: 'shape.rect', props: { size: v2(s, s * 0.22), radius: px(s * 0.05), ...stroke } }, g);
        ctx.c.add('bar', { type: 'shape.rect', props: { size: v2(s * 0.22, s), radius: px(s * 0.05), ...stroke } }, g);
      }, parent);
    case 'logo':
      if (ctx.film.brand.logo) return ctx.c.add('motif', { ...base, type: 'image', props: { image: ctx.film.brand.logo, size: v2(s, s), fit: 'contain' } }, parent);
      return motifLayer(ctx, 'square', o, parent);
    default:
      // bars: frames going by, each a little shorter and fainter, like images of a film
      return ctx.c.group('motif', base, (g) => {
        [1, 0.72, 0.52].forEach((k, i) => ctx.c.add('bar', { type: 'shape.rect', transform: { position: v2(s * (0.5 - k) * 0.5 + i * s * 0.06, (i - 1) * s * 0.3), opacity: [1, 0.7, 0.42][i] }, props: { size: v2(s * k, s * 0.22), radius: px(s * 0.07), ...stroke } }, g));
      }, parent);
  }
}
