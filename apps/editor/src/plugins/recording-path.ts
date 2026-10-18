// A Path2D that records instead of drawing: the sandbox's nodes build their
// outline with `new Path2D()` as anywhere else, and this class captures the
// commands as SVG path data, which crosses the boundary as a string and is
// rebuilt as a real Path2D on the page (`new Path2D(data)`). The surface
// mirrors the standard class; arcs go out as cubic beziers (the usual
// kappa split), so the data parses everywhere.

type Op = [name: string, args: number[] | string[]];

const n = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};
/** a circular arc's cubic beziers, split at most every quarter turn */
function arcToBeziers(cx: number, cy: number, rx: number, ry: number, rot: number, a0: number, a1: number, ops: Op[]) {
  const k = 4 / 3;
  let from = a0;
  const dir = a1 >= a0 ? 1 : -1;
  while (from !== a1) {
    const step = dir > 0 ? Math.min(a1 - from, Math.PI / 2) : Math.max(a1 - from, -Math.PI / 2);
    const to = from + step;
    const t = (k * Math.tan(step / 4));
    const cos0 = Math.cos(from), sin0 = Math.sin(from), cos1 = Math.cos(to), sin1 = Math.sin(to);
    // the unit arc's control points, scaled, rotated, translated
    const p = (a: number, off: number): [number, number] => [
      cx + rx * (Math.cos(a) - off * t * Math.sin(a)) * Math.cos(rot) - ry * (Math.sin(a) + off * t * Math.cos(a)) * Math.sin(rot),
      cy + rx * (Math.cos(a) - off * t * Math.sin(a)) * Math.sin(rot) + ry * (Math.sin(a) + off * t * Math.cos(a)) * Math.cos(rot),
    ];
    const c1 = p(from, 1), c2 = p(to, -1), end = p(to, 0);
    ops.push(['C', [n(c1[0]), n(c1[1]), n(c2[0]), n(c2[1]), n(end[0]), n(end[1])]]);
    from = to;
  }
}

export class RecordingPath2D {
  private ops: Op[] = [];
  /** the pen, for the commands that need it (arcTo) */
  private cur: [number, number] | null = null;
  private lastStart: [number, number] | null = null;

  constructor(data?: string | RecordingPath2D) {
    if (typeof data === 'string') this.ops.push(['D', [data]]);
    else if (data) this.ops.push(...data.ops.map((o) => [...o] as Op));
  }

  moveTo(x: number, y: number) { this.ops.push(['M', [n(x), n(y)]]); this.cur = [x, y]; this.lastStart = [x, y]; }
  lineTo(x: number, y: number) { this.ops.push(['L', [n(x), n(y)]]); this.cur = [x, y]; }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) { this.ops.push(['C', [n(c1x), n(c1y), n(c2x), n(c2y), n(x), n(y)]]); this.cur = [x, y]; }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) { this.ops.push(['Q', [n(cx), n(cy), n(x), n(y)]]); this.cur = [x, y]; }
  closePath() { this.ops.push(['Z', []]); this.cur = this.lastStart ? [...this.lastStart] : null; }
  rect(x: number, y: number, w: number, h: number) { this.ops.push(['R', [n(x), n(y), n(w), n(h)]]); this.cur = [x, y]; this.lastStart = [x, y]; }
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, a0: number, a1: number, ccw = false) {
    const rot = rotation || 0;
    // canvas: the sweep goes from a0 to a1, clockwise unless ccw, a full turn when both ends match
    let delta = a1 - a0;
    if (ccw && delta >= 0) delta -= Math.PI * 2;
    if (!ccw && delta <= 0) delta += Math.PI * 2;
    const to = a0 + delta;
    arcToBeziers(x, y, rx, ry, rot, a0, to, this.ops);
    this.cur = [
      x + rx * Math.cos(to) * Math.cos(rot) - ry * Math.sin(to) * Math.sin(rot),
      y + rx * Math.cos(to) * Math.sin(rot) + ry * Math.sin(to) * Math.cos(rot),
    ];
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number) {
    if (!this.cur) { this.cur = [x1, y1]; return; }
    const [x0, y0] = this.cur;
    const v1x = x0 - x1, v1y = y0 - y1, v2x = x2 - x1, v2y = y2 - y1;
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    const cross = v1x * v2y - v1y * v2x;
    if (!l1 || !l2 || !cross || !r) { this.lineTo(x1, y1); return; }
    const u1x = v1x / l1, u1y = v1y / l1, u2x = v2x / l2, u2y = v2y / l2;
    const theta = Math.acos(Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y)));
    const dist = r / Math.tan(theta / 2);
    const t1x = x1 + u1x * dist, t1y = y1 + u1y * dist, t2x = x1 + u2x * dist, t2y = y1 + u2y * dist;
    const ccw = cross < 0;
    const midx = u1x + u2x, midy = u1y + u2y;
    const lm = Math.hypot(midx, midy);
    const d = r / Math.sin(theta / 2);
    const cx = x1 + (midx / lm) * d, cy = y1 + (midy / lm) * d;
    const a0 = Math.atan2(t1y - cy, t1x - cx);
    const a1 = Math.atan2(t2y - cy, t2x - cx);
    this.lineTo(t1x, t1y);
    this.arc(cx, cy, r, a0, a1, ccw);
  }
  roundRect(x: number, y: number, w: number, h: number, r: number | number[] = 0) {
    const radii = typeof r === 'number' ? [r, r, r, r] : (r.length === 4 ? r : [r[0] ?? 0, r[1] ?? r[0] ?? 0, r[2] ?? r[0] ?? 0, r[3] ?? r[1] ?? r[0] ?? 0]);
    const [tl, tr, br, bl] = radii.map((v) => Math.min(v, w / 2, h / 2));
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y); this.arcTo(x + w, y, x + w, y + tr, tr);
    this.lineTo(x + w, y + h - br); this.arcTo(x + w, y + h, x + w - br, y + h, br);
    this.lineTo(x + bl, y + h); this.arcTo(x, y + h, x, y + h - bl, bl);
    this.lineTo(x, y + tl); this.arcTo(x, y, x + tl, y, tl);
    this.closePath();
  }
  addPath(p: RecordingPath2D | unknown) {
    if (p instanceof RecordingPath2D) this.ops.push(...p.ops.map((o) => [...o] as Op));
    else throw new Error('addPath: only a sandbox path can join another');
  }

  /** the commands as SVG path data */
  toString() {
    return this.ops.map(([name, args]) => (name === 'D' ? String(args[0]) : args.length ? `${name} ${args.join(' ')}` : name)).join(' ').trim();
  }
}
