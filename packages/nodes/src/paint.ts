// Fills and strokes for Canvas2D: a colour string or a gradient in the
// layer's local space (pixels), and Lottie-style paths.

import type { Paint, PathValue } from '@tramme/core';
import { pathD } from '@tramme/core';

export function canvasPaint(ctx: CanvasRenderingContext2D, paint: Paint): string | CanvasGradient | null {
  if (paint === null || paint === undefined) return null;
  if (typeof paint === 'string') return paint;
  const g = paint.type === 'linear'
    ? ctx.createLinearGradient(paint.from[0], paint.from[1], paint.to[0], paint.to[1])
    : ctx.createRadialGradient(paint.center[0], paint.center[1], 0, paint.center[0], paint.center[1], paint.radius);
  for (const [offset, color] of paint.stops) g.addColorStop(Math.min(1, Math.max(0, offset)), color);
  return g;
}

/** a rounded rectangle as the current path, its radius kept within its size */
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
}

/** fill then stroke a path with the node's paint props */
export function fillStroke(ctx: CanvasRenderingContext2D, path: Path2D, p: { fill: Paint; stroke: Paint; strokeWidth: number }) {
  const fill = canvasPaint(ctx, p.fill);
  if (fill) { ctx.fillStyle = fill; ctx.fill(path); }
  const stroke = canvasPaint(ctx, p.stroke);
  if (stroke && p.strokeWidth > 0) { ctx.strokeStyle = stroke; ctx.lineWidth = p.strokeWidth; ctx.stroke(path); }
}

/** Path2D of a path value, from its SVG form (pathD of @tramme/core) */
export function toPath2D(pv: PathValue): Path2D {
  return new Path2D(pathD(pv));
}
