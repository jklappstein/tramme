// A scene, built: its ground, its elements in their layout, entering one
// after the other in the order the scene wrote them, and its camera. The
// camera's move is chosen with the layout: a push for a statement, a drift
// beside what is shown, a punch for energy, nothing for a reading moment.

import type { Camera } from '@tramme/core';
import { background } from './backgrounds.ts';
import { keys, sec, v2, type Ctx } from './build.ts';
import { anchorX, ELEMENT_RENDER } from './elements.ts';
import { layout } from './layouts.ts';
import type { CAMERAS, SceneSpec } from './spec.ts';
import type { Background } from './style.ts';
import { textBlock, type Treatment } from './text.ts';

export type CameraName = typeof CAMERAS[number];

/** a camera's move over a scene: its zoom from and to, its pan, how far the content comes forward (px of depth) */
const MOVES: Record<CameraName, { zoom: [number, number]; pan: [number, number]; dolly: number; punch?: boolean }> = {
  still: { zoom: [1, 1], pan: [0, 0], dolly: 0 },
  push: { zoom: [1, 1.04], pan: [0.012, -0.004], dolly: 45 },
  pull: { zoom: [1.07, 1], pan: [-0.01, 0.004], dolly: -25 },
  drift: { zoom: [1.01, 1.025], pan: [0.04, -0.008], dolly: 20 },
  pan: { zoom: [1.02, 1.02], pan: [0.09, 0], dolly: 0 },
  rise: { zoom: [1.01, 1.03], pan: [0, -0.06], dolly: 15 },
  punch: { zoom: [1.1, 1.02], pan: [0, 0], dolly: 30, punch: true },
};

/** the camera a scene gets when it does not choose: from its layout and the film's motion */
export function cameraOf(scene: SceneSpec, index: number, motion: string): CameraName {
  if (scene.camera) return scene.camera;
  if (motion === 'mechanical') return index % 2 ? 'still' : 'pan';
  if (motion === 'dreamy') return index % 2 ? 'drift' : 'pull';
  const layoutName = scene.layout ?? 'center';
  if (layoutName === 'full' || layoutName === 'grid') return 'drift';
  if (layoutName === 'poster') return motion === 'snappy' || motion === 'elastic' ? 'punch' : 'push';
  if (layoutName === 'split' || layoutName === 'left' || layoutName === 'right') return index % 2 ? 'drift' : 'push';
  return 'push';
}

/** how much larger the content is drawn by the end of the scene, for the layouts to keep it inside */
export function growOf(camera: CameraName): number {
  const m = MOVES[camera];
  return Math.max(m.zoom[0], m.zoom[1]) * (1000 / (1000 - Math.max(0, m.dolly))) * (1 + Math.abs(m.pan[0]) * 0.6);
}

/** the scene's camera, and the depth moves of its content (applied by the film) */
export function sceneCamera(ctx: Ctx, camera: CameraName): { camera: Camera; dolly: number } {
  const m = MOVES[camera], { u, dur } = ctx, dir = ctx.rand() < 0.5 ? -1 : 1;
  const zoom = m.punch ? keys([0, m.zoom[0], '@pop'], [Math.min(0.5, dur * 0.3), 1], [dur, m.zoom[1]]) : keys([0, m.zoom[0], '@standard'], [dur, m.zoom[1]]);
  const px0 = m.pan[0] * u * dir, py0 = m.pan[1] * u;
  return { camera: { zoom, pan: keys([0, v2(-px0 / 2, -py0 / 2), '@standard'], [dur, v2(px0 / 2, py0 / 2)]), perspective: 1000 }, dolly: m.dolly };
}

/** builds one scene: its ground, then its elements; gives the ids of the content's root layers */
export function buildScene(ctx: Ctx): string[] {
  background(ctx, (ctx.scene.bg ?? ctx.style.background) as Background);
  const from = ctx.c.order.length;
  const slots = layout(ctx, ctx.scene);
  let t = 0.06;
  for (const s of slots) {
    if (s.text) {
      const el = s.el;
      const b = textBlock(ctx, {
        text: String(el.text ?? ''), role: s.role, size: s.size, px: s.px, treatment: el.treatment as Treatment | undefined,
        emphasis: Array.isArray(el.emphasis) ? el.emphasis as string[] : undefined, swap: Array.isArray(el.swap) ? el.swap as string[] : undefined,
        max: s.box.w, x: anchorX(s.box, s.align), y: s.box.y, at: sec(t), align: s.align,
      });
      // a kicker leads the headline by a breath; a headline lets the rest follow once its words are in
      t += s.role === 'kicker' ? 0.12 : s.role === 'headline' ? Math.min(0.9, Math.max(0.3, (b.done - t) * 0.55)) : 0.22;
    } else {
      const done = ELEMENT_RENDER[s.el.type][0](ctx, s.el, s.box, sec(t), s.align);
      t += Math.min(0.6, Math.max(0.3, (done - t) * 0.25));
    }
  }
  return ctx.c.order.slice(from);
}
