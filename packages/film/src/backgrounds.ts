// The grounds a scene stands on, drawn from the film's palette and its seed:
// planes of light, soft glows, gradients, tinted blobs, grids, dots, lines,
// the motif scattered large and faint, a floor running to the horizon, warm
// paper. They drift slowly, never still, and sit deep behind the content so
// the camera's moves give the scene its depth; they are drawn larger than the
// frame for it. Shapes where they can be (each an editable layer), a shader
// for the patterns.

import type { Layer, Transform } from '@tramme/core';
import { keys, pick, px, v2, type Ctx } from './build.ts';
import { withAlpha } from './color.ts';
import { motifLayer } from './motif.ts';
import type { Background } from './style.ts';

/** how deep the ground sits behind the content, and the scale that keeps it covering the frame */
const DEPTH = 500;
const PERSPECTIVE = 1000;
const cover = (PERSPECTIVE + DEPTH) / PERSPECTIVE;

/**
 * A soft light, round or stretched: a disc whose radial gradient fades to
 * nothing at its rim, scaled into an ellipse (a gradient cut by a shape
 * narrower than it would show its edge).
 */
export function glowDisc(name: string, color: string, o: { x: number; y: number; w: number; h: number; a: number; depth?: number; blend?: Layer['blend']; position?: Transform['position']; opacity?: Transform['opacity'] }): Layer {
  const d = Math.max(o.w, o.h);
  return {
    type: 'shape.ellipse', name, blend: o.blend ?? 'normal',
    transform: {
      position: o.position ?? v2(o.x, o.y),
      scale: [px((o.w / d) * 1000) / 1000, px((o.h / d) * 1000) / 1000],
      ...(o.opacity !== undefined ? { opacity: o.opacity } : {}),
      ...(o.depth ? { depth: o.depth } : {}),
    },
    props: {
      size: v2(d, d),
      fill: { type: 'radial', center: [0, 0], radius: px(d / 2), stops: [[0, withAlpha(color, o.a)], [0.42, withAlpha(color, o.a * 0.42)], [0.75, withAlpha(color, o.a * 0.1)], [1, withAlpha(color, 0)]] },
    },
  };
}

/** a glow deep in the ground, drifting over the scene */
function drifting(ctx: Ctx, name: string, color: string, o: { x: number; y: number; w: number; h: number; a: number; blend?: Layer['blend'] }) {
  const { dur, u } = ctx, dx = (ctx.rand() - 0.5) * u * 0.12, dy = (ctx.rand() - 0.5) * u * 0.06;
  ctx.c.add(name, glowDisc(name, color, { ...o, depth: DEPTH, position: keys([0, v2(o.x - dx / 2, o.y - dy / 2), '@standard'], [dur, v2(o.x + dx / 2, o.y + dy / 2)]) }));
}

/** a plane of light: a long band, bright on one edge and fading on the other, slowly sliding */
function band(ctx: Ctx, name: string, o: { x: number; y: number; angle: number; width: number; color: string; edge: string; a: number; slide: number; mirror?: boolean }) {
  const { dur, H } = ctx, len = H * 2.6 * cover, rad = (o.angle * Math.PI) / 180, nx = Math.cos(rad), ny = Math.sin(rad);
  ctx.c.add(name, {
    type: 'shape.rect', name, blend: 'add',
    transform: { position: keys([0, v2(o.x - (nx * o.slide) / 2, o.y - (ny * o.slide) / 2), '@standard'], [dur, v2(o.x + (nx * o.slide) / 2, o.y + (ny * o.slide) / 2)]), rotation: o.mirror ? -o.angle : o.angle, ...(o.mirror ? { scale: [-1, 1] } : {}), depth: DEPTH, opacity: keys([0, 0.82, '@standard'], [dur * 0.5, 1, '@standard'], [dur, 0.9]) },
    props: {
      size: v2(o.width, len),
      fill: { type: 'linear', from: [px(-o.width / 2), 0], to: [px(o.width / 2), 0], stops: [[0, withAlpha(o.color, 0)], [0.62, withAlpha(o.color, o.a * 0.5)], [0.93, withAlpha(o.edge, o.a)], [0.965, withAlpha(o.edge, Math.min(1, o.a * 1.5))], [1, withAlpha(o.edge, 0)]] },
    },
    effects: [{ id: 'blur', type: 'fx.blur', props: { radius: px(ctx.u * 0.004) } }],
  });
}

// ── patterns, one shader each ───────────────────────────────
const FADE = `vec2 c = (uv - 0.5) * vec2(uSize.x / uSize.y, 1.0);
  float fade = 1.0 - smoothstep(0.0, uParams.z, length(c));`;

const SHADERS = {
  grid: `// a grid of fine lines: p1 cell (px), p2 line width (px), p3 fade radius
vec4 shade(vec2 uv) {
  vec2 p = uv * uSize;
  vec2 g = abs(fract(p / uParams.x + 0.5) - 0.5) * uParams.x;
  float line = 1.0 - smoothstep(0.0, uParams.y, min(g.x, g.y));
  ${FADE}
  return vec4(uColorA.rgb, line * fade * uColorA.a);
}`,
  dots: `// a grid of dots: p1 spacing (px), p2 radius (px), p3 fade radius
vec4 shade(vec2 uv) {
  vec2 p = uv * uSize;
  vec2 q = (fract(p / uParams.x) - 0.5) * uParams.x;
  float d = 1.0 - smoothstep(uParams.y - 1.0, uParams.y, length(q));
  ${FADE}
  return vec4(uColorA.rgb, d * fade * uColorA.a);
}`,
  lines: `// parallel lines: p1 spacing (px), p2 width (px), p3 fade radius, p4 angle (degrees)
vec4 shade(vec2 uv) {
  vec2 p = uv * uSize;
  float a = radians(uParams.w);
  float y = p.x * sin(a) + p.y * cos(a);
  float g = abs(fract(y / uParams.x + 0.5) - 0.5) * uParams.x;
  float line = 1.0 - smoothstep(0.0, uParams.y, g);
  ${FADE}
  return vec4(uColorA.rgb, line * fade * uColorA.a);
}`,
  floor: `// a floor of lines running to a horizon: p1 lines per unit, p2 horizon (share of the height), p3 line softness, p4 scroll speed
vec4 shade(vec2 uv) {
  float hz = uParams.y;
  if (uv.y < hz) return vec4(uColorB.rgb, smoothstep(hz - 0.3, hz, uv.y) * uColorB.a * 0.55);
  float d = (uv.y - hz) / (1.0 - hz);
  float z = 1.0 / max(d, 0.002);
  vec2 p = vec2((uv.x - 0.5) * z * 2.0, z + uTime * uParams.w) * uParams.x;
  vec2 g = abs(fract(p) - 0.5) / max(fwidth(p) * uParams.z, 1e-4);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  float near = smoothstep(0.0, 0.4, d), glow = (1.0 - smoothstep(0.0, 0.3, d)) * uColorB.a;
  return vec4(mix(uColorA.rgb, uColorB.rgb, glow), max(line * uColorA.a * near, glow * 0.45));
}`,
};

function pattern(ctx: Ctx, name: keyof typeof SHADERS, o: { color: string; a: number; p1: number; p2: number; p3: number; p4?: number; color2?: string; a2?: number; drift?: boolean }) {
  // wide enough for the passes that move a scene sideways (a whip, a slide) to keep the frame covered
  const { W, H, u, dur } = ctx, w = W * cover * 1.6, h = H * cover * 1.3;
  const dx = o.drift === false ? 0 : (ctx.rand() - 0.5) * u * 0.05;
  ctx.c.add(name, {
    type: 'shader', name: name[0].toUpperCase() + name.slice(1),
    transform: { position: keys([0, v2(W / 2, H / 2), '@standard'], [dur, v2(W / 2 + dx, H / 2 - Math.abs(dx) * 0.4)]), depth: DEPTH },
    props: { code: SHADERS[name], size: v2(w, h), colorA: withAlpha(o.color, o.a), colorB: withAlpha(o.color2 ?? o.color, o.a2 ?? 0), p1: o.p1, p2: o.p2, p3: o.p3, p4: o.p4 ?? 0, resolution: 0.75 },
  });
}

/** floating dust, barely there: depth for the dark grounds */
function dust(ctx: Ctx, color: string) {
  const { W, H, u } = ctx;
  ctx.c.add('dust', {
    type: 'particles', name: 'Dust',
    transform: { position: v2(W / 2, H / 2), depth: DEPTH * 0.4 },
    props: { rate: 7, life: 9, lifeVar: 0.4, preroll: 9, emitter: 'rect', emitterSize: v2(W * 1.6, H * 1.6), direction: -90, spread: 360, speed: px(u * 0.012), speedVar: 0.6, gravity: [0, 0], drag: 0, size: px(u * 0.0035), sizeEnd: px(u * 0.0035), sizeVar: 0.6, color, opacity: 0.35, fadeIn: 1.2, fadeOut: 0.5, seed: 7 + ctx.index },
  });
}

const BUILDERS: Record<Background, (ctx: Ctx) => void> = {
  flat: () => {},
  light(ctx) {
    const { W, H, u } = ctx, col = ctx.style.colors, tall = ctx.vertical, dark = ctx.style.mode === 'dark';
    const angle = (tall ? 7 : 19) + (ctx.rand() - 0.5) * 8, x0 = tall ? -W * 0.12 : -W * ctx.rand() * 0.06, bw = W * (tall ? 0.62 : 0.46), a = dark ? 0.55 : 0.3;
    drifting(ctx, 'Glow', col.glow, { x: W * 0.5, y: H * 0.62, w: W * 1.3, h: H * 1.1, a: dark ? 0.16 : 0.22 });
    band(ctx, 'Light · left', { x: x0, y: H * 0.5, angle, width: bw, color: col.glow, edge: col.accent2, a, slide: u * 0.06 });
    band(ctx, 'Light · left, far', { x: x0 - W * (tall ? 0.3 : 0.22), y: H * 0.5, angle: angle + 8, width: bw * 0.9, color: col.glow, edge: col.accent2, a: a * 0.5, slide: u * 0.04 });
    band(ctx, 'Light · right', { x: W - x0, y: H * 0.5, angle, width: bw, color: col.glow, edge: col.accent2, a: a * 0.9, slide: -u * 0.06, mirror: true });
    if (dark) dust(ctx, col.accent2);
  },
  glow(ctx) {
    const { W, H } = ctx, col = ctx.style.colors, dark = ctx.style.mode === 'dark', r = ctx.rand;
    drifting(ctx, 'Glow', col.glow, { x: W * (0.35 + r() * 0.3), y: H * (0.45 + r() * 0.2), w: W * 1.25, h: H * 1.25, a: dark ? 0.42 : 0.3, blend: dark ? 'add' : 'normal' });
    drifting(ctx, 'Glow · tint', col.accent2, { x: W * (0.15 + r() * 0.7), y: H * (0.2 + r() * 0.5), w: W * 0.7, h: H * 0.7, a: 0.12, blend: dark ? 'add' : 'normal' });
    if (dark) dust(ctx, col.accent2);
  },
  gradient(ctx) {
    const { W, H, dur } = ctx, col = ctx.style.colors, dark = ctx.style.mode === 'dark';
    const angle = pick(ctx, [-35, -20, 25, 40, 160, 200]), w = W * cover * 1.3, h = H * cover * 1.3, rad = (angle * Math.PI) / 180;
    ctx.c.add('gradient', {
      type: 'shape.rect', name: 'Gradient',
      transform: { position: v2(W / 2, H / 2), rotation: keys([0, 0, '@standard'], [dur, (ctx.rand() - 0.5) * 6]), depth: DEPTH },
      props: { size: v2(w, h), fill: { type: 'linear', from: [px(-Math.cos(rad) * w * 0.5), px(-Math.sin(rad) * h * 0.5)], to: [px(Math.cos(rad) * w * 0.5), px(Math.sin(rad) * h * 0.5)], stops: [[0, withAlpha(col.accent, dark ? 0.42 : 0.3)], [0.45, withAlpha(col.accent2, 0.12)], [1, withAlpha(col.bg, 0)]] } },
    });
  },
  mesh(ctx) {
    const { W, H } = ctx, col = ctx.style.colors, r = ctx.rand, k = ctx.style.mode === 'dark' ? 0.9 : 1;
    drifting(ctx, 'Tint · a', col.glow, { x: W * (0.1 + r() * 0.3), y: H * (0.1 + r() * 0.3), w: W * 0.95, h: H * 1.1, a: 0.5 * k });
    drifting(ctx, 'Tint · b', col.accent2, { x: W * (0.6 + r() * 0.35), y: H * (0.6 + r() * 0.35), w: W * 0.85, h: H, a: 0.22 * k });
    drifting(ctx, 'Tint · c', col.accent, { x: W * (0.55 + r() * 0.4), y: H * r() * 0.3, w: W * 0.55, h: H * 0.6, a: 0.12 * k });
  },
  grid(ctx) {
    const { W, H, u } = ctx, col = ctx.style.colors, dark = ctx.style.mode === 'dark';
    drifting(ctx, 'Glow', col.glow, { x: W * 0.5, y: H * 0.5, w: W * 1.1, h: H * 0.95, a: dark ? 0.22 : 0.18, blend: dark ? 'add' : 'normal' });
    pattern(ctx, 'grid', { color: col.ink, a: dark ? 0.085 : 0.07, p1: px(u * pick(ctx, [0.06, 0.075, 0.09]) * cover), p2: 1.4, p3: 0.62 });
  },
  dots(ctx) {
    const { W, H, u } = ctx, col = ctx.style.colors, dark = ctx.style.mode === 'dark';
    drifting(ctx, 'Glow', col.glow, { x: W * 0.5, y: H * 0.55, w: W, h: H, a: dark ? 0.2 : 0.16, blend: dark ? 'add' : 'normal' });
    pattern(ctx, 'dots', { color: col.ink, a: dark ? 0.16 : 0.13, p1: px(u * pick(ctx, [0.035, 0.045, 0.055]) * cover), p2: px(u * 0.0028 * cover), p3: 0.7 });
  },
  lines(ctx) {
    const { W, H, u } = ctx, col = ctx.style.colors, dark = ctx.style.mode === 'dark';
    drifting(ctx, 'Glow', col.glow, { x: W * 0.4, y: H * 0.5, w: W * 1.1, h: H, a: dark ? 0.18 : 0.15, blend: dark ? 'add' : 'normal' });
    pattern(ctx, 'lines', { color: col.ink, a: dark ? 0.07 : 0.06, p1: px(u * pick(ctx, [0.025, 0.035, 0.05]) * cover), p2: 1.2, p3: 0.75, p4: pick(ctx, [0, 30, 45, -30, 90]) });
  },
  shapes(ctx) {
    const { W, H, u, dur } = ctx, col = ctx.style.colors, dark = ctx.style.mode === 'dark';
    const motif = ctx.style.motif === 'none' ? 'circle' : ctx.style.motif;
    drifting(ctx, 'Glow', col.glow, { x: W * 0.5, y: H * 0.5, w: W, h: H, a: dark ? 0.16 : 0.12 });
    const n = 3 + Math.floor(ctx.rand() * 2);
    for (let i = 0; i < n; i++) {
      const size = u * (0.35 + ctx.rand() * 0.55), x = W * ctx.rand(), y = H * ctx.rand(), outline = i % 2 === 1;
      const color = [col.accent, col.accent2, col.glow][i % 3];
      motifLayer(ctx, motif, {
        size, color: withAlpha(color, outline ? (dark ? 0.35 : 0.3) : dark ? 0.16 : 0.12), outline, name: `Shape ${i + 1}`,
        transform: { position: keys([0, v2(x, y), '@standard'], [dur, v2(x + (ctx.rand() - 0.5) * u * 0.1, y + (ctx.rand() - 0.5) * u * 0.08)]), rotation: keys([0, 0, '@standard'], [dur, (ctx.rand() - 0.5) * 30]), depth: DEPTH * 0.7 },
        effects: [{ id: 'blur', type: 'fx.blur', props: { radius: px(u * (outline ? 0.002 : 0.03)) } }],
      });
    }
  },
  floor(ctx) {
    const { W, H } = ctx, col = ctx.style.colors, dark = ctx.style.mode === 'dark';
    pattern(ctx, 'floor', { color: col.ink, a: dark ? 0.22 : 0.16, color2: col.glow, a2: dark ? 0.5 : 0.3, p1: pick(ctx, [1.6, 2.2, 3]), p2: 0.52, p3: 1.2, p4: 0.35, drift: false });
    drifting(ctx, 'Glow', col.glow, { x: W * 0.5, y: H * 0.52, w: W * 1.2, h: H * 0.5, a: dark ? 0.25 : 0.2, blend: dark ? 'add' : 'normal' });
  },
  paper(ctx) {
    const { W, H } = ctx, col = ctx.style.colors;
    drifting(ctx, 'Light', col.glow, { x: W * (0.2 + ctx.rand() * 0.2), y: H * 0.2, w: W * 1.1, h: H * 1.2, a: 0.35 });
    drifting(ctx, 'Shade', col.faint, { x: W * 0.92, y: H * 0.95, w: W * 0.9, h: H * 0.9, a: 0.1 });
  },
};

/** the scene's ground, at the bottom of its stack */
export const background = (ctx: Ctx, name: Background) => (BUILDERS[name] ?? BUILDERS.flat)(ctx);
