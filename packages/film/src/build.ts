// What every scene is made with: a composition being filled (ids kept free,
// groups, the stack), keyframes written short, and the scene's context (the
// film's art direction, its format, its time, a seeded chance).

import type { Composition, EaseSpec, Effect, Layer, Prop, Token, Vec2 } from '@tramme/core';
import { withAlpha } from './color.ts';
import type { Cue } from './music.ts';
import type { Film, SceneSpec } from './spec.ts';
import type { Style } from './style.ts';

/** px and seconds, rounded the way the document keeps them */
export const px = (x: number) => Math.round(x * 10) / 10;
export const sec = (x: number) => Math.round(x * 1000) / 1000;
export const v2 = (x: number, y: number): Vec2 => [px(x), px(y)];

type Frame<T> = [t: number, v: T, ease?: EaseSpec];
/** keyframes from [t, value, ease of the segment it starts] */
export function keys<T>(...frames: Frame<T>[]): Prop<T> {
  const sorted = frames.map(([t, v, ease]) => ({ t: sec(t), v, ...(ease ? { ease } : {}) })).sort((a, b) => a.t - b.t);
  return { $k: sorted } as Prop<T>;
}

/** the words of a text (nothing for what is not one) */
export const wordCount = (v: unknown) => (typeof v === 'string' ? v.split(/\s+/).filter(Boolean).length : 0);

/** an id made of a name: letters, digits and dashes */
export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'layer';

/** a composition being filled: ids kept unique, layers stacked bottom to top */
export class Comp {
  layers: Record<string, Layer> = {};
  order: string[] = [];
  readonly id: string; readonly name: string; readonly width: number; readonly height: number; readonly fps: number; readonly duration: number;
  constructor(id: string, name: string, width: number, height: number, fps: number, duration: number) {
    this.id = id; this.name = name; this.width = width; this.height = height; this.fps = fps; this.duration = duration;
  }

  private fresh(base: string): string {
    const b = slug(base);
    if (!this.layers[b]) return b;
    for (let i = 2; ; i++) if (!this.layers[`${b}-${i}`]) return `${b}-${i}`;
  }

  /** a layer on top of the stack, or of the group `parent` */
  add(base: string, layer: Layer, parent?: string): string {
    const id = this.fresh(base);
    this.layers[id] = layer;
    if (parent) {
      const g = this.layers[parent];
      if (!g || g.type !== 'group') throw new Error(`no group ${parent}`);
      (g.children ??= []).push(id);
    } else this.order.push(id);
    return id;
  }

  /** a group, its children added by `fill` */
  group(base: string, layer: Omit<Layer, 'type' | 'children'>, fill: (id: string) => void, parent?: string): string {
    const id = this.add(base, { ...layer, type: 'group', children: [] }, parent);
    fill(id);
    return id;
  }

  composition(more: Partial<Composition> = {}): Composition {
    return { name: this.name, width: this.width, height: this.height, fps: this.fps, duration: sec(this.duration), ...more, layers: this.layers, order: this.order };
  }
}

/** the font assets of the film, by role, and their families (for measuring) */
export interface Fonts { display: string; text: string; mono: string; family: { display: string; text: string; mono: string } }

/** everything a scene is built from */
export interface Ctx {
  film: Film;
  scene: SceneSpec;
  /** rank of the scene in the film (0 for the first) */
  index: number;
  style: Style;
  /** the film's tokens (the style's) */
  tokens: Record<string, Token>;
  c: Comp;
  W: number; H: number;
  /** the frame's short side: sizes are fractions of it */
  u: number;
  vertical: boolean;
  /** the scene's length and a beat of the music, in seconds */
  dur: number;
  beat: number;
  fonts: Fonts;
  /** what the picture does when (scene time), for the effects: a reveal, a press, a pop */
  cues: Cue[];
  /** what the build had to give up (a picture shrunk to fit, a headline set smaller), for the review */
  notes: string[];
  /** how much larger the content is drawn by the end of the scene (the camera's move): what spans the frame is laid out that much smaller */
  grow: number;
  /** a chance of the film's seed and this scene: the same description, the same film */
  rand: () => number;
}

/** a seeded random source (mulberry32) */
export function seeded(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** one of a list, by chance */
export const pick = <T>(ctx: Ctx, list: readonly T[]): T => list[Math.floor(ctx.rand() * list.length) % list.length];

/** a token of the film (`@accent`) as #RRGGBB, or a colour as it is */
export function tokenHex(ctx: Ctx, color: string): string {
  if (!color.startsWith('@')) return color.slice(0, 7);
  const v = ctx.tokens[color.slice(1)]?.value;
  return typeof v === 'string' ? v.slice(0, 7) : '#FFFFFF';
}

/** a token of the film at an opacity: what a gradient stop or a glow takes */
export const tint = (ctx: Ctx, color: string, a: number) => withAlpha(tokenHex(ctx, color), a);

// ── common moves ─────────────────────────────────────────────
/** opacity from 0 at `at` to 1 over `d` */
export const fadeIn = (at: number, d = 0.4, ease: EaseSpec = '@enter') => keys<number>([at, 0, ease], [at + d, 1]);
/** a move from `from` to `to` starting at `at` */
export const move = (at: number, from: Vec2, to: Vec2, d = 0.6, ease: EaseSpec = '@enter') => keys<Vec2>([at, from, ease], [at + d, to]);
/** a uniform scale from `from` to `to` */
export const grow = (at: number, from: number, to = 1, d = 0.6, ease: EaseSpec = '@enter') => keys<Vec2>([at, [from, from], ease], [at + d, [to, to]]);
/** a blur that clears */
export const unblur = (at: number, radius: number, d = 0.5): Effect => ({ id: 'blur', type: 'fx.blur', props: { radius: keys<number>([at, radius, '@enter'], [at + d, 0]) } });
