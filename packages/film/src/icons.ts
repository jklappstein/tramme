// A small set of line icons, drawn on a 24 px grid with plain shapes (lines,
// polygons, circles, rounded rectangles, arcs) and turned into ordinary
// layers: a group of strokes the user can recolour or reshape.

import type { Layer, Vec2 } from '@tramme/core';
import { px, v2, type Ctx } from './build.ts';

interface Icon {
  /** open polylines: x1, y1, x2, y2, … */
  lines?: number[][];
  /** closed polygons */
  shapes?: number[][];
  circles?: [cx: number, cy: number, r: number][];
  rects?: [x: number, y: number, w: number, h: number, r: number][];
  /** arcs: centre, radius, start and end angles (degrees, clockwise from the right) */
  arcs?: [cx: number, cy: number, r: number, a0: number, a1: number][];
  /** filled dots */
  dots?: [cx: number, cy: number, r: number][];
}

export const ICONS: Record<string, Icon> = {
  check: { lines: [[5, 12.5, 10, 17.5, 19, 7]] },
  x: { lines: [[6, 6, 18, 18], [18, 6, 6, 18]] },
  plus: { lines: [[12, 5, 12, 19], [5, 12, 19, 12]] },
  minus: { lines: [[5, 12, 19, 12]] },
  'arrow-right': { lines: [[4, 12, 20, 12], [14, 6, 20, 12, 14, 18]] },
  'arrow-up-right': { lines: [[7, 17, 17, 7], [8, 7, 17, 7, 17, 16]] },
  'arrow-down': { lines: [[12, 4, 12, 20], [6, 14, 12, 20, 18, 14]] },
  'trend-up': { lines: [[3, 17, 9, 11, 13, 15, 21, 7], [15, 7, 21, 7, 21, 13]] },
  'trend-down': { lines: [[3, 7, 9, 13, 13, 9, 21, 17], [15, 17, 21, 17, 21, 11]] },
  bolt: { shapes: [[13, 2, 4, 14, 11, 14, 10, 22, 20, 9, 13, 9]] },
  search: { circles: [[10.5, 10.5, 6.5]], lines: [[15.5, 15.5, 20.5, 20.5]] },
  wallet: { rects: [[3, 6, 18, 13, 3]], lines: [[3, 10, 21, 10]], dots: [[16.5, 14.5, 1.2]] },
  card: { rects: [[2.5, 5.5, 19, 13, 2.5]], lines: [[2.5, 10, 21.5, 10], [6, 15, 10, 15]] },
  bank: { lines: [[3, 10, 12, 4, 21, 10], [5, 10, 5, 18], [9.5, 10, 9.5, 18], [14.5, 10, 14.5, 18], [19, 10, 19, 18], [3, 20, 21, 20]] },
  chart: { lines: [[4, 4, 4, 20, 20, 20], [7, 15, 11, 11, 14, 13, 19, 7]] },
  bars: { lines: [[6, 20, 6, 13], [12, 20, 12, 7], [18, 20, 18, 11], [3, 20, 21, 20]] },
  pie: { arcs: [[12, 12, 8.5, -90, 270]], lines: [[12, 3.5, 12, 12, 20.5, 12]] },
  lock: { rects: [[5, 11, 14, 9.5, 2.5]], arcs: [[12, 8, 4, 180, 360]], lines: [[8, 8, 8, 11], [16, 8, 16, 11]] },
  shield: { shapes: [[12, 3, 19.5, 6, 19.5, 12, 12, 21, 4.5, 12, 4.5, 6]], lines: [[8.5, 12, 11, 14.5, 15.5, 9.5]] },
  star: { shapes: [[12, 3, 14.6, 8.6, 20.6, 9.2, 16.1, 13.2, 17.4, 19.2, 12, 16.1, 6.6, 19.2, 7.9, 13.2, 3.4, 9.2, 9.4, 8.6]] },
  heart: { arcs: [[8.2, 9, 4, 135, 360], [15.8, 9, 4, 180, 405]], lines: [[5.4, 11.8, 12, 19, 18.6, 11.8]] },
  bell: { lines: [[6, 16.5, 6, 11], [18, 11, 18, 16.5], [4.5, 16.5, 19.5, 16.5], [10, 19.5, 14, 19.5]], arcs: [[12, 11, 6, 180, 360]] },
  user: { circles: [[12, 8, 4]], arcs: [[12, 21, 7.5, 200, 340]] },
  users: { circles: [[9, 8.5, 3.5], [16.5, 9.5, 2.8]], arcs: [[9, 21, 6.5, 200, 340], [17, 20, 5, 220, 330]] },
  globe: { circles: [[12, 12, 9]], lines: [[3, 12, 21, 12]], arcs: [[12, 12, 4, 270, 450], [12, 12, 4, 90, 270]] },
  clock: { circles: [[12, 12, 9]], lines: [[12, 7, 12, 12, 15.5, 14]] },
  calendar: { rects: [[3.5, 5, 17, 15.5, 2.5]], lines: [[3.5, 10, 20.5, 10], [8, 3, 8, 7], [16, 3, 16, 7]] },
  link: { arcs: [[8.5, 15.5, 3.5, 45, 225], [15.5, 8.5, 3.5, 225, 405]], lines: [[9, 15, 15, 9]] },
  sparkle: { shapes: [[12, 3, 13.8, 10.2, 21, 12, 13.8, 13.8, 12, 21, 10.2, 13.8, 3, 12, 10.2, 10.2]] },
  rocket: { shapes: [[12, 2.5, 16, 7.5, 16, 15, 8, 15, 8, 7.5]], lines: [[8, 12, 5, 15, 5, 18, 8, 16.5], [16, 12, 19, 15, 19, 18, 16, 16.5], [10.5, 18, 12, 21, 13.5, 18]], circles: [[12, 9, 1.6]] },
  chat: { shapes: [[4, 5, 20, 5, 20, 16, 11, 16, 6.5, 19.5, 7, 16, 4, 16]] },
  mail: { rects: [[3, 5.5, 18, 13, 2]], lines: [[3.5, 7, 12, 13, 20.5, 7]] },
  cloud: { arcs: [[8, 14, 4, 90, 270], [12.5, 10, 5, 190, 340], [17, 14, 3.5, 270, 450]], lines: [[8, 18, 17, 18]] },
  code: { lines: [[8, 7, 3, 12, 8, 17], [16, 7, 21, 12, 16, 17], [14, 4.5, 10, 19.5]] },
  terminal: { rects: [[2.5, 4, 19, 16, 2.5]], lines: [[6.5, 9, 9.5, 12, 6.5, 15], [11.5, 15.5, 17, 15.5]] },
  play: { shapes: [[7.5, 4.5, 19, 12, 7.5, 19.5]] },
  pin: { arcs: [[12, 9.5, 6, 150, 390]], lines: [[6.8, 12.5, 12, 21, 17.2, 12.5]], circles: [[12, 9.5, 2.2]] },
  file: { shapes: [[6, 3, 14, 3, 19, 8, 19, 21, 6, 21]], lines: [[14, 3, 14, 8, 19, 8], [9, 13, 16, 13], [9, 17, 14, 17]] },
  folder: { shapes: [[3, 6, 9.5, 6, 11.5, 8.5, 21, 8.5, 21, 19, 3, 19]] },
  download: { lines: [[12, 4, 12, 15], [7, 10, 12, 15, 17, 10], [4, 19.5, 20, 19.5]] },
  upload: { lines: [[12, 15, 12, 4], [7, 9, 12, 4, 17, 9], [4, 19.5, 20, 19.5]] },
  refresh: { arcs: [[12, 12, 7.5, 200, 470]], lines: [[4.5, 5.5, 5, 10, 9.5, 9.5]] },
  layers: { shapes: [[12, 4, 21, 9, 12, 14, 3, 9]], lines: [[3, 13, 12, 18, 21, 13]] },
  home: { lines: [[3, 11, 12, 3.5, 21, 11], [5.5, 9.5, 5.5, 20, 18.5, 20, 18.5, 9.5]], rects: [[10, 14, 4, 6, 0.5]] },
  phone: { rects: [[6.5, 2.5, 11, 19, 2.5]], lines: [[10.5, 18, 13.5, 18]] },
  monitor: { rects: [[2.5, 4, 19, 12.5, 2]], lines: [[12, 16.5, 12, 20], [8, 20, 16, 20]] },
  cart: { lines: [[2.5, 4, 5.5, 4, 8, 16, 18.5, 16, 20.5, 7.5, 6.5, 7.5]], circles: [[9, 19.5, 1.4], [17.5, 19.5, 1.4]] },
  tag: { shapes: [[3, 3, 11.5, 3, 21, 12.5, 12.5, 21, 3, 11.5]], circles: [[7.5, 7.5, 1.5]] },
  gift: { rects: [[3.5, 8, 17, 4, 1], [5, 12, 14, 9, 1]], lines: [[12, 8, 12, 21]], arcs: [[9.5, 6, 2.2, 90, 360], [14.5, 6, 2.2, 180, 450]] },
  target: { circles: [[12, 12, 9], [12, 12, 5]], dots: [[12, 12, 1.6]] },
  eye: { arcs: [[12, 19, 10.5, 222, 318], [12, 5, 10.5, 42, 138]], circles: [[12, 12, 3]] },
  coin: { circles: [[12, 12, 9]], lines: [[12, 6.5, 12, 17.5], [14.5, 9, 10.5, 9, 9.5, 10.5, 10.5, 12, 13.5, 12, 14.5, 13.5, 13.5, 15, 9.5, 15]] },
  percent: { lines: [[18, 6, 6, 18]], circles: [[7.5, 7.5, 2.5], [16.5, 16.5, 2.5]] },
  flag: { lines: [[5, 21, 5, 4]], shapes: [[5, 4, 19, 4, 16, 8.5, 19, 13, 5, 13]] },
  trophy: { lines: [[8, 4, 16, 4, 16, 10], [8, 4, 8, 10], [12, 15, 12, 18.5], [8, 20, 16, 20], [8, 6, 4.5, 6, 4.5, 8, 8, 11], [16, 6, 19.5, 6, 19.5, 8, 16, 11]], arcs: [[12, 10, 4, 0, 180]] },
  sliders: { lines: [[4, 7, 20, 7], [4, 12, 20, 12], [4, 17, 20, 17]], dots: [[9, 7, 2], [15.5, 12, 2], [7.5, 17, 2]] },
  zap: { shapes: [[13, 2, 4, 14, 11, 14, 10, 22, 20, 9, 13, 9]] },
  infinity: { arcs: [[7.5, 12, 4, 0, 360], [16.5, 12, 4, 0, 360]] },
  wifi: { arcs: [[12, 19, 13, 225, 315], [12, 19, 8.5, 230, 310], [12, 19, 4, 235, 305]], dots: [[12, 19, 1.3]] },
  battery: { rects: [[2.5, 7.5, 17, 9, 2], [5, 10, 8, 4, 0.8]], lines: [[21.5, 10.5, 21.5, 13.5]] },
  music: { lines: [[9, 18, 9, 5.5, 19, 3.5, 19, 16]], circles: [[6.5, 18, 2.5], [16.5, 16, 2.5]] },
  palette: { circles: [[12, 12, 9]], dots: [[8, 9.5, 1.4], [12, 7, 1.4], [16, 9.5, 1.4], [8.5, 14.5, 1.4]] },
  image: { rects: [[3, 5, 18, 14, 2]], lines: [[3, 16, 9, 10.5, 14, 15, 17, 12.5, 21, 16]], circles: [[15.5, 9, 1.6]] },
  video: { rects: [[2.5, 6, 13, 12, 2]], shapes: [[15.5, 10, 21.5, 7, 21.5, 17, 15.5, 14]] },
  pen: { shapes: [[16, 3.5, 20.5, 8, 9, 19.5, 3.5, 20.5, 4.5, 15]], lines: [[13.5, 6, 18, 10.5]] },
  camera: { rects: [[2.5, 7, 19, 13, 2.5]], lines: [[8, 7, 9.5, 4.5, 14.5, 4.5, 16, 7]], circles: [[12, 13.5, 3.5]] },
  mic: { rects: [[9, 3, 6, 11, 3]], arcs: [[12, 11, 6, 0, 180]], lines: [[12, 17, 12, 21], [8.5, 21, 15.5, 21]] },
  wand: { lines: [[4, 20, 14.5, 9.5]], shapes: [[17, 3, 17.9, 6.1, 21, 7, 17.9, 7.9, 17, 11, 16.1, 7.9, 13, 7, 16.1, 6.1]] },
  type: { lines: [[5, 6.5, 5, 4, 19, 4, 19, 6.5], [12, 4, 12, 20], [9, 20, 15, 20]] },
  film: { rects: [[3, 3, 18, 18, 2]], lines: [[7.5, 3, 7.5, 21], [16.5, 3, 16.5, 21], [3, 8, 7.5, 8], [3, 12, 7.5, 12], [3, 16, 7.5, 16], [16.5, 8, 21, 8], [16.5, 12, 21, 12], [16.5, 16, 21, 16]] },
  grid: { rects: [[3.5, 3.5, 7, 7, 1.5], [13.5, 3.5, 7, 7, 1.5], [3.5, 13.5, 7, 7, 1.5], [13.5, 13.5, 7, 7, 1.5]] },
  book: { shapes: [[3.5, 5, 11, 6.5, 11, 20, 3.5, 18.5], [20.5, 5, 13, 6.5, 13, 20, 20.5, 18.5]] },
  sun: { circles: [[12, 12, 4]], lines: [[12, 2.5, 12, 5], [12, 19, 12, 21.5], [2.5, 12, 5, 12], [19, 12, 21.5, 12], [5.3, 5.3, 7, 7], [17, 17, 18.7, 18.7], [5.3, 18.7, 7, 17], [17, 7, 18.7, 5.3]] },
  chip: { rects: [[6, 6, 12, 12, 2], [9.5, 9.5, 5, 5, 1]], lines: [[9.5, 3, 9.5, 6], [14.5, 3, 14.5, 6], [9.5, 18, 9.5, 21], [14.5, 18, 14.5, 21], [3, 9.5, 6, 9.5], [3, 14.5, 6, 14.5], [18, 9.5, 21, 9.5], [18, 14.5, 21, 14.5]] },
  server: { rects: [[3, 4, 18, 7, 2], [3, 13, 18, 7, 2]], dots: [[7, 7.5, 1.1], [7, 16.5, 1.1]] },
};

const at = (x: number, y: number): Vec2 => [px(x - 12), px(y - 12)];

/** an arc as cubic segments of 90° at most, in the path's form (relative tangents) */
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 90)), step = (a1 - a0) / n;
  const k = (4 / 3) * Math.tan((step * Math.PI) / 720);
  const v: Vec2[] = [], i: Vec2[] = [], o: Vec2[] = [];
  for (let s = 0; s <= n; s++) {
    const a = ((a0 + s * step) * Math.PI) / 180, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    // the tangent along the arc, scaled for a cubic of that sweep
    const tx = -Math.sin(a) * r * k, ty = Math.cos(a) * r * k;
    v.push(at(x, y)); i.push([px(-tx), px(-ty)]); o.push([px(tx), px(ty)]);
  }
  i[0] = [0, 0]; o[n] = [0, 0];
  return { v, i, o, closed: false };
}

const pts = (xs: number[]) => Array.from({ length: xs.length / 2 }, (_, j) => at(xs[2 * j], xs[2 * j + 1]));

/** the icon as a group of stroked shapes, `size` px wide, centred at (x, y) */
export function icon(ctx: Ctx, name: string, o: { x: number; y: number; size: number; color: string; width?: number; parent?: string; transform?: Layer['transform'] }): string {
  const ic = ICONS[name] ?? ICONS.sparkle;
  const s = o.size / 24, sw = o.width ?? 1.8;
  const stroke = { fill: null, stroke: o.color, strokeWidth: sw, lineCap: 'round', lineJoin: 'round' };
  return ctx.c.group(`icon-${name}`, { name: `Icon · ${name}`, transform: { position: v2(o.x, o.y), scale: [px(s * 100) / 100, px(s * 100) / 100], ...o.transform } }, (g) => {
    for (const l of ic.lines ?? []) ctx.c.add('stroke', { type: 'shape.path', props: { ...stroke, path: { v: pts(l), closed: false } } }, g);
    for (const l of ic.shapes ?? []) ctx.c.add('shape', { type: 'shape.path', props: { ...stroke, path: { v: pts(l), closed: true } } }, g);
    for (const [cx, cy, r] of ic.circles ?? []) ctx.c.add('circle', { type: 'shape.ellipse', transform: { position: at(cx, cy) }, props: { size: [r * 2, r * 2], fill: null, stroke: o.color, strokeWidth: sw } }, g);
    for (const [x, y, w, h, r] of ic.rects ?? []) ctx.c.add('frame', { type: 'shape.rect', transform: { position: at(x + w / 2, y + h / 2) }, props: { size: [w, h], radius: r, fill: null, stroke: o.color, strokeWidth: sw } }, g);
    for (const [cx, cy, r, a0, a1] of ic.arcs ?? []) ctx.c.add('arc', { type: 'shape.path', props: { ...stroke, path: arcPath(cx, cy, r, a0, a1) } }, g);
    for (const [cx, cy, r] of ic.dots ?? []) ctx.c.add('dot', { type: 'shape.ellipse', transform: { position: at(cx, cy) }, props: { size: [r * 2, r * 2], fill: o.color } }, g);
  }, o.parent);
}

export const iconNames = Object.keys(ICONS);
