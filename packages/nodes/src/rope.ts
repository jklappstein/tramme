// A rope tied to the layer's origin, its far end pulled towards another
// layer: Verlet points held by distance constraints, stepped frame by frame
// from the layer's in point (see NodeType.simulate), so the picture stays a
// function of time. Drawn in the layer's own space: move the layer to tie the
// rope somewhere, the target's position is brought into it (the layer's
// position only: leave its rotation and scale at rest).

import type { NodeType, Vec2 } from '@tramme/core';

interface RopeProps { target: string | null; segments: number; length: number; gravity: number; wind: number; damping: number; thickness: number; color: string }
interface RopeState { pts: Vec2[]; prev: Vec2[]; rest: number }

const ITERS = 5;

export const rope: NodeType<RopeProps> = {
  type: 'rope', title: 'Rope', category: 'Generative',
  description: 'a rope tied to the layer origin, pulled towards another layer, swinging in the wind',
  props: {
    target: { type: 'layer', default: null, nullable: true, label: 'Pulled to', animatable: false, description: 'the far end is drawn towards this layer (the rope hangs from the origin when there is none)' },
    segments: { type: 'number', default: 24, min: 3, max: 64, step: 1, animatable: false, label: 'Segments' },
    length: { type: 'number', default: 0, min: 0, step: 10, unit: 'px', label: 'Length', description: '0 keeps the distance the rope starts with' },
    gravity: { type: 'number', default: 1400, min: 0, max: 6000, step: 50, label: 'Gravity', description: 'pixels per second squared' },
    wind: { type: 'number', default: 0, min: -2000, max: 2000, step: 10, label: 'Wind', description: 'a steady push with a small sway, pixels per second squared' },
    damping: { type: 'number', default: 0.02, min: 0, max: 0.5, step: 0.005, label: 'Damping' },
    thickness: { type: 'number', default: 6, min: 0.5, step: 0.5, unit: 'px', label: 'Thickness' },
    color: { type: 'color', default: '#8A6B4A', label: 'Color' },
  },
  simulate: {
    init(p, host) {
      // the target's position is in the shared parent's space: made local to this layer, so a rope layer sitting anywhere still reaches it
      const mine = host.layer?.(host.layerId)?.transform.position ?? [0, 0];
      const raw = p.target && host.layer?.(p.target)?.transform.position;
      const to: Vec2 = raw ? [raw[0] - mine[0], raw[1] - mine[1]] : [0, p.length || 300];
      const n = Math.max(3, Math.round(p.segments)), L = p.length || Math.hypot(to[0], to[1]) || 1;
      const pts: Vec2[] = [], prev: Vec2[] = [];
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        pts.push([to[0] * k, to[1] * k]);
        prev.push([to[0] * k, to[1] * k]);
      }
      // the length the rope starts with is kept: 0 means "this", not "whatever the target does now"
      return { pts, prev, rest: L / (n - 1) } satisfies RopeState;
    },
    step(s: RopeState, p, dt, host) {
      const mine = host.layer?.(host.layerId)?.transform.position ?? [0, 0];
      const raw = p.target && host.layer?.(p.target)?.transform.position;
      const to: Vec2 | null = raw ? [raw[0] - mine[0], raw[1] - mine[1]] : null;
      const n = s.pts.length, sway = host.t * 1.7;
      for (let i = 1; i < n; i++) {
        const [x, y] = s.pts[i], [px, py] = s.prev[i];
        const keep = 1 - p.damping;
        const vx = (x - px) * keep, vy = (y - py) * keep;
        s.prev[i] = [x, y];
        s.pts[i] = [x + vx + (p.wind * (0.7 + 0.3 * Math.sin(sway + i / n))) * dt * dt, y + vy + p.gravity * dt * dt];
      }
      const rest = p.length ? p.length / (n - 1) : s.rest;
      for (let k = 0; k < ITERS; k++) {
        s.pts[0] = [0, 0];
        if (to) s.pts[n - 1] = to;
        for (let i = 0; i < n - 1; i++) {
          const [ax, ay] = s.pts[i], [bx, by] = s.pts[i + 1];
          const d = Math.hypot(bx - ax, by - ay) || 1e-6, off = (d - rest) / d * 0.5;
          const ox = (bx - ax) * off, oy = (by - ay) * off;
          if (i > 0) s.pts[i] = [ax + ox, ay + oy];
          if (i + 1 < n - 1 || !to) s.pts[i + 1] = [bx - ox, by - oy];
        }
      }
      s.pts[0] = [0, 0];
      if (to) s.pts[n - 1] = to;
      return s;
    },
  },
  bounds: (_p, host) => ({ x: -host.width, y: -host.height, w: host.width * 3, h: host.height * 3 }),
  render: {
    canvas2d(ctx, p, host) {
      const s = host.state?.<RopeState>();
      if (!s) return;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s.pts[0][0], s.pts[0][1]);
      for (let i = 1; i < s.pts.length - 1; i++) ctx.quadraticCurveTo(s.pts[i][0], s.pts[i][1], (s.pts[i][0] + s.pts[i + 1][0]) / 2, (s.pts[i][1] + s.pts[i + 1][1]) / 2);
      const last = s.pts[s.pts.length - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    },
  },
};
