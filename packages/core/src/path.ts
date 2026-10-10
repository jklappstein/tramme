// Editing a path value by hand: moving a vertex, setting a tangent, adding
// and removing vertices. Everything is pure and rounded to a tenth; tangents
// stay relative to their vertex, as the format stores them.

import type { PathValue } from './registry.ts';
import type { Vec2 } from './types.ts';

const r1 = (n: number) => Math.round(n * 10) / 10;

/** the path with vertex i moved by d; its tangents follow, they are relative to it */
export function movePathVertex(p: PathValue, i: number, d: Vec2): PathValue {
  return { ...p, v: p.v.map((q, k) => (k === i ? [r1(q[0] + d[0]), r1(q[1] + d[1])] : q)) };
}

/**
 * Vertex i's in or out tangent set to a new relative offset. Aligned keeps
 * the two tangents mirrored: the opposite one points the other way, as long
 * as the dragged one.
 */
export function setPathTangent(p: PathValue, i: number, which: 'i' | 'o', t: Vec2, aligned = false): PathValue {
  const key = which === 'i' ? 'i' : 'o';
  const other = which === 'i' ? 'o' : 'i';
  const list = [...(p[key] ?? [])];
  while (list.length < p.v.length) list.push([0, 0]);
  list[i] = [r1(t[0]), r1(t[1])];
  const next: PathValue = { ...p, [key]: list };
  if (aligned) {
    const olist = [...(p[other] ?? [])];
    while (olist.length < p.v.length) olist.push([0, 0]);
    olist[i] = [-r1(t[0]), -r1(t[1])];
    next[other] = olist;
  }
  return next;
}

/** the path without vertex i and its tangents; the last vertex removed leaves an empty path */
export function removePathVertex(p: PathValue, i: number): PathValue {
  if (p.v.length < 2) return { v: [] };
  const cut = <T,>(a: T[] | undefined) => (a ? a.filter((_, k) => k !== i) : undefined);
  return { ...p, v: p.v.filter((_, k) => k !== i), i: cut(p.i), o: cut(p.o) };
}

/** the cubic of segment a → b, its control points absolute */
const segment = (p: PathValue, a: number, b: number): [Vec2, Vec2, Vec2, Vec2] => {
  const A = p.v[a], B = p.v[b], o = p.o?.[a] ?? [0, 0], i = p.i?.[b] ?? [0, 0];
  return [A, [A[0] + o[0], A[1] + o[1]], [B[0] + i[0], B[1] + i[1]], B];
};

/** where q lands on the path: the segment and the progress along it, by sampling; null when there is no segment */
export function nearestOnPath(p: PathValue, q: Vec2, steps = 40): { seg: number; u: number } | null {
  const n = p.v.length;
  if (n < 2) return null;
  const last = p.closed ? n : n - 1;
  let best: { seg: number; u: number; d: number } | null = null;
  for (let s = 0; s < last; s++) {
    const b = (s + 1) % n;
    const [P0, P1, P2, P3] = segment(p, s, b);
    for (let k = 0; k <= steps; k++) {
      const u = k / steps, w = 1 - u;
      const x = w * w * w * P0[0] + 3 * w * w * u * P1[0] + 3 * w * u * u * P2[0] + u * u * u * P3[0];
      const y = w * w * w * P0[1] + 3 * w * w * u * P1[1] + 3 * w * u * u * P2[1] + u * u * u * P3[1];
      const d = (x - q[0]) ** 2 + (y - q[1]) ** 2;
      if (!best || d < best.d) best = { seg: s, u, d };
    }
  }
  return best ? { seg: best.seg, u: best.u } : null;
}

/** the path as an SVG d string: straight segments where both tangents are zero, cubic curves elsewhere */
export function pathD(pv: PathValue): string {
  const n = pv.v.length;
  if (!n) return '';
  const zero = [0, 0];
  let d = `M${pv.v[0][0]},${pv.v[0][1]}`;
  const seg = (a: number, b: number) => {
    const o = pv.o?.[a] ?? zero, i = pv.i?.[b] ?? zero;
    const [ax, ay] = pv.v[a], [bx, by] = pv.v[b];
    if (!o[0] && !o[1] && !i[0] && !i[1]) d += `L${bx},${by}`;
    else d += `C${ax + o[0]},${ay + o[1]} ${bx + i[0]},${by + i[1]} ${bx},${by}`;
  };
  for (let k = 0; k < n - 1; k++) seg(k, k + 1);
  if (pv.closed) { if (n > 1) seg(n - 1, 0); d += 'Z'; }
  return d;
}

/** the path with a vertex splitting segment seg at u (de Casteljau): each half keeps its ends' tangents */
export function insertPathVertex(p: PathValue, seg: number, u: number): PathValue {
  const n = p.v.length;
  if (!n) return p;
  const b = (seg + 1) % n;
  const [P0, P1, P2, P3] = segment(p, seg, b);
  const mix = (a: Vec2, c: Vec2): Vec2 => [a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u];
  const P01 = mix(P0, P1), P12 = mix(P1, P2), P23 = mix(P2, P3);
  const P012 = mix(P01, P12), P123 = mix(P12, P23);
  const V = mix(P012, P123);
  const rel = (from: Vec2, t: Vec2): Vec2 => [r1(t[0] - from[0]), r1(t[1] - from[1])];
  // the new vertex sits at seg+1; on a closed path the last segment's far end is vertex 0, which does not move
  const shift = (list: Vec2[], at: number) => [...list.slice(0, at), [0, 0] as Vec2, ...list.slice(at)];
  const v = shift(p.v, seg + 1).map((q, k) => (k === seg + 1 ? [r1(V[0]), r1(V[1])] as Vec2 : q));
  const wrap = seg === n - 1;
  let i: Vec2[] | undefined, o: Vec2[] | undefined;
  if (p.i || p.o) {
    i = p.i ? (wrap ? [...p.i, [0, 0]] : shift(p.i, seg + 1)) : undefined;
    o = p.o ? (wrap ? [...p.o, [0, 0]] : shift(p.o, seg + 1)) : undefined;
    if (i) {
      // the far end's in tangent is cut back to where the split leaves it
      i[wrap ? 0 : b + 1] = rel(v[wrap ? 0 : b + 1], P23);
      i[seg + 1] = rel(V, P012);
    }
    if (o) {
      o[seg] = rel(v[seg], P01);
      o[seg + 1] = rel(V, P123);
    }
  }
  return { ...p, v, i, o };
}
