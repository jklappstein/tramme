// The film as the model writes it: an idea, an art direction, and scenes it
// composes itself, each a layout of elements with a way for the words to
// enter, a camera and a pass to the next. Read here, completed with the
// defaults and checked: every problem is named with its place, all at once,
// so the model fixes its description in one go.

import { isHex } from './color.ts';
import { BACKGROUNDS, CORNERS, MODES, MOTIFS, MOTIONS, PRESETS, SCALES, SCHEMES, TEXTURES, TRANSITIONS, type StyleSpec } from './style.ts';
import { familyNames } from './fonts.ts';

export type FormatName = '16:9' | '9:16' | '1:1' | '4:5';
export const FORMATS: Record<FormatName, [number, number]> = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };

export const LAYOUTS = ['center', 'left', 'right', 'split', 'poster', 'grid', 'full', 'corner'] as const;
export const CAMERAS = ['still', 'push', 'pull', 'drift', 'pan', 'rise', 'punch'] as const;
export const TREATMENTS = ['mask', 'blur', 'fade', 'type', 'letters', 'scale', 'swap', 'highlight', 'underline', 'split'] as const;
export const ROLES = ['headline', 'kicker', 'body', 'caption'] as const;
export const SIZES = ['xxl', 'xl', 'l', 'm', 's'] as const;
export const MOODS = ['drive', 'bright', 'calm'] as const;

export interface Brand {
  /** the name, said by the logo and end scenes when there is no logo picture */
  name?: string;
  /** an image asset of the project (its logo) */
  logo?: string;
  /** its colours: the first is the accent, the second (if any) its companion */
  colors?: string[];
  /** a font asset of the project for the headlines (and the text, unless textFont) */
  font?: string;
  textFont?: string;
  url?: string;
}

export interface Music {
  /** tempo: the scenes' beats are counted in it */
  bpm?: number;
  /** the bed's character: driving, bright, calm (from the style otherwise) */
  mood?: typeof MOODS[number];
  /** a sound asset of the project to play under the film */
  asset?: string;
  /** without a sound of its own, a bed made in the film's tempo (yes by default) */
  bed?: boolean;
  /** whooshes into the cuts, hits on the reveals, clicks and pops on the interfaces (yes by default) */
  effects?: boolean;
}

export interface ElementSpec { type: string; [field: string]: unknown }

export interface SceneSpec {
  beats?: number;
  seconds?: number;
  layout?: typeof LAYOUTS[number];
  /** the layout mirrored */
  flip?: boolean;
  bg?: string;
  camera?: typeof CAMERAS[number];
  /** the pass into the next scene (the style's otherwise) */
  transition?: string;
  elements: ElementSpec[];
}

export interface FilmSpec {
  title?: string;
  format?: FormatName | [number, number];
  fps?: number;
  /** another seed, another take of the same description: positions, angles, little choices */
  seed?: number;
  /** the idea of the film in one sentence */
  concept?: string;
  brand?: Brand;
  style?: StyleSpec;
  music?: Music;
  scenes: SceneSpec[];
}

/** a film ready to build: the defaults filled in */
export interface Film {
  title: string;
  width: number;
  height: number;
  fps: number;
  seed: number;
  concept: string;
  brand: Brand;
  style: StyleSpec;
  bpm: number;
  mood: typeof MOODS[number];
  music?: string;
  bed: boolean;
  effects: boolean;
  scenes: SceneSpec[];
}

/** what a field takes, for the checks and the model's documentation */
export interface Field {
  type: 'string' | 'number' | 'boolean' | 'strings' | 'items' | 'numbers' | 'object' | 'list';
  doc: string;
  required?: boolean;
  options?: readonly string[];
}

/** the elements a scene composes, their fields */
export const ELEMENTS: Record<string, { doc: string; fields: Record<string, Field> }> = {
  text: { doc: 'words: a headline, a kicker over it, a line of body, a caption', fields: {
    text: { type: 'string', required: true, doc: 'the words (\\n for a line break)' },
    role: { type: 'string', options: ROLES, doc: 'headline by default for the first text of a scene, body after it' },
    treatment: { type: 'string', options: TREATMENTS, doc: 'how it enters (the style decides otherwise)' },
    size: { type: 'string', options: SIZES, doc: 'xxl to s, from its role by default' },
    emphasis: { type: 'strings', doc: 'words in the accent (one or two)' },
    swap: { type: 'strings', doc: 'with treatment swap: the words that come in turn in place of the last word of the text, after it (the last one stays)' },
  } },
  figure: { doc: 'a number that rolls up to its value', fields: {
    value: { type: 'string', required: true, doc: 'as shown: "10 ms", "$2.4M", "63%"' },
    label: { type: 'string', doc: 'what it is' },
    context: { type: 'string', doc: 'a smaller line: the source, the comparison' },
  } },
  chart: { doc: 'a line drawing itself, bars rising, or market candles', fields: {
    kind: { type: 'string', options: ['line', 'bars', 'candles'], doc: 'line by default' },
    data: { type: 'numbers', required: true, doc: 'the values in order' },
    labels: { type: 'strings', doc: 'bars: the label of each' },
    title: { type: 'string', doc: 'what it shows' },
    value: { type: 'string', doc: 'the headline figure' },
    delta: { type: 'string', doc: 'its change, e.g. "+18%"' },
  } },
  ui: { doc: 'an interface built from a description, coming in piece by piece', fields: {
    ui: { type: 'object', required: true, doc: '{ title?, subtitle?, items: [...] } (interface items)' },
  } },
  device: { doc: 'a phone, a browser or a window, an interface or a picture in it', fields: {
    device: { type: 'string', options: ['phone', 'browser', 'window'], doc: 'browser by default' },
    ui: { type: 'object', doc: 'the interface shown in it' },
    image: { type: 'string', doc: 'or an image asset (a screenshot)' },
  } },
  code: { doc: 'lines of code or data, typed or revealed', fields: {
    lines: { type: 'strings', required: true, doc: 'the lines (short)' },
    title: { type: 'string', doc: 'a file name over them' },
  } },
  logo: { doc: 'the logo (or a mark drawn from the name), the name beside it, a tagline', fields: {
    name: { type: 'string', doc: 'the brand name by default' },
    tagline: { type: 'string', doc: 'a line under it' },
    image: { type: 'string', doc: 'an image asset (the brand logo by default)' },
  } },
  list: { doc: 'items one after the other: steps on a line, checks, numbers, bullets', fields: {
    items: { type: 'list', required: true, doc: 'strings, or { title, text?, icon? }' },
    style: { type: 'string', options: ['steps', 'checks', 'numbers', 'bullets'], doc: 'checks by default' },
  } },
  cards: { doc: 'two to four cards: an icon, a title, a line', fields: {
    items: { type: 'items', required: true, doc: '[{ icon, title, text }]' },
  } },
  quote: { doc: 'what someone says, their name and role', fields: {
    quote: { type: 'string', required: true, doc: 'the words, up to about 20' },
    name: { type: 'string', doc: 'who says it' },
    role: { type: 'string', doc: 'their role and company' },
    avatar: { type: 'string', doc: 'an image asset of their face' },
    emphasis: { type: 'strings', doc: 'words of the quote in the accent (one or two)' },
  } },
  button: { doc: 'a call to act, pressed near the end of the scene', fields: {
    text: { type: 'string', required: true, doc: 'its label' },
    icon: { type: 'string', doc: 'an icon before the label' },
  } },
  image: { doc: 'a picture of the project, framed, slowly moving', fields: {
    image: { type: 'string', required: true, doc: 'an image asset' },
    fit: { type: 'string', options: ['cover', 'contain'], doc: 'cover by default' },
  } },
  motif: { doc: 'the style\'s motif as an image of its own: the signature device', fields: {
    pattern: { type: 'string', options: ['burst', 'frames', 'orbit', 'trail', 'field'], doc: 'burst by default' },
  } },
};

const fits = (f: Field, v: unknown): boolean => {
  switch (f.type) {
    case 'string': return typeof v === 'string' && (!f.options || f.options.includes(v));
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    case 'strings': return Array.isArray(v) && v.every((x) => typeof x === 'string');
    case 'numbers': return Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x));
    case 'items': return Array.isArray(v) && v.every((x) => x && typeof x === 'object' && !Array.isArray(x));
    case 'list': return Array.isArray(v) && v.every((x) => typeof x === 'string' || (x && typeof x === 'object' && !Array.isArray(x)));
    case 'object': return !!v && typeof v === 'object' && !Array.isArray(v);
  }
};
const expected = (f: Field) => (f.options ? `one of ${f.options.join(', ')}` : { string: 'a string', number: 'a number', boolean: 'true or false', strings: 'a list of strings', numbers: 'a list of numbers', items: 'a list of objects', list: 'a list', object: 'an object' }[f.type]);

const FILM_KEYS = ['title', 'format', 'fps', 'seed', 'concept', 'brand', 'style', 'music', 'scenes'];
const SCENE_KEYS = ['beats', 'seconds', 'layout', 'flip', 'bg', 'camera', 'transition', 'elements'];
/** what the style takes, its options */
const STYLE: Record<string, readonly string[] | 'palette' | 'boolean'> = {
  preset: Object.keys(PRESETS), mode: MODES, palette: 'palette', scheme: SCHEMES, display: familyNames, text: familyNames, upper: 'boolean',
  scale: SCALES, motion: MOTIONS, texture: TEXTURES, background: BACKGROUNDS, corners: CORNERS, transition: TRANSITIONS, motif: MOTIFS, glow: 'boolean',
};

/**
 * The film with its defaults, and the problems found (empty when it can be
 * built). `size` and `fps` are the composition's own when the film does not
 * set them; `assets` the project's, for the logo, fonts and sounds named.
 */
export function readFilm(input: unknown, o: { size?: [number, number]; fps?: number; assets?: Record<string, { type: string }> } = {}): { film: Film | null; issues: string[] } {
  const issues: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { film: null, issues: ['the film is an object: { concept, style, scenes: [...] }'] };
  const s = input as FilmSpec;
  for (const k of Object.keys(s)) if (!FILM_KEYS.includes(k)) issues.push(`unknown key "${k}" (the film takes ${FILM_KEYS.join(', ')})`);
  let size: [number, number] = o.size ?? FORMATS['16:9'];
  if (typeof s.format === 'string') {
    if (s.format in FORMATS) size = FORMATS[s.format as FormatName];
    else issues.push(`format "${s.format}": one of ${Object.keys(FORMATS).join(', ')}, or [width, height]`);
  } else if (Array.isArray(s.format)) {
    if (s.format.length === 2 && s.format.every((n) => Number.isInteger(n) && n >= 64 && n <= 8192)) size = [s.format[0], s.format[1]];
    else issues.push('format: [width, height] in px, from 64 to 8192');
  }
  const asset = (id: unknown, type: string, where: string) => {
    if (id === undefined) return;
    if (typeof id !== 'string' || !o.assets?.[id]) issues.push(`${where}: "${String(id)}" is not an asset of the project`);
    else if (o.assets[id].type !== type) issues.push(`${where}: "${id}" is a ${o.assets[id].type} asset, a ${type} one is expected`);
  };
  const brand: Brand = { ...(s.brand ?? {}) };
  if (brand.colors !== undefined && !(Array.isArray(brand.colors) && brand.colors.every(isHex))) issues.push('brand.colors: colours as #RRGGBB');
  asset(brand.logo, 'image', 'brand.logo');
  asset(brand.font, 'font', 'brand.font');
  asset(brand.textFont, 'font', 'brand.textFont');
  const style: StyleSpec = { ...(s.style ?? {}) };
  for (const [k, v] of Object.entries(style)) {
    const allowed = STYLE[k];
    if (!allowed) { issues.push(`style: unknown key "${k}" (it takes ${Object.keys(STYLE).join(', ')})`); continue; }
    if (allowed === 'boolean') { if (typeof v !== 'boolean') issues.push(`style.${k}: true or false`); continue; }
    if (allowed === 'palette') {
      if (!v || typeof v !== 'object') { issues.push('style.palette: { bg, surface, ink, muted, accent, accent2 } as #RRGGBB'); continue; }
      for (const [pk, pv] of Object.entries(v)) if (!['bg', 'surface', 'ink', 'muted', 'accent', 'accent2'].includes(pk) || !isHex(pv)) issues.push(`style.palette.${pk}: a colour as #RRGGBB of bg, surface, ink, muted, accent, accent2`);
      continue;
    }
    if (typeof v !== 'string' || !allowed.some((a) => a.toLowerCase() === v.toLowerCase())) issues.push(`style.${k} "${String(v)}": one of ${allowed.join(', ')}`);
  }
  const bpm = s.music?.bpm ?? 116;
  if (!(bpm >= 40 && bpm <= 220)) issues.push('music.bpm: from 40 to 220');
  if (s.music?.mood !== undefined && !MOODS.includes(s.music.mood)) issues.push(`music.mood: one of ${MOODS.join(', ')}`);
  asset(s.music?.asset, 'audio', 'music.asset');
  const fps = s.fps ?? o.fps ?? 30;
  if (![24, 25, 30, 50, 60].includes(fps)) issues.push('fps: 24, 25, 30, 50 or 60');
  if (!Array.isArray(s.scenes) || !s.scenes.length) issues.push('scenes: at least one scene');
  (Array.isArray(s.scenes) ? s.scenes : []).forEach((scene, i) => {
    const at = `scenes[${i}]`;
    if (!scene || typeof scene !== 'object') { issues.push(`${at}: an object { layout, elements: [...] }`); return; }
    for (const k of Object.keys(scene)) if (!SCENE_KEYS.includes(k)) issues.push(`${at}: unknown key "${k}" (a scene takes ${SCENE_KEYS.join(', ')})`);
    if (scene.layout !== undefined && !LAYOUTS.includes(scene.layout)) issues.push(`${at}.layout "${String(scene.layout)}": one of ${LAYOUTS.join(', ')}`);
    if (scene.camera !== undefined && !CAMERAS.includes(scene.camera)) issues.push(`${at}.camera "${String(scene.camera)}": one of ${CAMERAS.join(', ')}`);
    if (scene.transition !== undefined && !(TRANSITIONS as readonly string[]).includes(scene.transition)) issues.push(`${at}.transition "${String(scene.transition)}": one of ${TRANSITIONS.join(', ')}`);
    if (scene.bg !== undefined && !(BACKGROUNDS as readonly string[]).includes(scene.bg)) issues.push(`${at}.bg "${String(scene.bg)}": one of ${BACKGROUNDS.join(', ')}`);
    if (scene.beats !== undefined && !(typeof scene.beats === 'number' && scene.beats >= 1 && scene.beats <= 64)) issues.push(`${at}.beats: from 1 to 64`);
    if (scene.seconds !== undefined && !(typeof scene.seconds === 'number' && scene.seconds >= 0.5 && scene.seconds <= 30)) issues.push(`${at}.seconds: from 0.5 to 30`);
    if (!Array.isArray(scene.elements) || !scene.elements.length) { issues.push(`${at}.elements: one to six elements`); return; }
    if (scene.elements.length > 6) issues.push(`${at}.elements: six at most (one idea per scene)`);
    scene.elements.forEach((el, j) => {
      const where = `${at}.elements[${j}]`, def = el && ELEMENTS[el.type];
      if (!def) { issues.push(`${where}.type "${String(el?.type)}": one of ${Object.keys(ELEMENTS).join(', ')}`); return; }
      for (const [k, v] of Object.entries(el)) {
        if (k === 'type') continue;
        const f = def.fields[k];
        if (!f) issues.push(`${where} (${el.type}): unknown field "${k}" (it takes ${Object.keys(def.fields).join(', ')})`);
        else if (!fits(f, v)) issues.push(`${where}.${k}: ${expected(f)}`);
      }
      for (const [k, f] of Object.entries(def.fields)) if (f.required && el[k] === undefined) issues.push(`${where} (${el.type}): "${k}" is required (${f.doc})`);
      for (const k of ['image', 'avatar'] as const) if (typeof el[k] === 'string') asset(el[k], 'image', `${where}.${k}`);
    });
  });
  if (issues.length) return { film: null, issues };
  const dark = (style.mode ?? (style.preset ? PRESETS[style.preset]?.mode : undefined) ?? 'dark') === 'dark';
  const mood = s.music?.mood ?? (style.motion === 'dreamy' ? 'calm' : dark ? 'drive' : 'bright');
  return {
    film: { title: s.title ?? brand.name ?? 'Film', width: size[0], height: size[1], fps, seed: typeof s.seed === 'number' ? Math.abs(Math.round(s.seed)) : seedOf(`${s.title ?? ''}|${s.concept ?? ''}`), concept: s.concept ?? '', brand, style, bpm, mood, music: s.music?.asset, bed: s.music?.bed !== false, effects: s.music?.effects !== false, scenes: s.scenes },
    issues,
  };
}

/**
 * The seed of a film that names none: its title and concept hashed (FNV-1a),
 * so two films differ in their little choices and their music, and a film
 * whose scenes change keeps them.
 */
function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return ((h >>> 0) % 9973) + 1;
}

/** a scene's length in seconds: its seconds, or its beats (8 by default) at the film's tempo */
export const sceneSeconds = (film: Film, scene: SceneSpec) => Math.round((scene.seconds ?? ((scene.beats ?? 8) * 60) / film.bpm) * 1000) / 1000;
