// Interfaces made of real layers, from a short description: a panel (a card
// with a header) stacking rows, figure tiles, a chart, a search field, a
// button, a notification, chat bubbles, tabs, a progress bar. Laid out in
// the look's card style, and brought in piece by piece: the card rises, the
// rows follow one another, figures roll, the chart draws itself, the field
// types, the button is pressed. Every text stays editable.

import type { Layer, Vec2 } from '@tramme/core';
import { fadeIn, grow, keys, px, sec, tint, tokenHex, v2, type Ctx } from './build.ts';
import { mix, withAlpha } from './color.ts';
import { icon, ICONS } from './icons.ts';
import { textWidth, wrap } from './metrics.ts';
import { figure } from './text.ts';

/** one element of a panel; `kind` says which (see UI_KINDS) */
export interface UiItem { kind: string; [k: string]: unknown }
export interface UiSpec { title?: string; subtitle?: string; items: UiItem[] }

export const UI_KINDS: Record<string, string> = {
  row: '{ kind: "row", title, sub?, value?, delta? ("+2.4%" green, "-1.2%" red), icon? or avatar? (initials), badge? }: a line of a list',
  stats: '{ kind: "stats", items: [{ label, value }] }: two to four figures side by side, rolling up',
  chart: '{ kind: "chart", data: [numbers], label?, value?, delta? }: a line with its area, drawing itself',
  input: '{ kind: "input", text, icon? ("search" by default) }: a field that types its text',
  button: '{ kind: "button", text, icon? }: pressed near the end of the scene',
  toast: '{ kind: "toast", text, value?, icon? ("check") }: a notification that pops over the panel',
  tabs: '{ kind: "tabs", items: [labels], active? (index) }',
  progress: '{ kind: "progress", label, value (0 to 1) }: a bar that fills',
  chat: '{ kind: "chat", text, from? ("me" or "them") }: a message bubble',
  text: '{ kind: "text", text }: a short paragraph',
};

export const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
/** a delta's colour from its sign */
export const tone = (s: string) => (/^\s*[-−]/.test(s) ? '@bad' : '@good');

/** a line of text cut to fit `max` px, with an ellipsis */
function clipText(text: string, size: number, weight: number, family: string, max: number): string {
  if (textWidth(text, size, weight, family) <= max) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}…`, size, weight, family) > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** a card in the film's style, centred at (x, y): a lit edge on the dark grounds, a soft shadow on the light ones */
export function card(ctx: Ctx, name: string, o: { x: number; y: number; w: number; h: number; parent?: string; transform?: Layer['transform']; radius?: number; fill?: string }): string {
  const st = ctx.style, dark = st.mode === 'dark', k = ctx.u / 1080, r = o.radius ?? px(ctx.u * st.radius);
  const top = dark ? mix(st.colors.surface, st.colors.ink, 0.05) : st.colors.surface;
  const fill = o.fill ?? (dark ? { type: 'linear', from: [0, px(-o.h / 2)], to: [0, px(o.h / 2)], stops: [[0, top], [0.35, '@card'], [1, '@card']] } : '@card');
  const effects = !dark ? [{ id: 'shadow', type: 'fx.shadow', props: { color: withAlpha(mix(st.colors.ink, st.colors.accent, 0.3), 0.16), blur: px(46 * k), offset: [0, px(16 * k)] } }]
    : st.glow ? [{ id: 'glow', type: 'fx.glow', props: { color: withAlpha(st.colors.glow, 0.25), radius: px(38 * k), strength: 1 } }] : [];
  return ctx.c.add(name, {
    type: 'shape.rect', name,
    transform: { position: v2(o.x, o.y), ...o.transform },
    props: { size: v2(o.w, o.h), radius: r, fill, stroke: '@cardLine', strokeWidth: px(1.5 * k) },
    ...(effects.length ? { effects } : {}),
  }, o.parent);
}

/** text in the panel: one layer, cut to its room */
export function label(ctx: Ctx, text: string, o: { x: number; y: number; size: number; weight?: number; color?: string; align?: 'left' | 'right' | 'center'; max: number; role?: 'text' | 'mono' | 'display'; parent: string; transform?: Layer['transform'] }): string {
  const role = o.role ?? 'text', weight = o.weight ?? ctx.style.text.regular, family = ctx.fonts.family[role];
  const t = clipText(text, o.size, weight, family, o.max);
  return ctx.c.add(t.slice(0, 24) || 'label', {
    type: 'text', name: t,
    transform: { position: v2(o.x, o.y), ...o.transform },
    props: { text: t, font: ctx.fonts[role], size: px(o.size), weight, color: o.color ?? '@ink', align: o.align ?? 'left', baseline: 'middle' },
  }, o.parent);
}

/** the line height of paragraphs, in em */
export const LINE = 1.32;

/** the lines of a chat bubble, at most three quarters of the panel wide */
const bubbleLines = (ctx: Ctx, text: string, inner: number) => wrap(text, inner * 0.75 - ctx.u * 0.044, ctx.u * 0.022, ctx.style.text.regular, ctx.fonts.family.text);

/** lines of text in one layer, left aligned from x, centred on y */
export function paragraph(ctx: Ctx, lines: string[], o: { x: number; y: number; size: number; color: string; parent: string }): string {
  return ctx.c.add(lines[0]?.slice(0, 24) || 'text', {
    type: 'text', name: lines.join(' '),
    transform: { position: v2(o.x, o.y - ((lines.length - 1) * o.size * LINE) / 2) },
    props: { text: lines.join('\n'), font: ctx.fonts.text, size: px(o.size), weight: ctx.style.text.regular, color: o.color, align: 'left', baseline: 'middle', lineHeight: LINE },
  }, o.parent);
}

/** a figure that rolls up to its value from `at` */
export function counter(ctx: Ctx, value: string, o: { x: number; y: number; size: number; weight?: number; color?: string; align?: 'left' | 'right' | 'center'; at: number; d?: number; role?: 'text' | 'mono' | 'display'; parent: string }): string {
  const role = o.role ?? 'text';
  if (!/\d/.test(value)) return label(ctx, value, { ...o, max: Infinity });
  const f = figure(value, o.size, keys([o.at, 0, '@emphasized'], [o.at + (o.d ?? 1.1), 1]), 0);
  return ctx.c.add(`value-${value}`.slice(0, 24), {
    type: f.type, name: value,
    transform: { position: v2(o.x, o.y + f.dy) },
    props: { ...f.props, font: ctx.fonts[role], size: px(o.size), weight: o.weight ?? 600, color: o.color ?? '@ink', align: o.align ?? 'left' },
  }, o.parent);
}

/** a round badge: initials on the accent, or an icon */
export function avatar(ctx: Ctx, o: { x: number; y: number; d: number; initials?: string; icon?: string; parent: string; tint?: string }) {
  const g = ctx.c.group('avatar', { transform: { position: v2(o.x, o.y) } }, (id) => {
    ctx.c.add('disc', { type: 'shape.ellipse', props: { size: v2(o.d, o.d), fill: o.tint ?? { type: 'linear', from: [px(-o.d / 2), px(-o.d / 2)], to: [px(o.d / 2), px(o.d / 2)], stops: [[0, '@accent'], [1, '@accent2']] } } }, id);
    if (o.icon && ICONS[o.icon]) icon(ctx, o.icon, { x: 0, y: 0, size: o.d * 0.55, color: '#FFFFFF', parent: id });
    else ctx.c.add('initials', { type: 'text', props: { text: (o.initials ?? '?').slice(0, 2).toUpperCase(), font: ctx.fonts.text, size: px(o.d * 0.38), weight: 650, color: '#FFFFFF', align: 'center', baseline: 'middle' } }, id);
  }, o.parent);
  return g;
}

/** a smooth path through points (Catmull-Rom as cubic tangents) */
export function smooth(points: Vec2[], tension = 0.5) {
  const n = points.length;
  const i: Vec2[] = [], o: Vec2[] = [];
  for (let k = 0; k < n; k++) {
    const p0 = points[Math.max(0, k - 1)], p2 = points[Math.min(n - 1, k + 1)];
    const tx = ((p2[0] - p0[0]) * tension) / 3, ty = ((p2[1] - p0[1]) * tension) / 3;
    i.push([px(-tx), px(-ty)]); o.push([px(tx), px(ty)]);
  }
  return { v: points.map(([x, y]) => v2(x, y)), i, o };
}

/** a line chart with its area, drawing itself from `at` over `d`, in a box centred at (x, y) */
export function lineChart(ctx: Ctx, data: number[], o: { x: number; y: number; w: number; h: number; at: number; d: number; parent?: string; color?: string; area?: boolean; grid?: boolean; dot?: boolean }) {
  const { u } = ctx, n = data.length, lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1;
  const pts: Vec2[] = data.map((v, k) => [-o.w / 2 + (o.w * k) / Math.max(1, n - 1), o.h / 2 - ((v - lo) / span) * o.h * 0.86 - o.h * 0.07]);
  const path = smooth(pts);
  const color = o.color ?? '@accent2';
  const end = o.at + o.d;
  return ctx.c.group('chart', { transform: { position: v2(o.x, o.y) } }, (g) => {
    if (o.grid !== false) for (let k = 0; k < 4; k++) {
      ctx.c.add('gridline', { type: 'shape.rect', transform: { position: v2(0, -o.h / 2 + (o.h * (k + 0.5)) / 4), opacity: fadeIn(o.at - 0.2, 0.5) }, props: { size: v2(o.w, Math.max(1, u * 0.0012)), fill: '@line' } }, g);
    }
    // the reveal: a mask that opens from the left as the line advances
    const mask = ctx.c.add('reveal', { type: 'shape.rect', visible: false, transform: { anchor: v2(-o.w / 2 - u * 0.02, 0), position: v2(-o.w / 2 - u * 0.02, 0), scale: keys([o.at, [0, 1], '@standard'], [end, [1, 1]]) }, props: { size: v2(o.w + u * 0.04, o.h * 1.4), fill: '#FFFFFF' } }, g);
    ctx.c.group('drawn', { clip: mask }, (d) => {
      if (o.area !== false) {
        const areaPath = { v: [...path.v, v2(o.w / 2, o.h / 2), v2(-o.w / 2, o.h / 2)], i: [...path.i, [0, 0] as Vec2, [0, 0] as Vec2], o: [...path.o, [0, 0] as Vec2, [0, 0] as Vec2], closed: true };
        ctx.c.add('area', { type: 'shape.path', props: { path: areaPath, fill: { type: 'linear', from: [0, px(-o.h / 2)], to: [0, px(o.h / 2)], stops: [[0, tint(ctx, color, 0.33)], [1, tint(ctx, color, 0.0)]] }, stroke: null } }, d);
      }
      ctx.c.add('line', { type: 'shape.path', props: { path: { ...path, closed: false }, fill: null, stroke: color, strokeWidth: px(u * 0.0042), lineCap: 'round', lineJoin: 'round' }, effects: [{ id: 'glow', type: 'fx.glow', props: { color: tint(ctx, color, 0.67), radius: px(u * 0.012), strength: 1 } }] }, d);
    }, g);
    if (o.dot !== false) {
      // the head of the line, riding on it as it draws
      const frames = pts.map((p, k) => [o.at + (o.d * k) / Math.max(1, n - 1), v2(p[0], p[1])] as [number, Vec2]);
      ctx.c.add('head', {
        type: 'shape.ellipse', transform: { position: keys(...frames.map(([t, p]) => [t, p] as [number, Vec2])), opacity: fadeIn(o.at, 0.2) },
        props: { size: v2(u * 0.016, u * 0.016), fill: '#FFFFFF' },
        effects: [{ id: 'glow', type: 'fx.glow', props: { color: tokenHex(ctx, color), radius: px(u * 0.02), strength: 2 } }],
      }, g);
    }
  }, o.parent);
}

/** how tall each kind of element stands in a panel, as a fraction of the frame's short side */
function heightOf(ctx: Ctx, it: UiItem, inner: number): number {
  const { u } = ctx;
  switch (it.kind) {
    case 'row': return u * 0.082;
    case 'stats': return u * 0.112;
    case 'chart': return u * (it.label || it.value ? 0.26 : 0.2);
    case 'input': return u * 0.078;
    case 'button': return u * 0.082;
    case 'tabs': return u * 0.066;
    case 'progress': return u * 0.072;
    case 'chat': return bubbleLines(ctx, str(it.text), inner).length * u * 0.022 * LINE + u * 0.06;
    case 'text': return wrap(str(it.text), inner, u * 0.022, ctx.style.text.regular, ctx.fonts.family.text).length * u * 0.022 * LINE + u * 0.025;
    default: return 0;
  }
}

export interface Panel { id: string; w: number; h: number; /** where each item sits (centre y, inside the panel) */ rows: { y: number; h: number; kind: string }[]; done: number; press?: number; toast?: number }

/**
 * A panel centred at (x, y), `w` wide, its items stacked under its header.
 * It enters at `at`; the button (if any) is pressed at `press`, the toast
 * (if any) pops at `toastAt`.
 */
/** the parts of a panel `w` wide: its padding, its items and their heights, its height, the room kept above it for a notification */
function measure(ctx: Ctx, spec: UiSpec, w: number) {
  const { u } = ctx, pad = u * 0.032, inner = w - pad * 2;
  const items = (spec.items ?? []).filter((it) => it.kind !== 'toast');
  const toast = (spec.items ?? []).find((it) => it.kind === 'toast');
  const head = spec.title ? u * 0.085 : pad * 0.6;
  const heights = items.map((it) => heightOf(ctx, it, inner));
  // a notification alone is the whole interface: no card under it
  const th = u * 0.068, tgap = u * 0.022, alone = !!toast && !items.length && !spec.title;
  const h = alone ? th : head + heights.reduce((a, b) => a + b, 0) + pad * 0.7;
  // a notification drops in above the card: room is kept for it
  const lift = toast && !alone ? th + tgap : 0;
  return { pad, inner, items, toast, head, heights, h, th, tgap, lift, alone };
}

/** how tall a panel `w` wide stands, its notification included */
export const panelHeight = (ctx: Ctx, spec: UiSpec, w: number) => { const m = measure(ctx, spec, w); return m.h + m.lift; };

export function panel(ctx: Ctx, spec: UiSpec, o: { x: number; y: number; w: number; at: number; press?: number; toastAt?: number; parent?: string; depth?: number; scale?: number; maxHeight?: number }): Panel {
  const { u } = ctx, { pad, inner, items, toast, head, heights, h, th, tgap, lift, alone } = measure(ctx, spec, o.w);
  // drawn larger when asked, smaller when it would not fit
  const k = Math.min(o.scale ?? 1, o.maxHeight ? o.maxHeight / (h + lift) : Infinity);
  if (k < (o.scale ?? 1) * 0.85) ctx.notes.push(`an interface drawn at ${Math.round((k / (o.scale ?? 1)) * 100)}% to fit, its text small: fewer items, or more room for it (full, a phone)`);
  const cy = o.y + (lift * k) / 2;
  const rows: Panel['rows'] = [];
  let press: number | undefined, done = o.at + 0.6;
  const stagger = 0.075;
  const id = ctx.c.group('panel', { transform: { position: keys([o.at, v2(o.x, cy + u * 0.05), '@enter'], [o.at + 0.8, v2(o.x, cy)]), scale: grow(o.at, 0.96 * k, k, 0.8), opacity: fadeIn(o.at, 0.45), ...(o.depth ? { depth: o.depth } : {}) } }, (g) => {
    if (!alone) card(ctx, 'Card', { x: 0, y: 0, w: o.w, h, parent: g });
    const top = -h / 2;
    if (spec.title) {
      label(ctx, spec.title, { x: -o.w / 2 + pad, y: top + head * 0.55, size: u * 0.027, weight: 620, max: inner * 0.6, parent: g });
      if (spec.subtitle) label(ctx, spec.subtitle, { x: o.w / 2 - pad, y: top + head * 0.55, size: u * 0.02, color: '@ink2', align: 'right', max: inner * 0.38, parent: g });
      ctx.c.add('header-line', { type: 'shape.rect', transform: { position: v2(0, top + head) }, props: { size: v2(o.w, Math.max(1, u * 0.0012)), fill: '@line' } }, g);
    }
    let y = top + head;
    items.forEach((it, k) => {
      const ih = heights[k], cy = y + ih / 2, t = sec(o.at + 0.35 + k * stagger);
      rows.push({ y: cy, h: ih, kind: it.kind });
      const enter = { position: keys([t, v2(0, cy + u * 0.025), '@enter'], [t + 0.6, v2(0, cy)]), opacity: fadeIn(t, 0.4) };
      ctx.c.group(`${it.kind}-${k + 1}`, { name: `${it.kind} · ${str(it.title ?? it.text ?? it.label, String(k + 1))}`.slice(0, 40), transform: enter }, (r) => {
        const L = -o.w / 2 + pad, R = o.w / 2 - pad;
        switch (it.kind) {
          case 'row': {
            const d = u * 0.052;
            let x = L;
            if (it.icon || it.avatar) { avatar(ctx, { x: L + d / 2, y: 0, d, initials: str(it.avatar, str(it.title)), icon: str(it.icon) || undefined, parent: r }); x += d + u * 0.02; }
            const hasRight = !!(it.value || it.delta), titleMax = (R - x) * (hasRight ? 0.58 : 1);
            const titleY = it.sub ? -u * 0.014 : 0;
            label(ctx, str(it.title), { x, y: titleY, size: u * 0.025, weight: 600, max: titleMax, parent: r });
            if (it.badge) {
              const bw = textWidth(str(it.badge), u * 0.016, 600, ctx.fonts.family.text) + u * 0.022, tx = x + Math.min(titleMax, textWidth(str(it.title), u * 0.025, 600, ctx.fonts.family.text)) + u * 0.014;
              ctx.c.add('badge', { type: 'shape.rect', transform: { position: v2(tx + bw / 2, titleY) }, props: { size: v2(bw, u * 0.03), radius: px(u * 0.015), fill: tint(ctx, '@accent', 0.2) } }, r);
              label(ctx, str(it.badge), { x: tx + bw / 2, y: titleY, size: u * 0.016, weight: 600, color: '@accent2', align: 'center', max: bw, parent: r });
            }
            if (it.sub) label(ctx, str(it.sub), { x, y: u * 0.016, size: u * 0.019, color: '@ink2', max: titleMax, parent: r });
            if (it.value) counter(ctx, str(it.value), { x: R, y: it.delta ? -u * 0.014 : 0, size: u * 0.025, weight: 600, align: 'right', at: t + 0.15, parent: r });
            if (it.delta) label(ctx, str(it.delta), { x: R, y: it.value ? u * 0.016 : 0, size: u * 0.019, weight: 560, color: tone(str(it.delta)), align: 'right', max: inner * 0.3, parent: r });
            if (k < items.length - 1 && items[k + 1].kind === 'row') ctx.c.add('divider', { type: 'shape.rect', transform: { position: v2(0, ih / 2) }, props: { size: v2(inner, Math.max(1, u * 0.001)), fill: '@line' } }, r);
            break;
          }
          case 'stats': {
            const list = (Array.isArray(it.items) ? it.items : []) as { label?: string; value?: string }[];
            const cw = inner / Math.max(1, list.length);
            list.forEach((s, j) => {
              const cx = L + cw * j + u * 0.004;
              label(ctx, str(s.label), { x: cx, y: -u * 0.022, size: u * 0.018, color: '@ink2', max: cw - u * 0.02, parent: r });
              counter(ctx, str(s.value), { x: cx, y: u * 0.018, size: u * 0.036, weight: ctx.style.display.strong, at: t + 0.1 + j * 0.08, d: 1.2, role: 'display', parent: r });
            });
            break;
          }
          case 'chart': {
            const data = (Array.isArray(it.data) ? it.data : []).filter((x): x is number => typeof x === 'number');
            const hasHead = !!(it.label || it.value);
            if (hasHead) {
              if (it.label) label(ctx, str(it.label), { x: L, y: -ih / 2 + u * 0.03, size: u * 0.019, color: '@ink2', max: inner * 0.5, parent: r });
              if (it.value) counter(ctx, str(it.value), { x: L, y: -ih / 2 + u * 0.068, size: u * 0.036, weight: ctx.style.display.strong, at: t + 0.1, role: 'display', parent: r });
              if (it.delta) label(ctx, str(it.delta), { x: R, y: -ih / 2 + u * 0.068, size: u * 0.021, weight: 600, color: tone(str(it.delta)), align: 'right', max: inner * 0.3, parent: r });
            }
            const chartH = ih - (hasHead ? u * 0.11 : u * 0.03);
            if (data.length > 1) lineChart(ctx, data, { x: 0, y: ih / 2 - chartH / 2 - u * 0.012, w: inner, h: chartH, at: t + 0.2, d: Math.max(1.2, ctx.dur * 0.45), parent: r });
            done = Math.max(done, t + 0.2 + Math.max(1.2, ctx.dur * 0.45));
            break;
          }
          case 'input': {
            const fh = u * 0.056, text = str(it.text);
            ctx.c.add('field', { type: 'shape.rect', props: { size: v2(inner, fh), radius: px(fh * 0.3), fill: ctx.style.mode === 'dark' ? '#FFFFFF0A' : '#0D10170A', stroke: '@cardLine', strokeWidth: px(u * 0.0012) } }, r);
            icon(ctx, str(it.icon, 'search'), { x: L + fh * 0.5, y: 0, size: fh * 0.42, color: '@ink2', parent: r });
            const tt = t + 0.35, rate = 16;
            ctx.c.add('typed', {
              type: 'text', name: text,
              transform: { position: v2(L + fh * 0.95, 0) },
              props: { text: { $expr: `${JSON.stringify(text)}.slice(0, Math.max(0, Math.floor((t - ${sec(tt)}) * ${rate})))` }, font: ctx.fonts.text, size: px(u * 0.022), weight: 480, color: '@ink', align: 'left', baseline: 'middle' },
            }, r);
            // the caret, blinking after the typed text
            const end = tt + text.length / rate, cw = textWidth(text, u * 0.022, 480, ctx.fonts.family.text);
            ctx.c.add('caret', { type: 'shape.rect', transform: { position: keys([tt, v2(L + fh * 0.95 + u * 0.004, 0)], [end, v2(L + fh * 0.95 + cw + u * 0.004, 0)]), opacity: { $expr: 'Math.floor(t * 2.4) % 2 ? 0.15 : 1' } }, props: { size: v2(Math.max(1.5, u * 0.0018), u * 0.028), fill: '@accent2' } }, r);
            done = Math.max(done, end);
            break;
          }
          case 'button': {
            const bh = u * 0.062, at = o.press ?? (o.at + ctx.dur * 0.62);
            press = at;
            ctx.cues.push({ t: at, kind: 'click' });
            ctx.c.group('button', { transform: { scale: keys([at - 0.08, [1, 1], '@standard'], [at, [0.95, 0.95], '@pop'], [at + 0.35, [1, 1]]) } }, (b) => {
              ctx.c.add('fill', {
                type: 'shape.rect', props: { size: v2(inner, bh), radius: px(bh * 0.28), fill: { type: 'linear', from: [px(-inner / 2), 0], to: [px(inner / 2), 0], stops: [[0, '@accent'], [1, '@accent2']] } },
                effects: [{ id: 'glow', type: 'fx.glow', props: { color: tint(ctx, '@accent', 0.53), radius: keys([at - 0.05, px(u * 0.012)], [at + 0.05, px(u * 0.04), '@enter'], [at + 0.7, px(u * 0.012)]), strength: 1 } }],
              }, b);
              const label2 = str(it.text, 'Continue'), lw = textWidth(label2, u * 0.024, 620, ctx.fonts.family.text);
              const ic = it.icon && ICONS[str(it.icon)] ? u * 0.03 : 0;
              if (ic) icon(ctx, str(it.icon), { x: -(lw + ic + u * 0.012) / 2 + ic / 2, y: 0, size: ic, color: '#FFFFFF', width: 2, parent: b });
              label(ctx, label2, { x: ic ? -(lw + ic + u * 0.012) / 2 + ic + u * 0.012 + lw / 2 : 0, y: 0, size: u * 0.024, weight: 620, color: '#FFFFFF', align: 'center', max: inner, parent: b });
            }, r);
            done = Math.max(done, at + 0.4);
            break;
          }
          case 'tabs': {
            const list = (Array.isArray(it.items) ? it.items : []).map((x) => str(x));
            const active = typeof it.active === 'number' ? it.active : 0, tw = inner / Math.max(1, list.length);
            ctx.c.add('track', { type: 'shape.rect', props: { size: v2(inner, u * 0.048), radius: px(u * 0.014), fill: ctx.style.mode === 'dark' ? '#FFFFFF0A' : '#0D10170A' } }, r);
            ctx.c.add('selected', { type: 'shape.rect', transform: { position: keys([t + 0.3, v2(L + tw / 2, 0), '@standard'], [t + 0.75, v2(L + tw * (active + 0.5), 0)]) }, props: { size: v2(tw - u * 0.008, u * 0.04), radius: px(u * 0.011), fill: ctx.style.mode === 'dark' ? '#FFFFFF1A' : '#FFFFFF' } }, r);
            list.forEach((s, j) => label(ctx, s, { x: L + tw * (j + 0.5), y: 0, size: u * 0.019, weight: 560, color: j === active ? '@ink' : '@ink2', align: 'center', max: tw - u * 0.01, parent: r }));
            break;
          }
          case 'progress': {
            const value = Math.max(0, Math.min(1, typeof it.value === 'number' ? it.value : 0.7));
            label(ctx, str(it.label), { x: L, y: -u * 0.016, size: u * 0.019, color: '@ink2', max: inner * 0.7, parent: r });
            label(ctx, `${Math.round(value * 100)}%`, { x: R, y: -u * 0.016, size: u * 0.019, weight: 600, align: 'right', max: inner * 0.3, parent: r });
            ctx.c.add('rail', { type: 'shape.rect', transform: { position: v2(0, u * 0.016) }, props: { size: v2(inner, u * 0.01), radius: px(u * 0.005), fill: '@line' } }, r);
            ctx.c.add('fill', { type: 'shape.rect', transform: { anchor: v2(-inner / 2, 0), position: v2(L, u * 0.016), scale: keys([t + 0.3, [0, 1], '@standard'], [t + 1.6, [value, 1]]) }, props: { size: v2(inner, u * 0.01), radius: px(u * 0.005), fill: '@accent' } }, r);
            break;
          }
          case 'chat': {
            const me = str(it.from, 'them') === 'me', size = u * 0.022, lines = bubbleLines(ctx, str(it.text), inner);
            const bw = Math.max(...lines.map((l) => textWidth(l, size, ctx.style.text.regular, ctx.fonts.family.text))) + u * 0.044;
            const bx = me ? R - bw / 2 : L + bw / 2;
            ctx.c.add('bubble', { type: 'shape.rect', transform: { position: v2(bx, 0) }, props: { size: v2(bw, ih - u * 0.02), radius: px(Math.min(u * 0.022, (ih - u * 0.02) / 2)), fill: me ? '@accent' : (ctx.style.mode === 'dark' ? '#FFFFFF12' : '#0D10170D') } }, r);
            paragraph(ctx, lines, { x: bx - bw / 2 + u * 0.022, y: 0, size, color: me ? '#FFFFFF' : '@ink', parent: r });
            break;
          }
          case 'text':
            paragraph(ctx, wrap(str(it.text), inner, u * 0.022, ctx.style.text.regular, ctx.fonts.family.text), { x: L, y: 0, size: u * 0.022, color: '@ink2', parent: r });
            break;
        }
      }, g);
      done = Math.max(done, t + 0.6);
      y += ih;
    });
    if (toast) {
      const at = o.toastAt ?? (alone ? o.at + 0.15 : press !== undefined ? press + 0.35 : o.at + ctx.dur * 0.6), ty = alone ? 0 : -h / 2 - tgap - th / 2;
      ctx.cues.push({ t: at + 0.05, kind: 'pop' });
      const tw = Math.min(o.w * 0.92, textWidth(str(toast.text), u * 0.023, 560, ctx.fonts.family.text) + u * 0.2);
      // above the panel, dropping into place
      ctx.c.group('toast', { transform: { position: keys([at, v2(0, ty - th * 0.5), '@pop'], [at + 0.5, v2(0, ty)]), scale: grow(at, 0.86, 1, 0.5, '@pop'), opacity: fadeIn(at, 0.2) } }, (tg) => {
        card(ctx, 'Toast', { x: 0, y: 0, w: tw, h: th, radius: th * 0.3, parent: tg });
        icon(ctx, str(toast.icon, 'check'), { x: -tw / 2 + th * 0.5, y: 0, size: th * 0.36, color: '@good', width: 2.2, parent: tg });
        label(ctx, str(toast.text), { x: -tw / 2 + th * 0.85, y: 0, size: u * 0.023, weight: 560, max: tw * 0.6, parent: tg });
        if (toast.value) label(ctx, str(toast.value), { x: tw / 2 - th * 0.4, y: 0, size: u * 0.021, weight: 560, color: '@accent2', align: 'right', role: 'mono', max: tw * 0.3, parent: tg });
      }, g);
      done = Math.max(done, at + 0.5);
    }
  }, o.parent);
  return { id, w: o.w * k, h: (h + lift) * k, rows, done, press };
}
