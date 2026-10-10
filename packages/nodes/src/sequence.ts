// Drawn animation: a list of drawings (image assets) shown one after the
// other, timed by an exposure sheet or a hold ("on twos"). Each drawing sits in
// a frame centred on the layer origin, like the image node.

import { drawingAt, localFrame, type NodeType, type SequenceLoop, type Vec2 } from '@tramme/core';

type Img = CanvasImageSource & { width: number; height: number; naturalWidth?: number; naturalHeight?: number };

interface SequenceProps {
  frames: string[];
  hold: number;
  sheet: string;
  loop: SequenceLoop;
  offset: number;
  drawing: number;
  size: Vec2;
  fit: 'contain' | 'cover' | 'fill' | 'none';
}

export const sequence: NodeType<SequenceProps> = {
  type: 'sequence', title: "Image sequence", category: 'Media',
  props: {
    frames: { type: 'assets', default: [], assetType: 'image', label: 'Drawings', animatable: false, description: 'the drawings, in their order (1, 2, 3…)' },
    hold: { type: 'number', default: 2, min: 1, max: 48, step: 1, label: 'Hold', animatable: false, description: 'composition frames per drawing: 2 gives the anime rhythm "on twos"' },
    sheet: { type: 'string', default: '', label: "Exposure sheet", animatable: false, description: 'order and length of the drawings, e.g. "1-4/2, 5/6, 4-1/2, x/3" (x: empty). Empty: all drawings, held for "Hold"' },
    loop: { type: 'enum', default: 'loop', options: ['loop', 'once', 'pingpong'], label: 'Playback' },
    offset: { type: 'number', default: 0, step: 1, label: 'Offset', description: 'frames of offset in the sequence' },
    drawing: { type: 'number', default: 0, min: 0, step: 1, label: 'Forced drawing', description: '0: follows the sheet; otherwise the drawing number (with hold keyframes, for a mouth for example)' },
    size: { type: 'vec2', default: [600, 600], label: 'Frame', unit: 'px' },
    fit: { type: 'enum', default: 'contain', options: ['contain', 'cover', 'fill', 'none'], label: 'Fit mode' },
  },
  path({ size: [w, h] }) { const p = new Path2D(); p.rect(-w / 2, -h / 2, w, h); return p; },
  bounds: ({ size: [w, h] }) => ({ x: -w / 2, y: -h / 2, w, h }),
  render: {
    canvas2d(ctx, p, host) {
      const d = drawingAt({ ...p, count: p.frames.length }, localFrame(host.t, host.layerIn ?? 0, host.fps));
      if (d < 0) return;
      const img = host.asset<Img>(p.frames[d]);
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const r = drawingRect(p.fit, p.size[0], p.size[1], iw, ih);
      if (!r) return;
      if (r.clip) { ctx.beginPath(); ctx.rect(-p.size[0] / 2, -p.size[1] / 2, p.size[0], p.size[1]); ctx.clip(); }
      ctx.drawImage(img, r.x, r.y, r.w, r.h);
    },
  },
};

/** where a drawing sits in the layer's frame (local, centred on the origin); null when there is nothing to draw */
export function drawingRect(fit: 'contain' | 'cover' | 'fill' | 'none', w: number, h: number, iw: number, ih: number): { x: number; y: number; w: number; h: number; clip: boolean } | null {
  if (w <= 0 || h <= 0 || !iw || !ih) return null;
  if (fit === 'fill') return { x: -w / 2, y: -h / 2, w, h, clip: false };
  const s = fit === 'cover' ? Math.max(w / iw, h / ih) : fit === 'contain' ? Math.min(w / iw, h / ih) : 1;
  return { x: (-iw * s) / 2, y: (-ih * s) / 2, w: iw * s, h: ih * s, clip: fit === 'cover' };
}
