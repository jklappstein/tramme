// Where a scene's elements stand. A layout cuts the frame into regions (a
// column of words, a place for what is shown), each region stacks its
// elements at the heights they want, shrinks what is shown when it does not
// fit, and centres the whole. Margins grow with the camera's move, so nothing
// leaves the frame by the end of the scene. Tall formats stack what wide ones
// set side by side.

import { wordCount, type Ctx } from './build.ts';
import { along, ELEMENT_RENDER, roleOf, type Align, type Box } from './elements.ts';
import type { ElementSpec, SceneSpec } from './spec.ts';
import { lineHeightOf, lineWidth, roleSize, textHeight, type Role, type Size } from './text.ts';

export interface Slot { el: ElementSpec; box: Box; align: Align; text: boolean; role: Role; size?: Size; px?: number }

interface Region { x0: number; x1: number; y0: number; y1: number; align: Align; valign?: 'top' | 'middle' | 'bottom' }

/** the frame inside its margins, as it stays visible through the camera's move */
function area(ctx: Ctx) {
  const { W, H, vertical } = ctx, mx = W * (vertical ? 0.08 : 0.07), my = H * (vertical ? 0.07 : 0.09);
  const half = (len: number, m: number) => (len / 2 - m) / ctx.grow;
  return { x0: W / 2 - half(W, mx), x1: W / 2 + half(W, mx), y0: H / 2 - half(H, my), y1: H / 2 + half(H, my) };
}

/** the regions of a layout: words, and what is shown; few words leave the more room to what is shown */
function regions(ctx: Ctx, layout: string, flip: boolean, hasVisual: boolean, words: number): { words: Region; shown: Region } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const a = area(ctx), w = a.x1 - a.x0, h = a.y1 - a.y0, tall = ctx.vertical || ctx.H / ctx.W > 0.9;
  const col = (from: number, to: number, align: Align, y0 = a.y0, y1 = a.y1, valign?: Region['valign']): Region => ({ x0: a.x0 + w * from, x1: a.x0 + w * to, y0, y1, align, valign });
  const rows = (from: number, to: number, align: Align, valign?: Region['valign']): Region => ({ x0: a.x0, x1: a.x1, y0: a.y0 + h * from, y1: a.y0 + h * to, align, valign });
  switch (layout) {
    case 'left': case 'right': case 'split': {
      if (tall) {
        const top = hasVisual ? clamp(0.2 + words * 0.012, 0.26, 0.38) : 1;
        return { words: rows(0, top, layout === 'right' ? 'right' : 'left', hasVisual ? 'bottom' : 'middle'), shown: rows(top + 0.05, 1, 'center') };
      }
      // the words on their side (the right one for `right`, the other when flipped), what is shown across from them
      const share = hasVisual ? (layout === 'split' ? 0.44 : clamp(0.32 + words * 0.012, 0.38, 0.5)) : 0.62, onLeft = layout === 'right' ? flip : !flip;
      return onLeft
        ? { words: col(0, share, 'left'), shown: col(share + 0.06, 1, 'center') }
        : { words: col(1 - share, 1, hasVisual ? 'left' : 'right'), shown: col(0, 1 - share - 0.06, 'center') };
    }
    case 'poster': {
      // the words across the frame (from the right when flipped), a visual tucked low in the other corner
      const side: Align = flip ? 'right' : 'left';
      if (!hasVisual) return { words: col(0, 1, side), shown: col(0, 1, side) };
      return tall
        ? { words: rows(0, 0.58, side, 'bottom'), shown: rows(0.62, 1, 'center') }
        : { words: col(0, 1, side, a.y0, a.y0 + h * 0.56, 'bottom'), shown: flip ? col(0, 0.4, 'center', a.y0 + h * 0.6, a.y1) : col(0.6, 1, 'center', a.y0 + h * 0.6, a.y1) };
    }
    case 'grid':
      return { words: rows(0, tall ? 0.24 : 0.28, 'center', 'bottom'), shown: rows(tall ? 0.28 : 0.33, 1, 'center') };
    case 'full':
      return { words: rows(0, tall ? 0.16 : 0.14, 'left', 'top'), shown: rows(tall ? 0.18 : 0.16, 1, 'center') };
    case 'corner':
      return { words: tall ? rows(0.74, 1, 'left', 'bottom') : col(0, 0.46, 'left', a.y0 + h * 0.74, a.y1, 'bottom'), shown: tall ? rows(0, 0.7, 'center') : rows(0, 0.72, 'center') };
    default:
      return { words: rows(0, 1, 'center'), shown: rows(0, 1, 'center') };
  }
}

/**
 * The slots of a scene: each element with its box. Words and shown things
 * share one column when the layout is centred, and stand in their own
 * regions otherwise.
 */
export function layout(ctx: Ctx, scene: SceneSpec): Slot[] {
  const name = scene.layout ?? 'center', els = scene.elements, roles = rolesOf(els);
  const hasVisual = els.some((e) => e.type !== 'text'), shared = name === 'center' || !hasVisual && name !== 'poster';
  const count = els.reduce((n, e) => n + (e.type === 'text' ? wordCount(e.text) : 0), 0);
  const { words, shown } = regions(ctx, name, !!scene.flip, hasVisual, count);
  const parts = els.map((el, i) => {
    const text = el.type === 'text', role = roles[i];
    const size: Size | undefined = text ? (el.size as Size | undefined) ?? (name === 'poster' && role === 'headline' ? 'xxl' : name === 'full' && role === 'headline' ? 'm' : undefined) : undefined;
    // a poster's short headline grows to fill its width
    const px = text && name === 'poster' && role === 'headline' && !el.size ? posterSize(ctx, String(el.text ?? ''), words) : undefined;
    return { el, text, role, size, px };
  });
  const groups: { region: Region; items: typeof parts }[] = shared ? [{ region: words, items: parts }] : [{ region: words, items: parts.filter((p) => p.text) }, { region: shown, items: parts.filter((p) => !p.text) }];
  const slots: Slot[] = [];
  for (const { region, items } of groups) {
    if (!items.length) continue;
    const w = region.x1 - region.x0, room = region.y1 - region.y0, u = ctx.u;
    // in a grid, several things shown share the region in cells
    if (name === 'grid' && !items[0].text && items.length > 1) {
      const n = items.length, cols = ctx.vertical ? 1 : Math.min(n, 3), rows = Math.ceil(n / cols), cw = (w - u * 0.03 * (cols - 1)) / cols, ch = (room - u * 0.03 * (rows - 1)) / rows;
      items.forEach((p, i) => slots.push({ el: p.el, text: false, role: p.role, align: 'center', box: { x: region.x0 + cw / 2 + (i % cols) * (cw + u * 0.03), y: region.y0 + ch / 2 + Math.floor(i / cols) * (ch + u * 0.03), w: cw, h: ch } }));
      continue;
    }
    const textW = Math.min(w, ctx.W * (ctx.vertical ? 0.86 : name === 'poster' ? 0.92 : 0.8));
    const want = items.map((p) => (p.text
      ? textHeight(ctx, { text: String(p.el.text ?? ''), role: p.role, size: p.size, px: p.px, max: textW, swap: p.el.treatment === 'swap' && Array.isArray(p.el.swap) ? p.el.swap as string[] : undefined })
      : Math.min(room, ELEMENT_RENDER[p.el.type]?.[1](ctx, p.el, Math.min(w, shownWidth(ctx, p.el.type, w))) ?? room * 0.5)));
    const gaps = items.map((p, i) => (i === 0 ? 0 : p.text && items[i - 1].text ? (items[i - 1].role === 'kicker' ? u * 0.02 : u * 0.03) : u * 0.055));
    const textH = want.reduce((s, h, i) => s + (items[i].text ? h : 0), 0), shownH = want.reduce((s, h, i) => s + (items[i].text ? 0 : h), 0);
    const gapH = gaps.reduce((a, b) => a + b, 0);
    // what is shown gives way first when the region is too short
    const k = shownH > 0 ? Math.max(0.35, Math.min(1, (room - textH - gapH) / shownH)) : 1;
    const heights = want.map((h, i) => (items[i].text ? h : h * k));
    const total = heights.reduce((a, b) => a + b, 0) + gapH;
    const shown = items.filter((p) => !p.text).map((p) => p.el.type).join(' and ');
    if (k < 0.75) ctx.notes.push(`the ${shown} drawn at ${Math.round(k * 100)}% to fit${textH ? ' beside the words' : ''}: fewer words, or a layout that gives it the frame (full, corner)`);
    if (total > room * 1.04) ctx.notes.push(`more than the frame holds (${Math.round((total / room) * 100)}% of its height): fewer elements, or split the scene`);
    let y = region.valign === 'top' ? region.y0 : region.valign === 'bottom' ? region.y1 - total : (region.y0 + region.y1) / 2 - total / 2;
    items.forEach((p, i) => {
      y += gaps[i];
      const h = heights[i], bw = p.text ? textW : Math.min(w, shownWidth(ctx, p.el.type, w));
      const x = along({ x: (region.x0 + region.x1) / 2, y: 0, w: region.x1 - region.x0, h: 0 }, bw, region.align);
      slots.push({ el: p.el, text: p.text, role: p.role, size: p.size, px: p.px, align: region.align, box: { x, y: y + h / 2, w: bw, h } });
      y += h;
    });
  }
  // back in the order the scene wrote them: the order they enter
  return els.map((el) => slots.find((s) => s.el === el)!).filter(Boolean);
}

/** a poster's headline set to fill the width of its region (and no taller than it), when its lines are short enough: four words at most */
function posterSize(ctx: Ctx, text: string, r: Region): number | undefined {
  const lines = text.split('\n');
  if (lines.some((l) => wordCount(l) > 4)) return undefined;
  const base = roleSize(ctx, 'headline', 'xxl');
  const fill = (base * (r.x1 - r.x0) * 0.97) / lineWidth(ctx, text, 'headline', base);
  const tallest = ((r.y1 - r.y0) * 0.8) / (lines.length * lineHeightOf(ctx, 'headline'));
  return Math.max(base, Math.min(fill, tallest, ctx.u * 0.5));
}

/** the role of each element of a scene: its first text is the headline (a kicker may stand over it), the texts after it are body */
export function rolesOf(els: ElementSpec[]): Role[] {
  let first = true;
  return els.map((el) => {
    if (el.type !== 'text') return 'body';
    const role = roleOf(el, first) as Role;
    if (role !== 'kicker') first = false;
    return role;
  });
}

/** how wide a shown thing is drawn in a region `w` wide: a phone stays narrow, a figure takes its room */
function shownWidth(ctx: Ctx, type: string, w: number): number {
  const u = ctx.u;
  switch (type) {
    case 'ui': return Math.min(w, u * (ctx.vertical ? 0.95 : 1.05));
    case 'button': return Math.min(w, u * 0.8);
    case 'logo': return Math.min(w, u * 1.2);
    case 'quote': return Math.min(w, ctx.W * (ctx.vertical ? 0.86 : 0.72));
    case 'code': return Math.min(w, u * 1.1);
    case 'motif': return Math.min(w, u * 0.7);
    default: return w;
  }
}
