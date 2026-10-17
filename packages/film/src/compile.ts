// A film description becomes compositions: one per scene (its ground, its
// elements in their layout, its camera), and the film that plays them in
// order on the music's beats, passing from one to the next the way each
// scene asks (a cut, a push through a blur, a whip, a wipe, an iris, the
// motif sweeping across…), with the art direction's finish over everything
// and its sound under it. Deterministic: the same description and seed give
// the same document.

import { Evaluator, soundCues, type Asset, type Composition, type EaseSpec, type Effect, type SoundVisual, type Token, type TrammeDoc, type Vec2 } from '@tramme/core';
import { builtinRegistry } from '@tramme/nodes';
import { Comp, keys, px, sec, seeded, v2, type Ctx, type Fonts } from './build.ts';
import { withAlpha } from './color.ts';
import { familyFiles, fontAsset, type Family, type FontFile } from './fonts.ts';
import { effectSound, musicBed, PEAK, type Cue, type CueKind } from './music.ts';
import { review } from './review.ts';
import { buildScene, cameraOf, growOf, sceneCamera } from './scenes.ts';
import { sceneSeconds, type ElementSpec, type Film } from './spec.ts';
import { resolveStyle, type Style, type Transition } from './style.ts';

export interface FilmBuild {
  /** the compositions to write: the film and its scenes */
  compositions: Record<string, Composition>;
  /** the film's composition */
  comp: string;
  tokens: Record<string, Token>;
  assets: Record<string, Asset>;
  /** the fonts to copy into the project (shipped or fetched: fontFile reads them), by their path in it */
  files: FontFile[];
  /** files made for this film (its music, its effects), by their path in the project */
  made: { path: string; data: Uint8Array }[];
  duration: number;
  /** the direction as resolved, the scenes and their times, what the review found: for the model */
  summary: string;
  /** what the review found, one line each */
  notes: string[];
  /** each scene's composition and its place in the film, for a contact sheet */
  scenes: { comp: string; at: number; dur: number }[];
}

/** how much longer a scene's composition runs than its place in the film: what a dissolve or an iris shows of it under the next one */
const TAIL = 0.6;

/** a family of the catalogue as the project's font asset, its files to copy */
function shipped(f: Family, assets: Record<string, Asset>, files: FilmBuild['files']): string {
  const id = fontAsset(f);
  if (!assets[id]) {
    assets[id] = { type: 'font', src: `assets/fonts/${f.file}`, family: f.name, weight: f.weight, name: `${f.name} (SIL OFL 1.1)` };
    assets[`${id}-license`] = { type: 'json', src: `assets/fonts/${f.license}`, name: `${f.name} · license` };
    files.push(...familyFiles(f));
  }
  return id;
}

/** what a scene says, in a few words: its name and its line in the summary */
function gist(els: ElementSpec[]): string {
  for (const e of els) for (const k of ['text', 'value', 'quote', 'name', 'title', 'tagline']) {
    const v = e[k];
    if (typeof v === 'string' && v.trim()) return v.replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  return els.map((e) => e.type).join(' + ');
}

/**
 * Builds the film into the composition `comp`. `families` gives the family
 * of the project's own font assets (a brand font), for measuring; `sound`
 * false leaves the music and the effects out (a quick build to review).
 */
export function buildFilm(film: Film, o: { comp: string; families?: Record<string, string>; sound?: boolean }): FilmBuild {
  const style = resolveStyle(film.style, film.brand.colors ?? []);
  const tokens = style.tokens;
  const assets: Record<string, Asset> = {}, files: FilmBuild['files'] = [];
  const face = (own: string | undefined, f: Family) => (own ? { asset: own, family: o.families?.[own] ?? f.name } : { asset: shipped(f, assets, files), family: f.name });
  const display = face(film.brand.font, style.display), text = face(film.brand.textFont ?? film.brand.font, style.text), mono = face(undefined, style.mono);
  const fonts: Fonts = { display: display.asset, text: text.asset, mono: mono.asset, family: { display: display.family, text: text.family, mono: mono.family } };

  const W = film.width, H = film.height, u = Math.min(W, H), beat = 60 / film.bpm, last = film.scenes.length - 1;
  const compositions: Record<string, Composition> = {};
  const main = new Comp(o.comp, film.title, W, H, film.fps, 0);
  const lines: string[] = [], built: string[] = [], scenes: FilmBuild['scenes'] = [];
  const cuts: number[] = [], kinds: Transition[] = [], cues: Cue[] = [], heroes: number[] = [];
  let at = 0, end = 0;
  film.scenes.forEach((scene, index) => {
    const dur = sceneSeconds(film, scene), camera = cameraOf(scene, index, style.motion);
    const num = String(index + 1).padStart(2, '0'), id = `${o.comp}-${num}`, words = gist(scene.elements);
    const c = new Comp(id, `${num} · ${words}`, W, H, film.fps, dur + TAIL);
    const ctx: Ctx = { film, scene, index, style, tokens, c, W, H, u, vertical: H > W * 1.1, dur, beat, fonts, cues: [], notes: [], grow: growOf(camera), rand: seeded(film.seed * 7919 + index * 104729 + 1) };
    const content = buildScene(ctx);
    const cam = sceneCamera(ctx, camera);
    // the content comes towards the camera (or goes back) while the ground stays deep: a dolly, with its parallax
    if (cam.dolly) for (const lid of content) {
      const t = (c.layers[lid].transform ??= {}), d0 = typeof t.depth === 'number' ? t.depth : 0;
      t.depth = keys<number>([0, d0, '@standard'], [dur, d0 - cam.dolly]);
    }
    compositions[id] = c.composition({ background: '@plate', camera: cam.camera });
    for (const q of ctx.cues) if (q.t < dur) cues.push({ t: sec(at + q.t), kind: q.kind });
    // a scene that reveals (a logo, the motif bursting) is where the music drops
    if (ctx.cues.some((q) => q.kind === 'impact')) heroes.push(sec(at));
    // an end card: the music breathes out under it
    if (index === last && index > 0 && scene.elements.some((e) => e.type === 'logo' || e.type === 'button')) end = sec(at);
    built.push(...ctx.notes.map((n) => `scene ${index + 1}: ${n}`));
    // uncropped, a scene's ground (drawn larger than the frame) still fills it while the scene moves in or out
    main.add(`scene-${num}`, { type: 'comp', name: c.name, in: sec(at), out: sec(at + dur), transform: { position: v2(W / 2, H / 2) }, props: { comp: id, crop: false } });
    const pass = index < last ? ((scene.transition ?? style.transition) as Transition) : undefined;
    lines.push(`${index + 1}. ${sec(at).toFixed(2)}–${sec(at + dur).toFixed(2)} s, composition ${id}: ${scene.layout ?? 'center'}, camera ${camera}, ${scene.elements.map((e) => e.type).join(' + ')} "${words}"${pass ? `; then ${pass}` : ''}`);
    scenes.push({ comp: id, at: sec(at), dur });
    if (index) cuts.push(sec(at));
    if (pass) kinds.push(pass);
    at += dur;
  });
  const duration = sec(at);

  const { flashes, fast, whooshes } = passes(main, cuts, kinds, style, { W, H, u });
  const composed = (): Composition => ({
    ...main.composition({ background: '@plate', effects: finishing(style, flashes), ...(fast.length ? { motionBlur: blurAt(fast) } : {}), markers: cuts.map((t, i) => ({ id: `cut-${i + 1}`, t, kind: 'cut', label: `scene ${i + 2}` })) }),
    duration,
  });
  const made: FilmBuild['made'] = [];
  if (o.sound !== false) {
    // the effects first, set on the moments the picture makes; then the music, which makes room for them
    const placed = film.effects ? effects(main, { duration, whooshes, cues, assets, made }) : [];
    if (placed.length) {
      compositions[o.comp] = composed();
      sync(main, { schema: 'tramme/1', meta: { title: film.title }, tokens, assets: {}, compositions, root: o.comp } as TrammeDoc, placed, duration);
    }
    music(film, main, { duration, cuts, heroes, end: end || duration, assets, made, hits: placed.map((pl) => ({ t: (main.layers[pl.id].in ?? 0) + PEAK[pl.kind], hero: pl.kind === 'impact' })) });
  }
  compositions[o.comp] = composed();

  const notes = [...review(film, style), ...built];
  const faces = `${film.brand.font ? `the brand's font (${display.family})` : style.display.name} for the headlines${style.upper ? ' in capitals' : ''} over ${film.brand.textFont || film.brand.font ? text.family : style.text.name}`;
  const summary = [
    `Film "${film.title}" in composition "${o.comp}": ${W}×${H} at ${film.fps} fps, ${duration.toFixed(2)} s at ${film.bpm} bpm (a beat is ${beat.toFixed(3)} s), seed ${film.seed}.`,
    ...(film.concept ? [`Concept: ${film.concept}`] : []),
    `Direction: ${style.mode}; ${faces}; ground ${style.colors.bg}, ink ${style.colors.ink}, accents ${style.colors.accent} and ${style.colors.accent2}; ${style.motion} motion, ${style.background} grounds, ${style.texture} texture, motif ${style.motif}; ${film.music ? 'the project\'s music' : film.bed ? `${film.mood} music made for it` : 'no music'}.`,
    ...lines,
    notes.length ? `To look at:\n${notes.map((n) => `- ${n}`).join('\n')}` : 'The review flags nothing.',
  ].join('\n');
  return { compositions, comp: o.comp, tokens, assets, files, made, duration, summary, notes, scenes };
}

/** how loud each effect sits under the picture (dB), and the moments of the picture it may underline */
const EFFECTS: Record<CueKind, { gain: number; visual: SoundVisual[]; name: string }> = {
  whoosh: { gain: -8, visual: ['cut'], name: 'Whoosh' },
  impact: { gain: -4, visual: ['appear', 'land'], name: 'Hit' },
  click: { gain: -3, visual: ['appear', 'land'], name: 'Click' },
  pop: { gain: -4, visual: ['appear', 'land'], name: 'Pop' },
  tick: { gain: -7, visual: ['land', 'appear'], name: 'Tick' },
};

/**
 * The effects the film calls for: a whoosh under each fast pass, a hit on
 * each reveal, a click on a button, a pop for a notification, a tick when a
 * figure lands. Each is one small file, placed as many times as needed, every
 * placement a layer the user can move or silence.
 */
function effects(main: Comp, o: { duration: number; whooshes: number[]; cues: Cue[]; assets: Record<string, Asset>; made: FilmBuild['made'] }): { id: string; kind: CueKind }[] {
  const seconds = (data: Uint8Array) => (data.length - 44) / 4 / 44100;
  const all: Cue[] = [...o.whooshes.map((t): Cue => ({ t, kind: 'whoosh' })), ...o.cues].sort((a, b) => a.t - b.t);
  const length: Partial<Record<CueKind, number>> = {}, placed: { id: string; kind: CueKind }[] = [];
  for (const q of all) {
    if (!(q.kind in length)) {
      const data = effectSound(q.kind);
      o.made.push({ path: `assets/film/sfx-${q.kind}.wav`, data });
      o.assets[`film-sfx-${q.kind}`] = { type: 'audio', src: `assets/film/sfx-${q.kind}.wav`, name: `${EFFECTS[q.kind].name} (made for the film)` };
      length[q.kind] = seconds(data);
    }
    const t0 = Math.max(0, q.t - PEAK[q.kind]), e = EFFECTS[q.kind];
    const id = main.add(q.kind, { type: 'audio', name: `${e.name} · ${q.t.toFixed(2)} s`, in: sec(t0), out: sec(Math.min(o.duration, t0 + length[q.kind]!)), props: { audio: `film-sfx-${q.kind}`, role: 'effect', gain: e.gain, visual: e.visual[0], ...(q.kind === 'impact' ? { weight: 'hero' } : {}) } });
    placed.push({ id, kind: q.kind });
  }
  return placed;
}

/**
 * The effects moved onto the moments the picture makes as the sound checks
 * find them (a cut, an appearance, a landing, read by core's soundCues in the
 * scenes too), when one is a few frames away: in sync by construction. An
 * effect the picture makes no such moment for keeps its time and claims none.
 */
function sync(main: Comp, doc: TrammeDoc, placed: { id: string; kind: CueKind }[], duration: number) {
  const seen = soundCues(new Evaluator(doc, builtinRegistry()), main.id);
  for (const pl of placed) {
    const l = main.layers[pl.id], props = l.props!, t0 = l.in ?? 0, hit = t0 + PEAK[pl.kind], kinds = EFFECTS[pl.kind].visual;
    const near = seen.filter((c) => kinds.includes(c.kind) && Math.abs(c.t - hit) <= 0.2).sort((a, b) => Math.abs(a.t - hit) - Math.abs(b.t - hit))[0];
    const shift = near ? near.t - hit : 0;
    if (!near || t0 + shift < 0) { delete props.visual; continue; }
    l.in = sec(t0 + shift); l.out = sec(Math.min(duration, (l.out ?? duration) + shift)); props.visual = near.kind;
    l.name = `${EFFECTS[pl.kind].name} · ${near.t.toFixed(2)} s`;
  }
}

/** the film's music: its own (a sound of the project), or a bed made in its tempo and mood, its drop on the first reveal, room made under each effect */
function music(film: Film, main: Comp, o: { duration: number; cuts: number[]; heroes: number[]; end: number; assets: Record<string, Asset>; made: FilmBuild['made']; hits: { t: number; hero: boolean }[] }) {
  if (film.music) main.add('music', { type: 'audio', name: 'Music', in: 0, out: o.duration, props: { audio: film.music, role: 'music', fadeOut: 1.5 } });
  else if (film.bed) {
    const data = musicBed({ bpm: film.bpm, duration: o.duration, cuts: o.cuts, heroes: o.heroes, end: o.end, mood: film.mood, hits: o.hits }, film.seed);
    o.made.unshift({ path: 'assets/film/music.wav', data });
    o.assets['film-music'] = { type: 'audio', src: 'assets/film/music.wav', name: `Music · ${film.mood}, ${film.bpm} bpm (made for the film)` };
    main.add('music', { type: 'audio', name: 'Music', in: 0, out: o.duration, props: { audio: 'film-music', role: 'music', fadeOut: 0.8 } });
  }
}

/** the passes that move fast: motion blur over them, a whoosh under them */
const FAST: Transition[] = ['push', 'slide', 'whip', 'zoom', 'wipe', 'motif'];

/**
 * How scenes pass to one another, on the comp layers of the film, each cut
 * the way its scene asked: the scene leaving and the one arriving move, blur
 * or fade, or a shape of the film covers the cut. Every layer a pass adds is
 * named `pass-…`. Gives the cuts that flash (for the finish), those that move
 * fast (for the motion blur) and those that want a whoosh.
 */
function passes(main: Comp, cuts: number[], kinds: Transition[], style: Style, f: { W: number; H: number; u: number }) {
  type F<T> = [number, T, EaseSpec?];
  const { W, H, u } = f, centre = v2(W / 2, H / 2), off = (dx: number) => v2(W / 2 + dx, H / 2);
  const ids = main.order.filter((id) => main.layers[id].type === 'comp');
  const moves = ids.map(() => ({ scale: [] as F<Vec2>[], blur: [] as F<number>[], pos: [] as F<Vec2>[], fade: [] as F<number>[] }));
  const flashes: number[] = [], fast: number[] = [], whooshes: number[] = [];
  /**
   * A shape of a colour of the film crossing the frame, exactly over it at T:
   * the cut happens under it. Its edges are soft, so the motion blur smears
   * them rather than stepping them.
   */
  const sweep = (id: string, o: { T: number; ellipse?: boolean; w: number; h: number; radius?: number; color: 'accent' | 'accent2'; dy?: number; tilt?: number; dir: 1 | -1; d?: number }) => {
    const d = o.d ?? 0.3, reach = W / 2 + o.w / 2 + W * 0.05, y = H / 2 + (o.dy ?? 0), t0 = o.T - d, t1 = o.T + d;
    const token = `@${o.color}`, clear = withAlpha(style.colors[o.color], 0);
    const fill = o.ellipse
      ? { type: 'radial', center: [0, 0], radius: px(o.w / 2), stops: [[0, token], [0.93, token], [1, clear]] }
      : { type: 'linear', from: [px(-o.w / 2), 0], to: [px(o.w / 2), 0], stops: [[0, clear], [0.05, token], [0.95, token], [1, clear]] };
    main.add(id, {
      type: o.ellipse ? 'shape.ellipse' : 'shape.rect', name: `Pass · ${o.T.toFixed(2)} s`, in: sec(t0), out: sec(t1),
      transform: { position: keys<Vec2>([t0, v2(W / 2 - o.dir * reach, y), '@exit'], [o.T, v2(W / 2, y), '@enter'], [t1, v2(W / 2 + o.dir * reach, y)]), ...(o.tilt ? { rotation: keys<number>([t0, o.tilt, '@standard'], [t1, -o.tilt]) } : {}) },
      props: { size: v2(o.w, o.h), ...(o.radius ? { radius: px(o.radius) } : {}), fill },
    });
  };
  cuts.forEach((T, i) => {
    const A = moves[i], B = moves[i + 1], kind = kinds[i], n = i + 1;
    if (FAST.includes(kind)) { fast.push(T); whooshes.push(T); }
    switch (kind) {
      case 'push':
        A.scale.push([T - 0.24, [1, 1], '@exit'], [T, [1.07, 1.07]]); A.blur.push([T - 0.22, 0, '@exit'], [T, 14]);
        B.scale.push([T, [0.94, 0.94], '@enter'], [T + 0.5, [1, 1]]); B.blur.push([T, 12, '@enter'], [T + 0.28, 0]);
        if (style.glow && style.mode === 'dark') flashes.push(T);
        break;
      case 'slide':
        A.pos.push([T - 0.26, centre, '@exit'], [T, off(-W * 0.08)]); A.blur.push([T - 0.24, 0, '@exit'], [T, 10]);
        B.pos.push([T, off(W * 0.1), '@enter'], [T + 0.55, centre]); B.blur.push([T, 10, '@enter'], [T + 0.28, 0]);
        break;
      case 'whip':
        // a short travel, a long smear: the blur says the speed, the grounds still fill the frame
        A.pos.push([T - 0.2, centre, '@exit'], [T, off(-W * 0.22)]); A.blur.push([T - 0.2, 0, '@exit'], [T, 56]);
        B.pos.push([T, off(W * 0.22), '@enter'], [T + 0.3, centre]); B.blur.push([T, 56, '@enter'], [T + 0.3, 0]);
        break;
      case 'zoom':
        // through the scene leaving, into the one arriving from close
        A.scale.push([T - 0.32, [1, 1], '@exit'], [T, [1.5, 1.5]]); A.blur.push([T - 0.3, 0, '@exit'], [T, 22]);
        B.scale.push([T, [1.3, 1.3], '@enter'], [T + 0.5, [1, 1]]); B.blur.push([T, 18, '@enter'], [T + 0.32, 0]);
        break;
      case 'dissolve':
        main.layers[ids[i]].out = sec(T + 0.5);
        B.fade.push([T, 0, '@standard'], [T + 0.5, 1]);
        break;
      case 'iris': {
        main.layers[ids[i]].out = sec(T + 0.6);
        const d = Math.hypot(W, H) * 1.04, opening = keys<Vec2>([T, [0.001, 0.001], '@emphasized'], [T + 0.6, [1, 1]]);
        const iris = main.add(`pass-${n}-iris`, { type: 'shape.ellipse', name: `Iris · ${T.toFixed(2)} s`, visible: false, transform: { position: centre, scale: opening }, props: { size: v2(d, d), fill: '#FFFFFF' } });
        // a ring of the accent on its edge: an opening the eye reads as one, not a dark circle eating the picture
        main.add(`pass-${n}-ring`, { type: 'shape.ellipse', name: `Iris ring · ${T.toFixed(2)} s`, in: sec(T), out: sec(T + 0.6), transform: { position: centre, scale: opening, opacity: keys<number>([T + 0.3, 1, '@standard'], [T + 0.6, 0]) }, props: { size: v2(d, d), fill: null, stroke: '@accent', strokeWidth: px(u * 0.008) } });
        // the opening sits just under the scene it opens
        main.order.splice(main.order.indexOf(iris), 1);
        main.order.splice(main.order.indexOf(ids[i + 1]), 0, iris);
        main.layers[ids[i + 1]].clip = iris;
        break;
      }
      case 'wipe': {
        // a band of the accent crosses the frame, a band of its companion just ahead of it
        const tilt = i % 2 ? -8 : 8, w = W * 1.3 + H * 0.4, h = H * 1.5;
        sweep(`pass-${n}-lead`, { T: T - 0.06, w: w * 0.5, h, color: 'accent2', tilt, dir: 1 });
        sweep(`pass-${n}`, { T, w, h, color: 'accent', tilt, dir: 1 });
        break;
      }
      case 'motif': {
        // the film's motif, large enough to cover the frame, sweeping across it
        const m = style.motif, d = Math.hypot(W, H) * 1.04;
        if (m === 'bars' || m === 'line') {
          [0.26, 0.32, 0.38].forEach((dd, k) => sweep(`pass-${n}-${k + 1}`, { T, d: dd, w: W * 1.2, h: H * 0.38, radius: H * 0.04, color: k === 1 ? 'accent2' : 'accent', dy: (k - 1) * H * 0.33, dir: -1 }));
        } else if (m === 'square' || m === 'frame' || m === 'plus' || m === 'logo') {
          sweep(`pass-${n}-lead`, { T: T - 0.06, w: d * 0.45, h: d * 0.45, radius: u * style.radius * 4, color: 'accent2', dy: -H * 0.12, tilt: 14, dir: -1 });
          sweep(`pass-${n}`, { T, w: d, h: d, radius: u * style.radius * 6, color: 'accent', tilt: 10, dir: -1 });
        } else {
          sweep(`pass-${n}-lead`, { T: T - 0.06, ellipse: true, w: d * 0.45, h: d * 0.45, color: 'accent2', dy: -H * 0.12, dir: -1 });
          sweep(`pass-${n}`, { T, ellipse: true, w: d, h: d, color: 'accent', dir: -1 });
        }
        break;
      }
      case 'flash':
        flashes.push(T); whooshes.push(T);
        B.scale.push([T, [1.05, 1.05], '@enter'], [T + 0.45, [1, 1]]);
        break;
      default: break; // a cut, on the beat
    }
  });
  ids.forEach((id, i) => {
    const l = main.layers[id], t = l.transform!, mv = moves[i];
    if (mv.scale.length) t.scale = keys<Vec2>(...mv.scale);
    if (mv.pos.length) t.position = keys<Vec2>(...mv.pos);
    if (mv.fade.length) t.opacity = keys<number>(...mv.fade);
    if (mv.blur.length) l.effects = [{ id: 'blur', type: 'fx.blur', props: { radius: keys<number>(...mv.blur.map(([tt, v, e]): F<number> => [tt, px((v * u) / 1080), e])) } }];
  });
  return { flashes, fast, whooshes };
}

/**
 * Motion blur where things move fast enough to need it, around the fast
 * passes, and none elsewhere: a film renders several times faster than with
 * sub-frames everywhere (the 'cut' markers keep the blur from straddling a cut).
 */
function blurAt(cuts: number[]) {
  const spans: [number, number][] = [];
  for (const t of cuts) {
    const prev = spans.at(-1);
    if (prev && t - 0.32 <= prev[1]) prev[1] = t + 0.5;
    else spans.push([t - 0.32, t + 0.5]);
  }
  return { samples: keys<number>([0, 1, 'hold'], ...spans.flatMap(([a, b]): [number, number, EaseSpec][] => [[a, 8, 'hold'], [b, 1, 'hold']])), shutter: 0.5 };
}

/** the art direction's finish over the whole film, and a flash of light at the cuts that ask for it */
function finishing(style: Style, flashes: number[]): Effect[] {
  const out = style.finish.map((e) => ({ ...e, props: { ...e.props } }));
  if (!flashes.length) return out;
  const pulse = (base: number, peak: number, d: number) => keys<number>([0, base], ...flashes.flatMap((t): [number, number, EaseSpec?][] => [[t - 0.001, base], [t, peak, '@enter'], [t + d, base]]));
  const chroma = out.find((e) => e.type === 'look.chromatic');
  if (chroma) chroma.props!.amount = pulse(Number(chroma.props!.amount ?? 0.6), 7, 0.3);
  // first, so the bloom catches the flash
  out.unshift({ id: 'exposure', type: 'look.exposure', props: { value: pulse(1, style.mode === 'dark' ? 1.32 : 1.15, 0.28) } });
  return out;
}
