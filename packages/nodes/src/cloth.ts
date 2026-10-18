// A piece of cloth pinned along its top edge: a grid of Verlet points held by
// distance constraints (see NodeType.simulate), falling, folding and catching
// the wind, stepped frame by frame from the layer's in point. Drawn as one
// filled mesh (or its wireframe), centred on the layer origin.

import type { NodeType, Vec2 } from '@tramme/core';

interface ClothProps { columns: number; rows: number; width: number; height: number; gravity: number; wind: number; sway: number; stiffness: number; color: string; wireframe: boolean }
interface ClothState { pts: Vec2[]; prev: Vec2[]; cols: number; rows: number }

const ITERS = 4;

export const cloth: NodeType<ClothProps> = {
  type: 'cloth', title: 'Cloth', category: 'Generative',
  description: 'a cloth pinned along its top edge, falling and catching the wind',
  props: {
    columns: { type: 'number', default: 16, min: 2, max: 48, step: 1, animatable: false, label: 'Columns' },
    rows: { type: 'number', default: 12, min: 2, max: 48, step: 1, animatable: false, label: 'Rows' },
    width: { type: 'number', default: 480, min: 40, step: 10, unit: 'px', label: 'Width' },
    height: { type: 'number', default: 360, min: 40, step: 10, unit: 'px', label: 'Height' },
    gravity: { type: 'number', default: 900, min: 0, max: 6000, step: 50, label: 'Gravity', description: 'pixels per second squared' },
    wind: { type: 'number', default: 240, min: -3000, max: 3000, step: 10, label: 'Wind', description: 'a wind that breathes at the sway frequency, pixels per second squared' },
    sway: { type: 'number', default: 0.6, min: 0.05, max: 4, step: 0.05, label: 'Sway', description: 'how often the wind breathes, a period in seconds' },
    stiffness: { type: 'number', default: 4, min: 1, max: 8, step: 1, animatable: false, label: 'Stiffness', description: 'constraint passes a frame: more holds the weave tighter' },
    color: { type: 'color', default: '#C24A3A', label: 'Color' },
    wireframe: { type: 'bool', default: false, label: 'Wireframe' },
  },
  simulate: {
    init(p, host) {
      void host;
      const cols = Math.max(2, Math.round(p.columns)), rows = Math.max(2, Math.round(p.rows));
      const pts: Vec2[] = [], prev: Vec2[] = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = -p.width / 2 + (p.width * c) / (cols - 1), y = -p.height / 2 + (p.height * r) / (rows - 1);
        pts.push([x, y]); prev.push([x, y]);
      }
      return { pts, prev, cols, rows } satisfies ClothState;
    },
    step(s: ClothState, p, dt, host) {
      const local = host.t - (host.layerIn ?? 0);
      const gust = p.wind * (0.75 + 0.25 * Math.sin(local * p.sway * Math.PI * 2));
      const { cols, rows, pts, prev } = s;
      for (let i = cols; i < pts.length; i++) { // the pinned top row stays
        const [x, y] = pts[i], [px, py] = prev[i];
        prev[i] = [x, y];
        const c = i % cols, r = Math.floor(i / cols);
        pts[i] = [x + (x - px) * 0.985 + gust * (0.5 + 0.5 * Math.sin(local * 2.1 + r * 0.7 + c * 0.35)) * dt * dt, y + (y - py) * 0.985 + p.gravity * dt * dt];
      }
      const dx = p.width / (cols - 1), dy = p.height / (rows - 1);
      for (let k = 0; k < Math.round(p.stiffness); k++) {
        for (let i = 0; i < pts.length; i++) {
          const c = i % cols;
          if (c < cols - 1) relax(pts, i, i + 1, dx, cols);
          if (i + cols < pts.length) relax(pts, i, i + cols, dy, cols);
        }
      }
      return s;
    },
  },
  bounds: (p) => ({ x: -p.width, y: -p.height, w: p.width * 2, h: p.height * 2.5 }),
  render: {
    canvas2d(ctx, p, host) {
      const s = host.state?.<ClothState>();
      if (!s) return;
      const { cols, rows, pts } = s;
      if (p.wireframe) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (c < cols - 1) { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); }
          if (r < rows - 1) { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + cols][0], pts[i + cols][1]); }
        }
        ctx.stroke();
        return;
      }
      ctx.fillStyle = p.color;
      for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
        const i = r * cols + c;
        // shade by how the fold faces: a cheap light from the left, so folds read
        const nx = (pts[i + 1][0] - pts[i][0]) + (pts[i + cols + 1][0] - pts[i + cols][0]);
        const lean = Math.max(0.35, Math.min(1, 0.85 - nx / (dx2(p, s) * 2)));
        ctx.globalAlpha = lean;
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        ctx.lineTo(pts[i + cols + 1][0], pts[i + cols + 1][1]); ctx.lineTo(pts[i + cols][0], pts[i + cols][1]);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  },
};

/** relax one pair towards its rest distance; the pins (the top row) stay still */
function relax(pts: Vec2[], a: number, b: number, rest: number, pins: number) {
  const pa = a < pins, pb = b < pins;
  if (pa && pb) return;
  const [ax, ay] = pts[a], [bx, by] = pts[b];
  const d = Math.hypot(bx - ax, by - ay) || 1e-6, off = (d - rest) / d;
  const wa = pa ? 0 : pb ? 1 : 0.5, wb = pb ? 0 : 1 - wa;
  pts[a] = [ax + (bx - ax) * off * wa, ay + (by - ay) * off * wa];
  pts[b] = [bx - (bx - ax) * off * wb, by - (by - ay) * off * wb];
}

const dx2 = (p: ClothProps, s: ClothState) => p.width / (s.cols - 1);
