// A flock: little arrows that steer together (boids — separation, alignment,
// cohesion), seeded once and stepped frame by frame from the layer's in point
// (see NodeType.simulate), so the picture stays a function of time. Drawn in
// composition space: leave the layer's own transform at rest.

import type { NodeType, Vec2 } from '@tramme/core';

interface FlockProps { count: number; speed: number; cohesion: number; separation: number; alignment: number; margin: number; size: number; color: string; seed: number }
interface FlockState { pos: Vec2[]; vel: Vec2[] }

/** a small seeded generator, so the same seed holds the same flock */
function rng(seed: number): () => number {
  let a = Math.imul(1 + Math.floor(seed), 0x9e3779b1);
  return () => {
    a = Math.imul(a ^ (a >>> 15), 0x85ebca6b);
    a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
    return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
  };
}

export const flock: NodeType<FlockProps> = {
  type: 'flock', title: 'Flock', category: 'Generative',
  description: 'a flock of little arrows that steer together across the frame',
  props: {
    count: { type: 'number', default: 80, min: 2, max: 400, step: 1, animatable: false, label: 'Count' },
    speed: { type: 'number', default: 140, min: 10, max: 900, step: 10, label: 'Speed', description: 'pixels a second, held for every bird' },
    cohesion: { type: 'number', default: 0.6, min: 0, max: 3, step: 0.05, label: 'Cohesion' },
    separation: { type: 'number', default: 1.2, min: 0, max: 3, step: 0.05, label: 'Separation' },
    alignment: { type: 'number', default: 0.8, min: 0, max: 3, step: 0.05, label: 'Alignment' },
    margin: { type: 'number', default: 90, min: 0, step: 10, unit: 'px', label: 'Margin', description: 'how far from the frame edges they start to turn back' },
    size: { type: 'number', default: 10, min: 2, step: 1, unit: 'px', label: 'Size' },
    color: { type: 'color', default: '#1E2329', label: 'Color' },
    seed: { type: 'number', default: 1, min: 1, max: 9999, step: 1, animatable: false, label: 'Seed' },
  },
  simulate: {
    init(p, host) {
      const r = rng(p.seed), pos: Vec2[] = [], vel: Vec2[] = [];
      for (let i = 0; i < Math.round(p.count); i++) {
        pos.push([r() * host.width, r() * host.height]);
        const a = r() * Math.PI * 2;
        vel.push([Math.cos(a) * p.speed, Math.sin(a) * p.speed]);
      }
      return { pos, vel } satisfies FlockState;
    },
    step(s: FlockState, p, dt, host) {
      const w = host.width, h = host.height, n = s.pos.length;
      const out: Vec2[] = new Array(n);
      for (let i = 0; i < n; i++) {
        let cx = 0, cy = 0, ax = 0, ay = 0, sx = 0, sy = 0, near = 0;
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const dx = s.pos[j][0] - s.pos[i][0], dy = s.pos[j][1] - s.pos[i][1];
          const d2 = dx * dx + dy * dy;
          if (d2 > 160 * 160) continue;
          near++;
          cx += s.pos[j][0]; cy += s.pos[j][1];
          ax += s.vel[j][0]; ay += s.vel[j][1];
          if (d2 < 26 * 26 && d2 > 1e-4) { sx -= dx / d2; sy -= dy / d2; }
        }
        let [vx, vy] = s.vel[i];
        if (near) {
          vx += ((cx / near - s.pos[i][0]) * p.cohesion + (ax / near - vx) * p.alignment) * dt;
          vy += ((cy / near - s.pos[i][1]) * p.cohesion + (ay / near - vy) * p.alignment) * dt;
          vx += sx * p.separation * 60 * dt; vy += sy * p.separation * 60 * dt;
        }
        // turn back before the edges
        const m = p.margin;
        if (s.pos[i][0] < m) vx += p.speed * dt * 3;
        if (s.pos[i][0] > w - m) vx -= p.speed * dt * 3;
        if (s.pos[i][1] < m) vy += p.speed * dt * 3;
        if (s.pos[i][1] > h - m) vy -= p.speed * dt * 3;
        // keep the pace
        const l = Math.hypot(vx, vy) || 1;
        vx = (vx / l) * p.speed; vy = (vy / l) * p.speed;
        out[i] = [vx, vy];
      }
      for (let i = 0; i < n; i++) {
        s.pos[i] = [s.pos[i][0] + out[i][0] * dt, s.pos[i][1] + out[i][1] * dt];
        s.vel[i] = out[i];
      }
      return s;
    },
  },
  bounds: (_p, host) => ({ x: 0, y: 0, w: host.width, h: host.height }),
  render: {
    canvas2d(ctx, p, host) {
      const s = host.state?.<FlockState>();
      if (!s) return;
      ctx.fillStyle = p.color;
      for (let i = 0; i < s.pos.length; i++) {
        const a = Math.atan2(s.vel[i][1], s.vel[i][0]);
        ctx.save();
        ctx.translate(s.pos[i][0], s.pos[i][1]);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(p.size * 0.7, 0);
        ctx.lineTo(-p.size * 0.45, p.size * 0.42);
        ctx.lineTo(-p.size * 0.2, 0);
        ctx.lineTo(-p.size * 0.45, -p.size * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    },
  },
};
