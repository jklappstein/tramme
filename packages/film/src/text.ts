// Text set in the film's faces and brought in by a treatment: words rising
// from under their line, clearing from a blur, typed, letter by letter,
// popping in scale, a last word that keeps changing, a marker or a line drawn
// under the words that matter, lines sliding in from both sides. The block is
// fitted to its width first (smaller type, more lines). Every word stays an
// ordinary text layer.

import type { EaseSpec, Layer, Prop, Vec2 } from '@tramme/core';
import { fadeIn, keys, px, sec, tint, v2, type Ctx } from './build.ts';
import { fit, textWidth } from './metrics.ts';
import type { ROLES, SIZES, TREATMENTS } from './spec.ts';
import type { Motion } from './style.ts';

export type Role = typeof ROLES[number];
export type Treatment = typeof TREATMENTS[number];
export type Size = typeof SIZES[number];

export interface TextOpts {
  text: string;
  role?: Role;
  treatment?: Treatment;
  size?: Size;
  /** a size in px instead of the role's */
  px?: number;
  color?: string;
  align?: 'center' | 'left' | 'right';
  /** widest line, px */
  max: number;
  maxLines?: number;
  /** where the block sits: its centre (or its left edge, or its right edge) and the middle of its height */
  x: number;
  y: number;
  /** when it starts entering (scene time, s) */
  at: number;
  emphasis?: string[];
  swap?: string[];
  parent?: string;
  name?: string;
}

export interface TextBlock { id: string; size: number; lines: string[]; width: number; height: number; top: number; bottom: number; left: number; right: number; done: number }

const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}%$€£]+/gu, '');

/** the smallest type a film sets, a share of the frame's short side: what the readability check asks for on a phone */
export const MIN_TYPE = 0.031;

/** the size of a role, px: the headline follows the style's scale; nothing under the readable minimum */
export function roleSize(ctx: Ctx, role: Role, size?: Size): number {
  const u = ctx.u, phone = ctx.vertical ? 1.12 : 1;
  if (role === 'headline') return u * ({ xxl: 0.17, xl: 0.125, l: 0.092, m: 0.07, s: 0.052 }[size ?? 'l']) * ctx.style.scale;
  if (role === 'kicker') return u * MIN_TYPE * phone;
  if (role === 'caption') return u * ({ xxl: 0.046, xl: 0.04, l: 0.035, m: 0.032, s: MIN_TYPE }[size ?? 'm']) * phone;
  return u * ({ xxl: 0.062, xl: 0.052, l: 0.043, m: 0.037, s: 0.033 }[size ?? 'm']) * phone;
}

/**
 * A block fitted to its width (smaller type, more lines). A text whose last
 * word gives way to others is fitted as if the widest of them stood in its
 * place, on two lines at most, and keeps its own word.
 */
function fitText(ctx: Ctx, content: string, swaps: string[] | null, role: Role, want: number, max: number, maxLines?: number) {
  const tp = typeOf(ctx, role), o = { size: want, min: smallest(ctx, role, want), max, maxLines: swaps ? 2 : maxLines ?? (role === 'headline' ? 3 : 4), weight: tp.weight, family: tp.family, tracking: tp.tracking };
  if (!swaps) return fit(content, o);
  const text = content.trim(), own = text.split(/\s+/).at(-1) ?? '';
  const slot = [own, ...swaps].reduce((a, b) => (textWidth(b, want, tp.weight, tp.family, tp.tracking) > textWidth(a, want, tp.weight, tp.family, tp.tracking) ? b : a));
  const r = fit(text.replace(/\S+$/, slot), o);
  return { size: r.size, lines: [...r.lines.slice(0, -1), r.lines.at(-1)!.replace(/\S+$/, own)] };
}

/** how small a block may be set to fit its width: a headline to a little over half its size, the rest down to the readable minimum */
const smallest = (ctx: Ctx, role: Role, want: number) => (role === 'headline' ? want * 0.55 : Math.min(want, Math.max(want * 0.75, ctx.u * MIN_TYPE)));

/** the face, weight, tracking, line height and case of a role */
function typeOf(ctx: Ctx, role: Role) {
  const st = ctx.style;
  if (role === 'headline') return { font: ctx.fonts.display, family: ctx.fonts.family.display, weight: st.display.display, tracking: st.display.tracking, lh: st.display.lineHeight, upper: st.upper };
  if (role === 'kicker') return { font: ctx.fonts.text, family: ctx.fonts.family.text, weight: st.text.strong, tracking: 0.14, lh: 1.2, upper: true };
  return { font: ctx.fonts.text, family: ctx.fonts.family.text, weight: st.text.regular, tracking: 0, lh: 1.32, upper: false };
}

/** the widest line of a text as its role sets it at `size` px, its capitals included: what a poster fits to its width */
export function lineWidth(ctx: Ctx, text: string, role: Role, size: number): number {
  const tp = typeOf(ctx, role), content = tp.upper ? text.toUpperCase() : text;
  return Math.max(...content.split('\n').map((l) => textWidth(l, size, tp.weight, tp.family, tp.tracking)));
}

/** the line height of a role, as a share of its size */
export const lineHeightOf = (ctx: Ctx, role: Role) => typeOf(ctx, role).lh;

/** a block of text in its own group; where it landed and when it is fully in */
export function textBlock(ctx: Ctx, o: TextOpts): TextBlock {
  const role = o.role ?? 'headline', tp = typeOf(ctx, role);
  const content = tp.upper ? o.text.toUpperCase() : o.text;
  const want = o.px ?? roleSize(ctx, role, o.size);
  const treatment = o.treatment ?? (role === 'headline' ? defaultTreatment(ctx.style.motion) : 'fade');
  // the last word of the last line gives way to each swap word in turn, its slot as wide as the longest of them
  const swaps = treatment === 'swap' && o.swap?.length ? o.swap.map((w) => (tp.upper ? w.toUpperCase() : w)) : null;
  const { size, lines } = fitText(ctx, content, swaps, role, want, o.max, o.maxLines);
  if (role === 'headline' && o.px === undefined && size < want * 0.8) ctx.notes.push(`"${o.text.replace(/\s+/g, ' ').slice(0, 32)}" set at ${Math.round((size / want) * 100)}% of its size to fit: fewer words, or a smaller size on purpose`);
  const lh = size * tp.lh;
  const align = o.align ?? 'center';
  const color = o.color ?? (role === 'kicker' || role === 'caption' ? '@ink2' : role === 'body' ? '@ink2' : '@ink');
  const space = textWidth(' ', size, tp.weight, tp.family, tp.tracking) + tp.tracking * size;
  const w = (s: string) => textWidth(s, size, tp.weight, tp.family, tp.tracking);
  const emph = new Set((o.emphasis ?? []).flatMap((e) => e.split(/\s+/)).map(bare).filter(Boolean));
  const base = { font: tp.font, size: px(size), weight: tp.weight, tracking: tp.tracking, baseline: 'middle' };
  const st = ctx.style, pace = st.pace, stagger = st.stagger;
  const widths = lines.map((l) => w(l));
  let width = Math.max(...widths), done = o.at;
  const lastLine = lines.length - 1, own = swaps ? lines[lastLine].split(' ').at(-1)! : '';
  if (swaps) width = Math.max(width, w(lines[lastLine].split(' ').slice(0, -1).join(' ')) + (lines[lastLine].includes(' ') ? space : 0) + Math.max(w(own), ...swaps.map(w)));
  const height = lh * lines.length;
  const lineX = (lw: number) => (align === 'center' ? -lw / 2 : align === 'right' ? -lw : 0);

  const id = ctx.c.group(o.name ?? lines.join(' ').slice(0, 28), { transform: { position: v2(o.x, o.y) } }, (g) => {
    const maskOf = (li: number, x0: number, lw: number) => {
      const y = (li - (lines.length - 1) / 2) * lh;
      const m = ctx.c.add(`mask-${li + 1}`, { type: 'shape.rect', visible: false, transform: { position: v2(x0 + lw / 2, y) }, props: { size: v2(lw + size * 0.8, lh * 1.12), fill: '#FFFFFF' } }, g);
      return ctx.c.group(`line-${li + 1}`, { clip: m }, () => {}, g);
    };
    /** a word (or a line) entering at t, by the treatment */
    const enter = (t: number, at: [number, number], dir = 1): Pick<Layer, 'transform' | 'effects'> => {
      done = Math.max(done, t + pace + 0.1);
      switch (treatment) {
        case 'mask': case 'swap': case 'highlight': case 'underline':
          return { transform: { position: keys([t, v2(at[0], at[1] + lh * 0.6 + size * 0.75), '@enter'], [t + pace * 1.1, v2(...at)]) } };
        case 'scale':
          return { transform: { position: v2(...at), scale: keys([t, [0.35, 0.35], '@pop'], [t + pace, [1, 1]]), opacity: fadeIn(t, pace * 0.4) } };
        case 'split':
          return { transform: { position: keys([t, v2(at[0] + dir * ctx.W * 0.22, at[1]), '@enter'], [t + pace * 1.2, v2(...at)]), opacity: fadeIn(t, pace * 0.5) }, effects: [{ id: 'blur', type: 'fx.blur', props: { radius: keys([t, px(size * 0.25), '@enter'], [t + pace, 0]) } }] };
        case 'fade':
          return { transform: { position: keys([t, v2(at[0], at[1] + size * 0.15), '@enter'], [t + pace, v2(...at)]), opacity: fadeIn(t, pace * 0.8) } };
        case 'letters':
          return { transform: { position: keys([t, v2(at[0], at[1] + size * 0.45), '@pop'], [t + pace * 0.8, v2(...at)]), opacity: fadeIn(t, pace * 0.3) } };
        default: // blur
          return {
            transform: { position: keys([t, v2(at[0], at[1] + size * 0.24), '@enter'], [t + pace, v2(...at)]), opacity: fadeIn(t, pace * 0.65) },
            effects: [{ id: 'blur', type: 'fx.blur', props: { radius: keys([t, px(size * Math.max(0.12, st.blur)), '@enter'], [t + pace * 0.85, 0]) } }],
          };
      }
    };
    const masked = treatment === 'mask' || treatment === 'swap' || treatment === 'highlight' || treatment === 'underline';
    let unit = 0;
    if (treatment === 'type') {
      // typed line after line, a caret after the last character typed
      const rate = st.motion === 'dreamy' ? 14 : st.motion === 'snappy' || st.motion === 'mechanical' ? 32 : 22;
      let t = o.at;
      lines.forEach((line, li) => {
        const y = (li - (lines.length - 1) / 2) * lh, x0 = lineX(widths[li]), t0 = t, t1 = t0 + line.length / rate;
        ctx.c.add(line.slice(0, 24) || 'line', { type: 'text', name: line, transform: { position: v2(x0, y), opacity: keys([t0 - 0.01, 0, 'hold'], [t0, 1]) }, props: { ...base, text: { $expr: `${JSON.stringify(line)}.slice(0, Math.max(0, Math.floor((t - ${sec(t0)}) * ${rate})))` }, align: 'left', color } }, g);
        ctx.c.add('caret', { type: 'shape.rect', in: sec(t0), out: sec(li === lines.length - 1 ? ctx.dur : t1 + 0.05), transform: { position: keys([t0, v2(x0 + size * 0.06, y)], [t1, v2(x0 + widths[li] + size * 0.08, y)]), opacity: { $expr: 'Math.floor(t * 2.6) % 2 ? 0.2 : 1' } }, props: { size: v2(Math.max(2, size * 0.06), size * 0.95), fill: '@accent' } }, g);
        t = t1 + 0.08;
      });
      done = t;
    } else if (treatment === 'letters' && content.replace(/\s/g, '').length <= 48) {
      lines.forEach((line, li) => {
        const y = (li - (lines.length - 1) / 2) * lh;
        let x = lineX(widths[li]);
        for (const ch of line) {
          const cw = w(ch) + tp.tracking * size;
          if (ch !== ' ') ctx.c.add(ch === '.' ? 'dot' : ch, { type: 'text', name: ch, ...enter(sec(o.at + unit++ * Math.min(stagger, 0.035)), [x, y]), props: { ...base, text: ch, align: 'left', color } }, g);
          x += cw;
        }
      });
    } else {
      const byLine = role !== 'headline' && !swaps;
      lines.forEach((line, li) => {
        const y = (li - (lines.length - 1) / 2) * lh, lw = swaps && li === lastLine ? width : widths[li], x0 = lineX(lw);
        const parent = masked ? maskOf(li, x0, lw) : g;
        const dir = li % 2 ? -1 : 1;
        if (byLine) { ctx.c.add(line.slice(0, 24), { type: 'text', name: line, ...enter(sec(o.at + unit++ * stagger * 2), [x0, y], dir), props: { ...base, text: line, align: 'left', color } }, parent); return; }
        const words = line.split(' '), last = swaps && li === lastLine ? words.pop() : undefined;
        let x = x0;
        for (const word of words) {
          const hot = emph.has(bare(word));
          ctx.c.add(word, { type: 'text', name: word, ...enter(sec(o.at + unit++ * stagger * (treatment === 'split' ? 0 : 1)), [x, y], dir), props: { ...base, text: word, align: 'left', color: hot && treatment !== 'highlight' ? '@accent' : color } }, parent);
          x += w(word) + space;
        }
        if (swaps && last !== undefined) swapWord(ctx, { swaps: [last, ...swaps], x, y, size, lh, base, color, at: sec(o.at + unit * stagger), parent: g, width: Math.max(w(last), ...swaps.map(w)) });
      });
    }
    // a highlighted word stays in the ink, the marker behind it carries the accent
    if (treatment === 'highlight' || treatment === 'underline') marks(ctx, { lines, widths, lineX, lh, size, w, space, emph, treatment, at: done + 0.1, parent: g, upper: tp.upper });
  }, o.parent);
  const left = align === 'center' ? o.x - width / 2 : align === 'right' ? o.x - width : o.x;
  return { id, size, lines, width, height, top: o.y - height / 2, bottom: o.y + height / 2, left, right: left + width, done: sec(done) };
}

/** what headlines do when the scene does not say: the motion's own way */
export function defaultTreatment(motion: Motion): Treatment {
  return ({ snappy: 'mask', smooth: 'blur', elastic: 'scale', mechanical: 'mask', dreamy: 'blur' } as const)[motion];
}

/** the last word of a line, then each swap word in its place in turn, the last one staying */
function swapWord(ctx: Ctx, o: { swaps: string[]; x: number; y: number; size: number; lh: number; base: Record<string, unknown>; color: string; at: number; parent: string; width: number }) {
  const n = o.swaps.length, span = Math.max(0.6, (ctx.dur - o.at - 0.6) / n);
  const m = ctx.c.add('swap-mask', { type: 'shape.rect', visible: false, transform: { position: v2(o.x + o.width / 2, o.y) }, props: { size: v2(o.width + o.size * 0.6, o.lh * 1.12), fill: '#FFFFFF' } }, o.parent);
  ctx.c.group('swap', { clip: m }, (g) => {
    // like the drum of a slot machine: the word leaving and the one arriving move together, a line apart, on the same curve (one that never overshoots its slot)
    const off = o.lh * 1.1, d = Math.min(0.5, Math.max(0.3, ctx.style.pace * 0.8)), drum: EaseSpec = [0.7, 0, 0.3, 1];
    o.swaps.forEach((word, k) => {
      const t0 = sec(o.at + k * span), t1 = sec(t0 + span), last = k === n - 1;
      const frames: [number, Vec2, EaseSpec?][] = k === 0 ? [[t0, v2(o.x, o.y + off), '@enter'], [t0 + ctx.style.pace, v2(o.x, o.y)]] : [[t0, v2(o.x, o.y + off), drum], [t0 + d, v2(o.x, o.y)]];
      if (!last) frames.push([t1, v2(o.x, o.y), drum], [t1 + d, v2(o.x, o.y - off)]);
      ctx.c.add(word, { type: 'text', name: word, transform: { position: keys<Vec2>(...frames) }, props: { ...o.base, text: word, align: 'left', color: '@accent' } }, g);
    });
  }, o.parent);
}

/** a marker swept behind the words that matter, or a line drawn under them */
function marks(ctx: Ctx, o: { lines: string[]; widths: number[]; lineX: (w: number) => number; lh: number; size: number; w: (s: string) => number; space: number; emph: Set<string>; treatment: Treatment; at: number; parent: string; upper: boolean }) {
  const spans: { x: number; y: number; w: number }[] = [];
  o.lines.forEach((line, li) => {
    const y = (li - (o.lines.length - 1) / 2) * o.lh;
    let x = o.lineX(o.widths[li]);
    for (const word of line.split(' ')) {
      const ww = o.w(word);
      // the mark covers the word, not the punctuation after it
      if (o.emph.has(bare(word))) spans.push({ x, y, w: o.w(word.replace(/[.,;:!?…)\]»”"']+$/u, '')) });
      x += ww + o.space;
    }
  });
  // nothing named: the last line carries the mark
  if (!spans.length) { const li = o.lines.length - 1; spans.push({ x: o.lineX(o.widths[li]), y: (li - (o.lines.length - 1) / 2) * o.lh, w: o.widths[li] }); }
  spans.forEach((sp, k) => {
    const t = sec(o.at + k * 0.12), h = o.treatment === 'highlight' ? o.size * 1.02 : Math.max(2, o.size * 0.07);
    const y = o.treatment === 'highlight' ? sp.y : sp.y + o.size * 0.56;
    ctx.c.add(o.treatment, {
      type: 'shape.rect', blend: o.treatment === 'underline' ? 'normal' : ctx.style.mode === 'dark' ? 'screen' : 'multiply',
      transform: { anchor: v2(-(sp.w + o.size * 0.2) / 2, 0), position: v2(sp.x - o.size * 0.1, y), scale: keys([t, [0, 1], '@emphasized'], [t + ctx.style.pace * 1.1, [1, 1]]) },
      props: { size: v2(sp.w + o.size * 0.2, h), radius: px(o.treatment === 'highlight' ? o.size * 0.08 : h / 2), fill: o.treatment === 'highlight' ? tint(ctx, '@accent', ctx.style.mode === 'dark' ? 0.55 : 0.32) : '@accent' },
    }, o.parent);
  });
}

/**
 * A figure: a counter rolling up from zeros when it has digits (its origin on
 * the baseline), plain text otherwise. Gives its type, its props and how far
 * below the middle of the type its origin sits (add it to the y of the middle).
 */
export function figure(value: string, size: number, progress: Prop<number>, turns = 1): { type: string; props: Record<string, unknown>; dy: number } {
  if (!/\d/.test(value)) return { type: 'text', props: { text: value, baseline: 'middle' }, dy: 0 };
  return { type: 'text.counter', props: { from: value.replace(/\d/g, '0'), to: value, progress, turns }, dy: px(size * 0.36) };
}

/** how tall a block of text will stand, before it is laid (for the layouts) */
export function textHeight(ctx: Ctx, o: { text: string; role?: Role; size?: Size; px?: number; max: number; maxLines?: number; swap?: string[] }): number {
  const role = o.role ?? 'headline', tp = typeOf(ctx, role), want = o.px ?? roleSize(ctx, role, o.size);
  const content = tp.upper ? o.text.toUpperCase() : o.text, swaps = o.swap?.length ? o.swap.map((w) => (tp.upper ? w.toUpperCase() : w)) : null;
  const { size, lines } = fitText(ctx, content, swaps, role, want, o.max, o.maxLines);
  return size * tp.lh * lines.length;
}
