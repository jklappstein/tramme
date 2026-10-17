// The things a scene shows besides its words, each drawn into the box the
// layout gives it and brought in the way the film moves: a figure rolling up,
// a chart drawing itself, an interface, a phone or a browser holding one,
// code being written, the logo, a list building up, cards, a quote, a button
// pressed, a picture, the motif as an image of its own. Each says how tall it
// wants to be for a width, so the layouts can share the frame.

import type { EaseSpec, Layer, Vec2 } from '@tramme/core';
import { glowDisc } from './backgrounds.ts';
import { fadeIn, grow, keys, px, sec, tint, tokenHex, v2, type Ctx } from './build.ts';
import { icon, ICONS } from './icons.ts';
import { textWidth, wrap } from './metrics.ts';
import { motifLayer } from './motif.ts';
import type { ElementSpec } from './spec.ts';
import { figure as figureProps, MIN_TYPE, roleSize, textBlock, textHeight } from './text.ts';
import { avatar, card, label, lineChart, panel, panelHeight, str, tone, type UiSpec } from './ui.ts';

/** a box: its centre and its size */
export interface Box { x: number; y: number; w: number; h: number }
export type Align = 'left' | 'center' | 'right';

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? v as T[] : []);

/** how an element enters, by the film's motion: rising, sliding, popping, clearing */
export function appear(ctx: Ctx, at: number, from: Vec2): Pick<Layer, 'transform' | 'effects'> {
  const { u, W } = ctx, pace = ctx.style.pace;
  switch (ctx.style.motion) {
    case 'snappy': case 'mechanical':
      return { transform: { position: keys([at, v2(from[0] + W * 0.03, from[1]), '@enter'], [at + pace * 1.2, v2(...from)]), opacity: fadeIn(at, pace * 0.5) } };
    case 'elastic':
      return { transform: { position: v2(...from), scale: grow(at, 0.82, 1, pace * 1.3, '@pop'), opacity: fadeIn(at, pace * 0.4) } };
    case 'dreamy':
      return { transform: { position: keys([at, v2(from[0], from[1] + u * 0.03), '@enter'], [at + pace, v2(...from)]), opacity: fadeIn(at, pace) }, effects: [{ id: 'blur', type: 'fx.blur', props: { radius: keys([at, px(u * 0.02), '@enter'], [at + pace, 0]) } }] };
    default:
      return { transform: { position: keys([at, v2(from[0], from[1] + u * 0.045), '@enter'], [at + pace * 1.15, v2(...from)]), scale: grow(at, 0.97, 1, pace * 1.15), opacity: fadeIn(at, pace * 0.6) } };
  }
}

/** the x of a block `w` wide in a box, by alignment (its centre) */
export const along = (box: Box, w: number, align: Align) => (align === 'left' ? box.x - box.w / 2 + w / 2 : align === 'right' ? box.x + box.w / 2 - w / 2 : box.x);

/** where text aligned `align` is anchored in a box: its left edge, its right edge or its middle */
export const anchorX = (box: Box, align: Align) => along(box, 0, align);

/** light at a reveal: a glow that blooms and fades, a ring that widens */
function burst(ctx: Ctx, x: number, y: number, at: number) {
  const { u } = ctx, dark = ctx.style.mode === 'dark';
  ctx.c.add('flash', { ...glowDisc('Flash', tokenHex(ctx, '@glow'), { x, y, w: u * 0.9, h: u * 0.9, a: dark ? 0.8 : 0.33, blend: dark ? 'add' : 'normal' }), transform: { position: v2(x, y), scale: keys([at, [0.2, 0.2], '@enter'], [at + 1.4, [1.5, 1.5]]), opacity: keys([at, 0, '@enter'], [at + 0.25, 1, '@standard'], [at + 1.6, 0.35]) } });
  ctx.c.add('ring', { type: 'shape.ellipse', name: 'Ring', blend: dark ? 'add' : 'normal', transform: { position: v2(x, y), scale: keys([at + 0.1, [0.3, 0.3], '@enter'], [at + 1.3, [1.35, 1.35]]), opacity: keys([at + 0.1, 0.9, '@standard'], [at + 1.3, 0]) }, props: { size: v2(u * 0.5, u * 0.5), fill: null, stroke: tint(ctx, '@accent2', 0.8), strokeWidth: px(u * 0.003) } });
}

/** a mark for a brand without a logo picture: its initial on a rounded square of the accents */
export function monogram(ctx: Ctx, name: string, size: number, parent: string) {
  const dark = ctx.style.mode === 'dark';
  ctx.c.add('tile', { type: 'shape.rect', props: { size: v2(size, size), radius: px(size * (ctx.style.radius > 0.03 ? 0.32 : ctx.style.radius < 0.01 ? 0.08 : 0.24)), fill: { type: 'linear', from: [px(-size / 2), px(-size / 2)], to: [px(size / 2), px(size / 2)], stops: [[0, '@accent2'], [1, '@accent']] } }, effects: dark ? [{ id: 'glow', type: 'fx.glow', props: { color: tint(ctx, '@accent', 0.6), radius: px(size * 0.25), strength: 1 } }] : [{ id: 'shadow', type: 'fx.shadow', props: { color: tint(ctx, '@ink', 0.18), blur: px(size * 0.25), offset: [0, px(size * 0.08)] } }] }, parent);
  ctx.c.add('initial', { type: 'text', props: { text: (name.trim()[0] ?? 'T').toUpperCase(), font: ctx.fonts.display, size: px(size * 0.58), weight: ctx.style.display.strong, color: dark ? '@plate' : '#FFFFFF', align: 'center', baseline: 'middle', tracking: ctx.style.display.tracking } }, parent);
}

// ── the elements ─────────────────────────────────────────────

type Render = (ctx: Ctx, el: ElementSpec, box: Box, at: number, align: Align) => number;
type Natural = (ctx: Ctx, el: ElementSpec, w: number) => number;

const figure: [Render, Natural] = [
  (ctx, el, box, at, align) => {
    const { u } = ctx, value = str(el.value), dark = ctx.style.mode === 'dark';
    const size = Math.min(u * 0.26 * ctx.style.scale, box.w / Math.max(1.5, value.length * 0.6), box.h * 0.6);
    const roll = Math.min(1.6, Math.max(0.8, ctx.dur * 0.35)), lands = at + roll;
    const lh = el.label ? textHeight(ctx, { text: str(el.label), role: 'body', size: 'l', max: box.w, maxLines: 2 }) : 0;
    const ch = el.context ? textHeight(ctx, { text: str(el.context), role: 'caption', max: box.w, maxLines: 2 }) : 0;
    const total = size + (lh ? lh + u * 0.025 : 0) + (ch ? ch + u * 0.02 : 0);
    const top = box.y - total / 2, cx = along(box, Math.min(box.w, textWidth(value, size, ctx.style.display.strong, ctx.fonts.family.display)), align);
    const fy = top + size / 2;
    ctx.c.add('halo', { ...glowDisc('Halo', tokenHex(ctx, '@glow'), { x: cx, y: fy, w: size * 3.4, h: size * 3.4, a: dark ? 0.5 : 0.25, blend: dark ? 'add' : 'normal' }), transform: { position: v2(cx, fy), scale: keys([lands - 0.2, [0.8, 0.8], '@enter'], [lands + 0.6, [1.15, 1.15]]), opacity: keys([at, 0.15], [lands - 0.1, 0.5, '@enter'], [lands + 0.15, 1, '@standard'], [lands + 1.2, 0.55]) } });
    const f = figureProps(value, size, keys([at, 0, '@emphasized'], [lands, 1]));
    const tx = anchorX(box, align);
    ctx.c.add('figure', {
      type: f.type, name: value,
      transform: { position: keys([at, v2(tx, fy + f.dy + size * 0.12), '@enter'], [at + 0.7, v2(tx, fy + f.dy)]), opacity: fadeIn(at, 0.35), scale: keys([lands - 0.05, [1, 1], '@standard'], [lands + 0.12, [1.04, 1.04], '@pop'], [lands + 0.5, [1, 1]]) },
      props: { ...f.props, font: ctx.fonts.display, size: px(size), weight: ctx.style.display.strong, tracking: ctx.style.display.tracking, align, color: { type: 'linear', from: [0, px(-f.dy - size * 0.45)], to: [0, px(-f.dy + size * 0.45)], stops: [[0, '@ink'], [1, dark ? '@accent2' : '@accent']] } },
    });
    ctx.cues.push({ t: lands, kind: 'tick' });
    let y = top + size + u * 0.025;
    if (el.label) { textBlock(ctx, { text: str(el.label), role: 'body', size: 'l', color: '@ink', max: box.w, maxLines: 2, x: tx, y: y + lh / 2, at: at + roll * 0.5, align, treatment: 'fade' }); y += lh + u * 0.02; }
    if (el.context) textBlock(ctx, { text: str(el.context), role: 'caption', max: box.w, maxLines: 2, x: tx, y: y + ch / 2, at: lands + 0.2, align, treatment: 'fade' });
    return lands + 0.5;
  },
  (ctx, el, w) => {
    const value = str(el.value), size = Math.min(ctx.u * 0.26 * ctx.style.scale, w / Math.max(1.5, value.length * 0.6));
    return size * 1.05 + (el.label ? textHeight(ctx, { text: str(el.label), role: 'body', size: 'l', max: w, maxLines: 2 }) + ctx.u * 0.025 : 0) + (el.context ? textHeight(ctx, { text: str(el.context), role: 'caption', max: w, maxLines: 2 }) + ctx.u * 0.02 : 0);
  },
];

const chart: [Render, Natural] = [
  (ctx, el, box, at) => {
    const { u, dur } = ctx, data = list<number>(el.data).filter((x) => typeof x === 'number'), kind = str(el.kind, 'line');
    const head = el.value || el.title ? u * (el.value ? 0.13 : 0.06) : 0;
    const plot = { x: box.x, y: box.y + head / 2, w: box.w, h: box.h - head };
    const left = box.x - box.w / 2, top = box.y - box.h / 2;
    if (el.title) label(ctx, str(el.title).toUpperCase(), { x: left, y: top + u * 0.015, size: u * MIN_TYPE, weight: ctx.style.text.strong, color: '@ink2', max: box.w, parent: ctx.c.group('chart-title', { transform: { opacity: fadeIn(at, 0.4) } }, () => {}) });
    if (el.value) {
      const v = str(el.value), vs = u * 0.07, f = figureProps(v, vs, keys([at + 0.1, 0, '@emphasized'], [at + 0.1 + Math.max(1.4, dur * 0.55), 1]));
      const vy = top + (el.title ? u * 0.075 : u * 0.04);
      ctx.c.add('headline', { type: f.type, name: v, transform: { position: v2(left, vy + f.dy), opacity: fadeIn(at, 0.4) }, props: { ...f.props, font: ctx.fonts.display, size: px(vs), weight: ctx.style.display.strong, tracking: ctx.style.display.tracking, align: 'left', color: '@ink' } });
      if (el.delta) {
        const dv = str(el.delta), dw = textWidth(dv, u * MIN_TYPE, ctx.style.text.strong, ctx.fonts.family.text) + u * 0.035, vw = textWidth(v, vs, ctx.style.display.strong, ctx.fonts.family.display, ctx.style.display.tracking);
        ctx.c.group('delta', { transform: { position: v2(left + vw + u * 0.03 + dw / 2, vy), opacity: fadeIn(at + 0.8, 0.4), scale: grow(at + 0.8, 0.8, 1, 0.5, '@pop') } }, (g) => {
          ctx.c.add('pill', { type: 'shape.rect', props: { size: v2(dw, u * 0.042), radius: px(u * 0.021), fill: tint(ctx, tone(dv), 0.16) } }, g);
          ctx.c.add('text', { type: 'text', props: { text: dv, font: ctx.fonts.text, size: px(u * MIN_TYPE), weight: ctx.style.text.strong, color: tone(dv), align: 'center', baseline: 'middle' } }, g);
        });
      }
    }
    if (kind === 'bars') return bars(ctx, data, list<string>(el.labels), plot, at);
    if (kind === 'candles') return candles(ctx, data, plot, at);
    const d = Math.max(1.4, dur * 0.6);
    lineChart(ctx, data, { x: plot.x, y: plot.y, w: plot.w, h: plot.h, at: at + 0.15, d });
    return at + 0.15 + d;
  },
  (ctx, el, w) => w * (str(el.kind) === 'bars' ? 0.5 : 0.48) + (el.value ? ctx.u * 0.13 : el.title ? ctx.u * 0.06 : 0),
];

function bars(ctx: Ctx, data: number[], labels: string[], box: Box, at: number): number {
  const { u } = ctx, n = Math.max(1, data.length), slot = box.w / n, bw = slot * 0.58, hi = Math.max(...data, 1e-9), best = data.indexOf(Math.max(...data));
  const left = box.x - box.w / 2, base = box.y + box.h / 2 - (labels.length ? u * 0.05 : 0), room = box.h - (labels.length ? u * 0.05 : 0) - u * 0.06;
  ctx.c.add('axis', { type: 'shape.rect', transform: { position: v2(box.x, base), scale: keys([at, [0, 1], '@enter'], [at + 0.6, [1, 1]]) }, props: { size: v2(box.w, Math.max(1, u * 0.0016)), fill: '@line' } });
  let end = at;
  data.forEach((v, i) => {
    const h = Math.max(u * 0.004, (Math.max(0, v) / hi) * room), x = left + slot * (i + 0.5), t = at + 0.25 + i * Math.max(0.08, ctx.style.stagger * 1.6);
    ctx.c.add(`bar-${i + 1}`, { type: 'shape.rect', transform: { anchor: v2(0, h / 2), position: v2(x, base), scale: keys([t, [1, 0], '@emphasized'], [t + 0.9, [1, 1]]) }, props: { size: v2(bw, h), radius: px(Math.min(bw * 0.12, u * ctx.style.radius * 0.6)), fill: i === best ? { type: 'linear', from: [0, px(-h / 2)], to: [0, px(h / 2)], stops: [[0, '@accent2'], [1, '@accent']] } : tint(ctx, '@ink', ctx.style.mode === 'dark' ? 0.16 : 0.13) } });
    const shown = Number.isInteger(v) ? String(v) : v.toFixed(1), f = figureProps(shown, u * MIN_TYPE, keys([t, 0, '@emphasized'], [t + 0.9, 1]), 0);
    ctx.c.add(`value-${i + 1}`, { type: f.type, name: shown, transform: { position: keys([t, v2(x, base - u * 0.035), '@emphasized'], [t + 0.9, v2(x, base - h - u * 0.035)]), opacity: fadeIn(t, 0.3) }, props: { ...f.props, font: ctx.fonts.text, size: px(u * MIN_TYPE), weight: ctx.style.text.strong, align: 'center', color: i === best ? '@ink' : '@ink2' } });
    if (labels[i]) ctx.c.add(`label-${i + 1}`, { type: 'text', name: labels[i], transform: { position: v2(x, base + u * 0.035), opacity: fadeIn(t, 0.4) }, props: { text: labels[i], font: ctx.fonts.text, size: px(u * MIN_TYPE), weight: ctx.style.text.regular, color: '@ink2', align: 'center', baseline: 'middle' } });
    end = t + 0.9;
  });
  return end;
}

/** candles of a market from closing values: each opens where the last closed, appearing one by one, the market scrolling to keep the last in view */
function candles(ctx: Ctx, closes: number[], box: Box, at: number): number {
  const { u, dur } = ctx, n = closes.length;
  const bars = closes.map((c, i) => { const o = i ? closes[i - 1] : c * 0.995; const span = Math.abs(c - o) || Math.abs(c) * 0.01; return { o, c, h: Math.max(o, c) + span * (0.2 + ctx.rand() * 0.6), l: Math.min(o, c) - span * (0.2 + ctx.rand() * 0.6) }; });
  const lo = Math.min(...bars.map((b) => b.l)), hi = Math.max(...bars.map((b) => b.h)), span = hi - lo || 1;
  const left = box.x - box.w / 2, top = box.y - box.h / 2, y = (v: number) => top + box.h - ((v - lo) / span) * box.h;
  const visible = Math.min(n, 18), slot = box.w / visible, bw = Math.max(u * 0.006, slot * 0.62), t0 = at + 0.1, each = Math.max(0.04, (dur * 0.72) / n);
  for (let k = 0; k < 4; k++) ctx.c.add('gridline', { type: 'shape.rect', transform: { position: v2(box.x, top + (box.h * (k + 0.5)) / 4), opacity: fadeIn(at, 0.5) }, props: { size: v2(box.w, Math.max(1, u * 0.0012)), fill: '@line' } });
  const shift = (i: number) => Math.max(0, (i + 0.5) * slot - box.w * 0.82);
  const steps: [number, Vec2, EaseSpec?][] = [[0, v2(0, 0), '@standard']];
  bars.forEach((_, i) => { if (shift(i) > 0) steps.push([t0 + i * each, v2(-shift(i), 0), '@standard']); });
  const mask = ctx.c.add('market-mask', { type: 'shape.rect', visible: false, transform: { position: v2(box.x, box.y) }, props: { size: v2(box.w + u * 0.02, box.h + u * 0.1), fill: '#FFFFFF' } });
  ctx.c.group('market', { name: 'Market', clip: mask, transform: { position: steps.length > 1 ? keys<Vec2>(...steps) : v2(0, 0) } }, (m) => {
    bars.forEach((b, i) => {
      const x = left + slot * (i + 0.5), t = t0 + i * each, col = b.c >= b.o ? '@good' : '@bad';
      const bodyH = Math.max(u * 0.003, Math.abs(y(b.o) - y(b.c))), bodyY = (y(b.o) + y(b.c)) / 2;
      ctx.c.group(`candle-${i + 1}`, { transform: { position: v2(x, bodyY), scale: keys([t, [1, 0.2], '@enter'], [t + 0.35, [1, 1]]), opacity: fadeIn(t, 0.15) } }, (g) => {
        ctx.c.add('wick', { type: 'shape.rect', transform: { position: v2(0, (y(b.h) + y(b.l)) / 2 - bodyY) }, props: { size: v2(Math.max(1, bw * 0.16), y(b.l) - y(b.h)), fill: col } }, g);
        ctx.c.add('body', { type: 'shape.rect', props: { size: v2(bw, bodyH), radius: px(Math.min(bw * 0.12, u * 0.004)), fill: col } }, g);
      }, m);
    });
  });
  const last = bars[n - 1];
  ctx.c.add('price', { type: 'shape.rect', transform: { position: keys(...bars.map((b, i) => [t0 + i * each + 0.3, v2(box.x, y(b.c))] as [number, Vec2])), opacity: keys([t0, 0], [t0 + 0.3, 0.7]) }, props: { size: v2(box.w, Math.max(1, u * 0.0012)), fill: last.c >= last.o ? '@good' : '@bad' } });
  return t0 + n * each;
}

const ui: [Render, Natural] = [
  (ctx, el, box, at) => {
    const spec = (el.ui ?? { items: [] }) as UiSpec, k = ctx.vertical ? 1.45 : 1.2;
    const w = Math.min(box.w, ctx.u * 1.15) / k;
    return panel(ctx, spec, { x: box.x, y: box.y, w, at, scale: k, maxHeight: box.h }).done;
  },
  (ctx, el, w) => { const k = ctx.vertical ? 1.45 : 1.2; return panelHeight(ctx, (el.ui ?? { items: [] }) as UiSpec, Math.min(w, ctx.u * 1.15) / k) * k; },
];

/** how tall a device stands for a width: a phone keeps its shape, a browser or a window follows what it shows */
function deviceHeight(ctx: Ctx, el: ElementSpec, w: number): number {
  if (str(el.device, 'browser') === 'phone') return w * 2.05;
  if (!el.ui) return w * 0.62;
  // as tall as its interface needs, up to square: a window that cuts its interface down makes it unreadable
  const s = screenScale(ctx, w);
  return Math.max(w * 0.42, Math.min(w * 1.05, panelHeight(ctx, el.ui as UiSpec, (w * 0.86) / s) * s + ctx.u * 0.125));
}

/** how much larger an interface is drawn in a browser or a window `w` wide: a window filling the frame shows it large, not lost in the middle */
const screenScale = (ctx: Ctx, w: number) => Math.max(1.2, Math.min(1.5, (w * 0.86) / ctx.u));

const device: [Render, Natural] = [
  (ctx, el, box, at, align) => {
    const kind = str(el.device, 'browser'), { u } = ctx, phone = kind === 'phone';
    let w = box.w, h = deviceHeight(ctx, el, w);
    if (h > box.h) { w *= box.h / h; h = box.h; }
    const x = along(box, w, align), dark = ctx.style.mode === 'dark';
    let done = at + 0.8;
    ctx.c.group(`device-${kind}`, { name: `Device · ${kind}`, ...appear(ctx, at, v2(x, box.y)) }, (g) => {
      const body = phone ? '#0B0C0F' : '@card';
      const r = phone ? w * 0.13 : u * Math.max(0.012, ctx.style.radius);
      card(ctx, 'Body', { x: 0, y: 0, w, h, radius: r, parent: g, fill: body });
      const bar = phone ? 0 : u * 0.045;
      const sw = phone ? w * 0.9 : w, sh = phone ? h * 0.955 : h - bar, sy = phone ? 0 : bar / 2;
      if (!phone) {
        ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => ctx.c.add('dot', { type: 'shape.ellipse', transform: { position: v2(-w / 2 + u * (0.025 + i * 0.022), -h / 2 + bar / 2) }, props: { size: v2(u * 0.012, u * 0.012), fill: c } }, g));
        if (kind === 'browser') ctx.c.add('address', { type: 'shape.rect', transform: { position: v2(0, -h / 2 + bar / 2) }, props: { size: v2(w * 0.42, bar * 0.52), radius: px(bar * 0.26), fill: tint(ctx, '@ink', dark ? 0.07 : 0.06) } }, g);
        if (kind === 'browser' && ctx.film.brand.url) label(ctx, ctx.film.brand.url, { x: 0, y: -h / 2 + bar / 2, size: u * 0.016, color: '@ink2', align: 'center', max: w * 0.4, parent: g });
        ctx.c.add('rule', { type: 'shape.rect', transform: { position: v2(0, -h / 2 + bar) }, props: { size: v2(w, Math.max(1, u * 0.0012)), fill: '@line' } }, g);
      } else {
        ctx.c.add('screen', { type: 'shape.rect', props: { size: v2(sw, sh), radius: px(r * 0.82), fill: '@plate' } }, g);
        ctx.c.add('island', { type: 'shape.rect', transform: { position: v2(0, -sh / 2 + w * 0.06) }, props: { size: v2(w * 0.28, w * 0.075), radius: px(w * 0.04), fill: '#000000' } }, g);
      }
      if (typeof el.image === 'string') {
        const m = ctx.c.add('screen-mask', { type: 'shape.rect', visible: false, transform: { position: v2(0, sy) }, props: { size: v2(sw, sh), radius: px(phone ? r * 0.82 : 0) } }, g);
        ctx.c.add('screen', { type: 'image', clip: m, transform: { position: v2(0, sy), scale: keys([at, [1.04, 1.04], '@standard'], [ctx.dur, [1, 1]]) }, props: { image: el.image, size: v2(sw, sh), fit: 'cover' } }, g);
      } else if (el.ui) {
        const top = phone ? -sh / 2 + w * 0.16 : -h / 2 + bar;
        const room = phone ? sh - w * 0.2 : sh;
        const k = phone ? 1.12 : screenScale(ctx, w);
        done = panel(ctx, el.ui as UiSpec, { x: 0, y: top + room / 2, w: (sw * (phone ? 1 : 0.86)) / k, at: at + 0.3, scale: k, maxHeight: room * 0.94, parent: g }).done;
      }
    });
    return done;
  },
  deviceHeight,
];

/** a line of code coloured by what each part is: keys, strings, numbers, words of the language, punctuation */
function tokens(line: string): { text: string; color: string }[] {
  const out: { text: string; color: string }[] = [];
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)(\s*:)?|\b(\d+(?:\.\d+)?)\b|\b(true|false|null|const|let|var|function|return|import|export|from|async|await|new|class|if|else|for|while|def|fn|pub|use|npx|npm)\b|([{}[\](),;.=<>+\-*/:|&!?]+)|(\s+)|([^\s"'`{}[\](),;.=<>+\-*/:|&!?]+)/g;
  for (const m of line.matchAll(re)) {
    if (m[1]) out.push({ text: m[1], color: m[2] ? '@ink' : '@accent' }, ...(m[2] ? [{ text: m[2], color: '@ink3' }] : []));
    else if (m[3]) out.push({ text: m[3], color: '@accent2' });
    else if (m[4]) out.push({ text: m[4], color: '@accent2' });
    else if (m[5]) out.push({ text: m[5], color: '@ink3' });
    else out.push({ text: m[0], color: '@ink' });
  }
  return out;
}

/** the size of code's type in a box `w` wide: as large as its longest line allows, up to a reading size */
const codeSize = (ctx: Ctx, lines: string[], w: number) => Math.min(ctx.u * (ctx.vertical ? 0.036 : 0.034), (w - ctx.u * 0.07) / (Math.max(12, ...lines.map((l) => l.length)) * 0.6));

const code: [Render, Natural] = [
  (ctx, el, box, at, align) => {
    const { u } = ctx, lines = list<string>(el.lines), longest = Math.max(12, ...lines.map((l) => l.length));
    const pad = u * 0.035, head = el.title ? u * 0.055 : u * 0.03;
    const size = codeSize(ctx, lines, box.w), lh = size * 1.55;
    const w = Math.min(box.w, longest * size * 0.6 + pad * 2), h = Math.min(box.h, head + lines.length * lh + pad * 1.4), x = along(box, w, align);
    const step = Math.min(0.22, Math.max(0.08, (ctx.dur * 0.55) / Math.max(1, lines.length)));
    ctx.c.group('code', { name: `Code · ${str(el.title, 'lines')}`, ...appear(ctx, at, v2(x, box.y)) }, (g) => {
      card(ctx, 'Card', { x: 0, y: 0, w, h, parent: g });
      ['@bad', '@accent2', '@good'].forEach((c, i) => ctx.c.add('dot', { type: 'shape.ellipse', transform: { position: v2(-w / 2 + pad * 0.7 + i * u * 0.02, -h / 2 + head / 2) }, props: { size: v2(u * 0.011, u * 0.011), fill: tint(ctx, c, 0.8) } }, g));
      if (el.title) label(ctx, str(el.title), { x: 0, y: -h / 2 + head / 2, size: u * 0.018, color: '@ink2', align: 'center', role: 'mono', max: w * 0.6, parent: g });
      lines.forEach((line, i) => {
        const y = -h / 2 + head + pad * 0.5 + lh * (i + 0.5), t = sec(at + 0.25 + i * step);
        // each line written from the left, a mask opening over it
        const m = ctx.c.add('line-mask', { type: 'shape.rect', visible: false, transform: { anchor: v2(-w / 2, 0), position: v2(-w / 2 + pad, y), scale: keys([t, [0, 1], 'linear'], [t + Math.max(0.12, line.length / 60), [1, 1]]) }, props: { size: v2(w, lh), fill: '#FFFFFF' } }, g);
        ctx.c.group(`line-${i + 1}`, { clip: m }, (lg) => {
          let cx = -w / 2 + pad;
          for (const tk of tokens(line)) {
            if (tk.text.trim()) ctx.c.add('token', { type: 'text', name: tk.text, transform: { position: v2(cx, y) }, props: { text: tk.text, font: ctx.fonts.mono, size: px(size), weight: 400, color: tk.color, align: 'left', baseline: 'middle' } }, lg);
            cx += tk.text.length * size * 0.6;
          }
        }, g);
      });
    });
    return at + 0.25 + lines.length * step + 0.3;
  },
  (ctx, el, w) => {
    const lines = list<string>(el.lines);
    return (el.title ? ctx.u * 0.055 : ctx.u * 0.03) + lines.length * codeSize(ctx, lines, w) * 1.55 + ctx.u * 0.035 * 1.4;
  },
];

const logo: [Render, Natural] = [
  (ctx, el, box, at, align) => {
    const { u, W } = ctx, name = str(el.name, ctx.film.brand.name ?? ctx.film.title), image = str(el.image, ctx.film.brand.logo ?? '');
    const mark = Math.min(u * 0.15, box.h * 0.6), nameSize = mark * 0.72, weight = ctx.style.display.strong, family = ctx.fonts.family.display, tracking = ctx.style.display.tracking;
    const tagH = el.tagline ? u * 0.06 : 0, cy = box.y - tagH / 2;
    burst(ctx, box.x, cy, at);
    ctx.cues.push({ t: at + 0.08, kind: 'impact' });
    if (image) {
      ctx.c.add('logo', { type: 'image', name: 'Logo', transform: { position: v2(box.x, cy), scale: grow(at, 0.7, 1, 0.8, '@pop'), opacity: fadeIn(at, 0.3) }, props: { image, size: v2(Math.min(box.w, u * 0.5), mark * 1.3), fit: 'contain' }, effects: [{ id: 'blur', type: 'fx.blur', props: { radius: keys([at, px(u * 0.025), '@enter'], [at + 0.6, 0]) } }] });
    } else {
      const nameW = name ? textWidth(ctx.style.upper ? name.toUpperCase() : name, nameSize, weight, family, tracking) : 0, gap = mark * 0.24;
      const total = name ? mark + gap + nameW : mark, k = Math.min(1, (box.w * 0.96) / total), slide = at + 0.7;
      const x0 = along(box, total * k, align) - (total * k) / 2;
      ctx.c.group('lockup', { name: 'Lockup', transform: { position: v2(x0, cy), scale: [k, k] } }, (g) => {
        const markX = mark / 2, from = name ? total / 2 : markX;
        ctx.c.group('mark', { name: 'Mark', transform: { position: name ? keys([slide, v2(from, 0), '@emphasized'], [slide + 0.8, v2(markX, 0)]) : v2(markX, 0), scale: grow(at, 0.45, 1, 0.75, '@pop'), opacity: fadeIn(at, 0.25) }, effects: [{ id: 'blur', type: 'fx.blur', props: { radius: keys([at, px(u * 0.03), '@enter'], [at + 0.55, 0]) } }] }, (m) => monogram(ctx, name || 'T', mark, m), g);
        if (name) {
          // the name comes out of the mark: a mask whose left edge rides on the mark's right edge
          const nx = mark + gap, edge0 = from + mark / 2;
          const maskId = ctx.c.add('name-mask', { type: 'shape.rect', visible: false, transform: { anchor: v2(-W / 2, 0), position: keys([slide, v2(edge0, 0), '@emphasized'], [slide + 0.8, v2(mark, 0)]) }, props: { size: v2(W, nameSize * 1.8), fill: '#FFFFFF' } }, g);
          ctx.c.add('name', { type: 'text', name, clip: maskId, transform: { position: keys([slide, v2(edge0 - nameW - gap, 0), '@emphasized'], [slide + 0.8, v2(nx, 0)]) }, props: { text: ctx.style.upper ? name.toUpperCase() : name, font: ctx.fonts.display, size: px(nameSize), weight, tracking, color: '@ink', align: 'left', baseline: 'middle' } }, g);
        }
      });
    }
    if (el.tagline) textBlock(ctx, { text: str(el.tagline), role: 'body', size: 'l', max: box.w, maxLines: 2, x: anchorX(box, align), y: cy + mark * 0.55 + tagH * 0.6, at: at + 1.2, align, treatment: 'fade' });
    return at + 1.6;
  },
  (ctx, el) => Math.min(ctx.u * 0.15, ctx.u) * 1.1 + (el.tagline ? ctx.u * 0.07 : 0),
];

/** the items of a list, as titles and lines */
export const itemsOf = (el: ElementSpec) => list<string | { title?: string; text?: string; icon?: string }>(el.items).map((it) => (typeof it === 'string' ? { title: it } : { title: str(it.title), text: it.text ? str(it.text) : undefined, icon: it.icon ? str(it.icon) : undefined }));

const listEl: [Render, Natural] = [
  (ctx, el, box, at, align) => {
    const { u } = ctx, rows = itemsOf(el), style = str(el.style, 'checks'), n = Math.max(1, rows.length);
    const ts = u * (ctx.vertical ? 0.042 : 0.038), bs = u * (ctx.vertical ? 0.034 : MIN_TYPE), node = ts * 1.25, gap = ts * 0.6;
    const textW = box.w - node - gap;
    const heights = rows.map((r) => ts * 1.2 + (r.text ? wrap(r.text, textW, bs, ctx.style.text.regular, ctx.fonts.family.text).length * bs * 1.32 + ts * 0.15 : 0));
    const total = heights.reduce((a, b) => a + b, 0) + (n - 1) * ts * 0.75, k = Math.min(1, box.h / total);
    const each = Math.max(0.22, (ctx.dur * 0.55) / n);
    // the list stands as a block, its marks in a column: centred or on its side as the layout says
    const widest = Math.max(...rows.map((r) => Math.max(textWidth(r.title, ts * k, ctx.style.text.strong, ctx.fonts.family.text),
      ...(r.text ? wrap(r.text, textW, bs * k, ctx.style.text.regular, ctx.fonts.family.text).slice(0, 3).map((l) => textWidth(l, bs * k, ctx.style.text.regular, ctx.fonts.family.text)) : [0]))));
    const blockW = Math.min(box.w, node + gap + widest);
    const x0 = align === 'center' ? box.x - blockW / 2 : align === 'right' ? box.x + box.w / 2 - blockW : box.x - box.w / 2;
    let y = box.y - (total * k) / 2;
    let done = at;
    ctx.c.group('list', { name: `List · ${style}`, transform: { position: v2(0, 0) } }, (g) => {
      // steps: a line that runs from one to the next as each is reached
      if (style === 'steps' && n > 1) {
        const y0 = y + (heights[0] * k) / 2, len = total * k - (heights[0] * k) / 2 - (heights[n - 1] * k) / 2;
        ctx.c.add('rail', { type: 'shape.rect', transform: { anchor: v2(0, -len / 2), position: v2(x0 + node / 2, y0), scale: keys([at, [1, 0], '@standard'], [at + each * (n - 1), [1, 1]]) }, props: { size: v2(Math.max(2, u * 0.003), len), fill: { type: 'linear', from: [0, px(-len / 2)], to: [0, px(len / 2)], stops: [[0, '@accent'], [1, '@accent2']] } } }, g);
      }
      rows.forEach((r, i) => {
        const h = heights[i] * k, t = sec(at + i * each), titleY = y + ts * 0.6 * k;
        ctx.c.group(`item-${i + 1}`, { name: r.title, ...appear(ctx, t, v2(0, 0)) }, (ig) => {
          const nx = x0 + node / 2;
          if (style === 'bullets') ctx.c.add('bullet', { type: 'shape.ellipse', transform: { position: v2(nx, titleY) }, props: { size: v2(ts * 0.3, ts * 0.3), fill: '@accent' } }, ig);
          else {
            ctx.c.add('node', { type: 'shape.ellipse', transform: { position: v2(nx, titleY), scale: grow(t, 0.5, 1, 0.45, '@pop') }, props: { size: v2(node, node), fill: style === 'checks' ? tint(ctx, '@accent', 0.18) : { type: 'linear', from: [px(-node / 2), px(-node / 2)], to: [px(node / 2), px(node / 2)], stops: [[0, '@accent'], [1, '@accent2']] } } }, ig);
            if (r.icon && ICONS[r.icon]) icon(ctx, r.icon, { x: nx, y: titleY, size: node * 0.5, color: style === 'checks' ? '@accent' : '#FFFFFF', width: 2.2, parent: ig });
            else if (style === 'checks') icon(ctx, 'check', { x: nx, y: titleY, size: node * 0.55, color: '@accent', width: 2.6, parent: ig });
            else ctx.c.add('number', { type: 'text', transform: { position: v2(nx, titleY) }, props: { text: String(i + 1), font: ctx.fonts.display, size: px(node * 0.5), weight: ctx.style.display.strong, color: '#FFFFFF', align: 'center', baseline: 'middle' } }, ig);
          }
          const tx = x0 + node + gap;
          label(ctx, r.title, { x: tx, y: titleY, size: ts * k, weight: ctx.style.text.strong, max: textW, parent: ig });
          if (r.text) {
            const lines = wrap(r.text, textW, bs * k, ctx.style.text.regular, ctx.fonts.family.text).slice(0, 3);
            ctx.c.add('detail', { type: 'text', name: r.text, transform: { position: v2(tx, titleY + ts * 0.85 * k) }, props: { text: lines.join('\n'), font: ctx.fonts.text, size: px(bs * k), weight: ctx.style.text.regular, color: '@ink2', align: 'left', baseline: 'top', lineHeight: 1.32 } }, ig);
          }
        }, g);
        y += h + ts * 0.75 * k;
        done = t + 0.6;
      });
    });
    return done;
  },
  (ctx, el, w) => {
    const { u } = ctx, rows = itemsOf(el), ts = u * (ctx.vertical ? 0.042 : 0.038), bs = u * (ctx.vertical ? 0.034 : MIN_TYPE), textW = w - ts * 1.85;
    return rows.reduce((s, r) => s + ts * 1.2 + (r.text ? wrap(r.text, textW, bs, ctx.style.text.regular, ctx.fonts.family.text).length * bs * 1.32 + ts * 0.15 : 0), 0) + (rows.length - 1) * ts * 0.75;
  },
];

const cards: [Render, Natural] = [
  (ctx, el, box, at) => {
    const { u } = ctx, its = itemsOf(el).slice(0, 4), n = Math.max(1, its.length), row = box.w / box.h > 1.3 && n > 1;
    const gap = u * 0.03, pad = u * 0.038, tile = u * 0.08;
    const cw = row ? (box.w - gap * (n - 1)) / n : box.w, tw = row ? cw - pad * 2 : cw - pad * 2 - tile - u * 0.03;
    const ts = u * (ctx.vertical ? 0.046 : 0.04), bs = u * (ctx.vertical ? 0.034 : MIN_TYPE), tl = ctx.style.display.lineHeight;
    const set = its.map((it) => {
      const title = it.title ? wrap(it.title, tw, ts, ctx.style.display.strong, ctx.fonts.family.display, ctx.style.display.tracking).slice(0, 2) : [];
      const body = it.text ? wrap(it.text, tw, bs, ctx.style.text.regular, ctx.fonts.family.text).slice(0, 3) : [];
      return { title, body, h: title.length * ts * tl + (body.length ? u * 0.02 + body.length * bs * 1.3 : 0) };
    });
    const words = Math.max(...set.map((s) => s.h));
    const ch0 = row ? pad * 2 + tile + u * 0.04 + words : Math.max(tile, words) + pad * 2;
    const ch = row ? Math.min(ch0, box.h) : Math.min(ch0, (box.h - gap * (n - 1)) / n);
    let done = at;
    its.forEach((it, i) => {
      const t = sec(at + i * Math.max(0.1, ctx.style.stagger * 2.2));
      const cx = row ? box.x - box.w / 2 + cw / 2 + i * (cw + gap) : box.x;
      const cy = row ? box.y : box.y - ((ch + gap) * (n - 1)) / 2 + i * (ch + gap);
      const { title, body, h } = set[i];
      ctx.c.group(`card-${i + 1}`, { name: `Card · ${it.title}`, ...appear(ctx, t, v2(cx, cy)) }, (g) => {
        card(ctx, 'Card', { x: 0, y: 0, w: cw, h: ch, parent: g });
        const lit = t + 1.2 + i * 0.3;
        ctx.c.add('edge', { type: 'shape.rect', blend: ctx.style.mode === 'dark' ? 'add' : 'normal', transform: { opacity: keys([lit, 0, '@enter'], [lit + 0.25, 1, '@standard'], [lit + 1.1, 0.2]) }, props: { size: v2(cw, ch), radius: px(u * ctx.style.radius), fill: null, stroke: '@accent', strokeWidth: px(u * 0.0022) } }, g);
        const ix = -cw / 2 + pad + tile / 2, iy = row ? -ch / 2 + pad + tile / 2 : 0;
        ctx.c.add('icon-tile', { type: 'shape.rect', transform: { position: v2(ix, iy) }, props: { size: v2(tile, tile), radius: px(tile * Math.min(0.5, ctx.style.radius * 12)), fill: tint(ctx, '@accent', ctx.style.mode === 'dark' ? 0.18 : 0.11), stroke: tint(ctx, '@accent', 0.33), strokeWidth: px(u * 0.0012) } }, g);
        icon(ctx, it.icon && ICONS[it.icon] ? it.icon : 'sparkle', { x: ix, y: iy, size: tile * 0.5, color: ctx.style.mode === 'dark' ? '@accent2' : '@accent', width: 1.9, parent: g });
        const tx = row ? -cw / 2 + pad : ix + tile / 2 + u * 0.03;
        let y = row ? iy + tile / 2 + u * 0.04 : -h / 2;
        if (title.length) {
          ctx.c.add('title', { type: 'text', name: it.title, transform: { position: v2(tx, y) }, props: { text: (ctx.style.upper ? title.join('\n').toUpperCase() : title.join('\n')), font: ctx.fonts.display, size: px(ts), weight: ctx.style.display.strong, tracking: ctx.style.display.tracking, color: '@ink', align: 'left', baseline: 'top', lineHeight: tl } }, g);
          y += title.length * ts * tl + u * 0.02;
        }
        if (body.length) ctx.c.add('text', { type: 'text', name: it.text, transform: { position: v2(tx, y) }, props: { text: body.join('\n'), font: ctx.fonts.text, size: px(bs), weight: ctx.style.text.regular, color: '@ink2', align: 'left', baseline: 'top', lineHeight: 1.3 } }, g);
      });
      done = t + 0.8;
    });
    return done;
  },
  (ctx, el, w) => { const n = Math.max(1, itemsOf(el).length); return ctx.u * (ctx.vertical ? 0.24 : 0.36) * (w / ctx.W > 0.6 ? 1 : n); },
];

const quote: [Render, Natural] = [
  (ctx, el, box, at, align) => {
    const { u } = ctx, name = str(el.name), role = str(el.role);
    const qh = textHeight(ctx, { text: `“${str(el.quote)}”`, role: 'headline', size: 'm', max: box.w, maxLines: 5 }), authorH = name || role ? u * 0.11 : 0;
    const top = box.y - (qh + authorH) / 2, x = anchorX(box, align);
    ctx.c.add('mark', { type: 'text', name: 'Quote mark', transform: { position: v2(align === 'left' ? x + u * 0.03 : x, top - u * 0.05), opacity: keys([at, 0, '@enter'], [at + 0.5, 0.9]), scale: grow(at, 0.6, 1, 0.7, '@pop') }, props: { text: '“', font: ctx.fonts.display, size: px(u * 0.16), weight: ctx.style.display.strong, color: '@accent', align: align === 'left' ? 'left' : 'center', baseline: 'middle' } });
    const block = textBlock(ctx, { text: `“${str(el.quote)}”`, role: 'headline', size: 'm', max: box.w, maxLines: 5, x, y: top + qh / 2, at: at + 0.15, align, emphasis: list<string>(el.emphasis) });
    if (name || role) {
      const t = block.done, ay = block.bottom + u * 0.07, d = u * 0.07;
      const nw = Math.max(textWidth(name, u * 0.034, ctx.style.text.strong, ctx.fonts.family.text), textWidth(role, u * MIN_TYPE, ctx.style.text.regular, ctx.fonts.family.text));
      const total = d + u * 0.025 + nw, x0 = along(box, total, align) - total / 2;
      ctx.c.group('author', { transform: { position: keys([t, v2(0, u * 0.02), '@enter'], [t + 0.6, v2(0, 0)]), opacity: fadeIn(t, 0.4) } }, (g) => {
        if (typeof el.avatar === 'string') {
          const m = ctx.c.add('avatar-mask', { type: 'shape.ellipse', visible: false, transform: { position: v2(x0 + d / 2, ay) }, props: { size: v2(d, d) } }, g);
          ctx.c.add('avatar', { type: 'image', clip: m, transform: { position: v2(x0 + d / 2, ay) }, props: { image: el.avatar, size: v2(d, d), fit: 'cover' } }, g);
        } else avatar(ctx, { x: x0 + d / 2, y: ay, d, initials: name.split(/\s+/).map((w) => w[0] ?? '').join(''), parent: g });
        const tx = x0 + d + u * 0.025;
        if (name) label(ctx, name, { x: tx, y: ay - (role ? u * 0.02 : 0), size: u * 0.034, weight: ctx.style.text.strong, max: box.w, parent: g });
        if (role) label(ctx, role, { x: tx, y: ay + u * 0.024, size: u * MIN_TYPE, color: '@ink2', max: box.w, parent: g });
      });
      return t + 0.6;
    }
    return block.done;
  },
  (ctx, el, w) => textHeight(ctx, { text: `“${str(el.quote)}”`, role: 'headline', size: 'm', max: w, maxLines: 5 }) + (el.name || el.role ? ctx.u * 0.11 : 0),
];

const button: [Render, Natural] = [
  (ctx, el, box, at, align) => {
    const { u } = ctx, text = str(el.text), size = u * (ctx.vertical ? 0.038 : 0.03), bh = size * 2.6;
    const ic = el.icon && ICONS[str(el.icon)] ? size * 1.1 : 0, lw = textWidth(text, size, ctx.style.text.strong, ctx.fonts.family.text);
    const bw = lw + ic + (ic ? size * 0.4 : 0) + size * 3.2, x = along(box, bw, align), press = Math.max(at + 0.9, ctx.dur * 0.62);
    ctx.cues.push({ t: press, kind: 'click' });
    const r = ctx.style.radius < 0.01 ? bh * 0.12 : ctx.style.radius > 0.03 ? bh / 2 : bh * 0.3;
    ctx.c.group('button', { name: `Button · ${text}`, transform: { position: v2(x, box.y), scale: keys([at, [0.8, 0.8], '@pop'], [at + 0.5, [1, 1]], [press - 0.06, [1, 1], '@standard'], [press, [0.94, 0.94], '@pop'], [press + 0.4, [1, 1]]), opacity: fadeIn(at, 0.25) } }, (g) => {
      ctx.c.add('fill', { type: 'shape.rect', props: { size: v2(bw, bh), radius: px(r), fill: { type: 'linear', from: [px(-bw / 2), 0], to: [px(bw / 2), 0], stops: [[0, '@accent'], [1, '@accent2']] } }, effects: [{ id: 'glow', type: 'fx.glow', props: { color: tint(ctx, '@accent', 0.6), radius: keys([press - 0.05, px(u * 0.015)], [press + 0.06, px(u * 0.05), '@enter'], [press + 0.8, px(u * 0.015)]), strength: 1 } }] }, g);
      const ink = ctx.style.mode === 'dark' ? '@plate' : '#FFFFFF', start = -(lw + ic + (ic ? size * 0.4 : 0)) / 2;
      if (ic) icon(ctx, str(el.icon), { x: start + ic / 2, y: 0, size: ic, color: ink, width: 2.2, parent: g });
      ctx.c.add('label', { type: 'text', props: { text, font: ctx.fonts.text, size: px(size), weight: ctx.style.text.strong, color: ink, align: 'left', baseline: 'middle' }, transform: { position: v2(start + (ic ? ic + size * 0.4 : 0), 0) } }, g);
    });
    return press + 0.4;
  },
  (ctx) => ctx.u * (ctx.vertical ? 0.038 : 0.03) * 2.6,
];

const image: [Render, Natural] = [
  (ctx, el, box, at, align) => {
    const { u } = ctx, w = box.w, h = box.h, x = along(box, w, align), r = u * Math.max(0.006, ctx.style.radius);
    ctx.c.group('picture', { name: 'Picture', ...appear(ctx, at, v2(x, box.y)) }, (g) => {
      card(ctx, 'Frame', { x: 0, y: 0, w, h, radius: r, parent: g });
      const m = ctx.c.add('picture-mask', { type: 'shape.rect', visible: false, props: { size: v2(w, h), radius: px(r) } }, g);
      ctx.c.add('image', { type: 'image', clip: m, transform: { scale: keys([at, [1, 1], '@standard'], [ctx.dur, [1.07, 1.07]]) }, props: { image: str(el.image), size: v2(w, h), fit: str(el.fit, 'cover') } }, g);
    });
    return at + 0.8;
  },
  (_ctx, _el, w) => w * 0.62,
];

const motif: [Render, Natural] = [
  (ctx, el, box, at) => {
    const { dur } = ctx, m = ctx.style.motif === 'none' ? 'circle' : ctx.style.motif, pattern = str(el.pattern, 'burst');
    const colors = ['@accent', '@accent2', '@ink'].map((c) => tokenHex(ctx, c)), r = Math.min(box.w, box.h) / 2;
    ctx.cues.push({ t: at + 0.1, kind: 'impact' });
    ctx.c.group('motif', { name: `Motif · ${pattern}`, transform: { position: v2(box.x, box.y) } }, (g) => {
      if (pattern === 'frames') {
        // the motif passing like frames of a film
        for (let i = 0; i < 7; i++) {
          const t = at + i * 0.08, x = (i - 3) * r * 0.42;
          motifLayer(ctx, m, { size: r * 0.36, color: colors[i % 3], transform: { position: keys([t, v2(x + r * 0.6, 0), '@enter'], [t + 0.7, v2(x, 0)], [dur, v2(x - r * 0.25, 0)]), opacity: keys([t, 0, '@enter'], [t + 0.3, 1 - Math.abs(i - 3) * 0.2]) } }, g);
        }
      } else if (pattern === 'orbit') {
        ctx.c.group('orbit', { transform: { rotation: keys([at, -40, '@standard'], [dur, 50]), scale: grow(at, 0.6, 1, 0.9, '@pop') } }, (o) => {
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; motifLayer(ctx, m, { size: r * (0.14 + (i % 3) * 0.05), color: colors[i % 3], transform: { position: v2(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8), opacity: fadeIn(at + i * 0.05, 0.3) } }, o); }
        }, g);
        motifLayer(ctx, m, { size: r * 0.45, color: colors[0], transform: { scale: grow(at, 0.3, 1, 0.8, '@pop'), opacity: fadeIn(at, 0.25) } }, g);
      } else if (pattern === 'trail') {
        for (let i = 4; i >= 0; i--) {
          const lag = i * 0.07;
          motifLayer(ctx, m, { size: r * 0.4, color: colors[0], transform: { position: keys([at + lag, v2(-r * 1.2, r * 0.4), '@standard'], [at + lag + dur * 0.6, v2(r * 1.2, -r * 0.3)]), rotation: keys([at + lag, -30, '@standard'], [at + lag + dur * 0.6, 30]), opacity: 1 - i * 0.2 } }, g);
        }
      } else if (pattern === 'field') {
        const n = 7;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const x = (i - (n - 1) / 2) * (r * 2 / n), y = (j - (n - 1) / 2) * (r * 2 / n), dist = Math.hypot(i - (n - 1) / 2, j - (n - 1) / 2), t = at + dist * 0.07;
          motifLayer(ctx, m, { size: r * 0.12, color: colors[(i + j) % 3], transform: { position: v2(x, y), scale: keys([t, [0, 0], '@pop'], [t + 0.5, [1, 1]]) } }, g);
        }
      } else {
        // burst: the motif lands and its copies fly out of it
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + ctx.rand() * 0.4, d = r * (0.6 + ctx.rand() * 0.5);
          motifLayer(ctx, m, { size: r * (0.1 + ctx.rand() * 0.12), color: colors[i % 3], transform: { position: keys([at + 0.1, v2(0, 0), '@enter'], [at + 1.1, v2(Math.cos(a) * d, Math.sin(a) * d)]), rotation: keys([at, 0, '@enter'], [at + 1.4, (ctx.rand() - 0.5) * 180]), opacity: keys([at + 0.1, 0], [at + 0.25, 1, '@standard'], [dur, 0.5]) } }, g);
        }
        motifLayer(ctx, m, { size: r * 0.55, color: colors[0], transform: { scale: grow(at, 0.2, 1, 0.8, '@pop'), opacity: fadeIn(at, 0.2) } }, g);
      }
    });
    return at + 1.2;
  },
  (ctx, _el, w) => Math.min(w, ctx.u * 0.6),
];

/** each element: how it is drawn into a box, and how tall it wants to be for a width */
export const ELEMENT_RENDER: Record<string, [Render, Natural]> = { figure, chart, ui, device, code, logo, list: listEl, cards, quote, button, image, motif };

export const roleOf = (el: ElementSpec, first: boolean) => (el.role as string | undefined) ?? (first ? 'headline' : 'body');
export { roleSize };
