// The art direction of a film, decided by the model and resolved here into
// everything the scenes draw with: a palette derived from the brand by a
// colour scheme (or written out), a display face and a text face from the
// catalogue, a type scale, a motion personality (curves, pace, stagger), a
// texture, the backgrounds, the corners of the cards, the passes between
// scenes, a motif. A few presets are starting points, never the answer.

import type { Effect, Token } from '@tramme/core';
import { contrast, hexToHsl, hslToHex, isHex, legible, mix, turn, withAlpha } from './color.ts';
import { FAMILIES, familyOf, type Family } from './fonts.ts';

export const MODES = ['dark', 'light'] as const;
export const SCHEMES = ['mono', 'analogous', 'duotone', 'complement', 'vivid'] as const;
export const SCALES = ['quiet', 'balanced', 'dramatic'] as const;
export const MOTIONS = ['snappy', 'smooth', 'elastic', 'mechanical', 'dreamy'] as const;
export const TEXTURES = ['none', 'grain', 'paper', 'film'] as const;
export const BACKGROUNDS = ['flat', 'light', 'glow', 'gradient', 'mesh', 'grid', 'dots', 'lines', 'shapes', 'floor', 'paper'] as const;
export const CORNERS = ['sharp', 'soft', 'round'] as const;
export const TRANSITIONS = ['cut', 'push', 'slide', 'whip', 'zoom', 'dissolve', 'wipe', 'iris', 'motif', 'flash'] as const;
export const MOTIFS = ['none', 'bars', 'circle', 'square', 'line', 'dot', 'frame', 'plus', 'logo'] as const;

export type Motion = typeof MOTIONS[number];
export type Background = typeof BACKGROUNDS[number];
export type Transition = typeof TRANSITIONS[number];
export type Motif = typeof MOTIFS[number];

/** the art direction as the model writes it: every key optional, a preset to start from */
export interface StyleSpec {
  preset?: string;
  mode?: typeof MODES[number];
  /** colours written out; what is missing is derived */
  palette?: { bg?: string; surface?: string; ink?: string; muted?: string; accent?: string; accent2?: string };
  /** how the second accent comes from the first */
  scheme?: typeof SCHEMES[number];
  display?: string;
  text?: string;
  /** headlines in capitals */
  upper?: boolean;
  scale?: typeof SCALES[number];
  motion?: Motion;
  texture?: typeof TEXTURES[number];
  background?: Background;
  corners?: typeof CORNERS[number];
  transition?: Transition;
  motif?: Motif;
  /** light that blooms (glows, flares): a lit, cinematic picture rather than a flat one */
  glow?: boolean;
}

/** the curves and tempo of a motion personality */
interface MotionTokens { enter: number[]; exit: number[]; standard: number[]; emphasized: number[]; pop: number[]; pace: number; stagger: number; blur: number }

const MOTION: Record<Motion, MotionTokens> = {
  snappy: { enter: [0.2, 0.9, 0.1, 1], exit: [0.7, 0, 0.84, 0], standard: [0.6, 0, 0.2, 1], emphasized: [0.2, 0, 0, 1], pop: [0.3, 1.45, 0.6, 1], pace: 0.42, stagger: 0.04, blur: 0.12 },
  smooth: { enter: [0.16, 1, 0.3, 1], exit: [0.7, 0, 0.84, 0], standard: [0.65, 0, 0.35, 1], emphasized: [0.2, 0, 0, 1], pop: [0.34, 1.3, 0.64, 1], pace: 0.7, stagger: 0.065, blur: 0.2 },
  elastic: { enter: [0.34, 1.56, 0.64, 1], exit: [0.6, -0.28, 0.74, 0.05], standard: [0.5, 0, 0.2, 1.2], emphasized: [0.3, 1.8, 0.5, 1], pop: [0.34, 1.9, 0.5, 1], pace: 0.6, stagger: 0.05, blur: 0 },
  mechanical: { enter: [0.75, 0, 0.25, 1], exit: [0.75, 0, 0.25, 1], standard: [0.8, 0, 0.2, 1], emphasized: [0.9, 0, 0.1, 1], pop: [0.75, 0, 0.25, 1], pace: 0.5, stagger: 0.03, blur: 0 },
  dreamy: { enter: [0.25, 0.4, 0.25, 1], exit: [0.5, 0, 0.75, 0], standard: [0.45, 0, 0.55, 1], emphasized: [0.3, 0, 0.1, 1], pop: [0.3, 1.15, 0.6, 1], pace: 1.15, stagger: 0.11, blur: 0.35 },
};

/** starting points: whole directions to take as they are or to bend */
export const PRESETS: Record<string, StyleSpec & { about: string }> = {
  midnight: { about: 'near black, electric light, glass cards: a premium tech launch', mode: 'dark', palette: { accent: '#3D5BFF', accent2: '#8EA2FF' }, display: 'Inter', text: 'Inter', scale: 'balanced', motion: 'smooth', texture: 'grain', background: 'light', corners: 'soft', transition: 'push', motif: 'line', glow: true },
  daylight: { about: 'bright, white cards, soft shadows, pale tints: SaaS everyone trusts', mode: 'light', palette: { accent: '#5452F6', accent2: '#1FC2A7' }, display: 'Manrope', text: 'Inter', scale: 'balanced', motion: 'smooth', texture: 'none', background: 'mesh', corners: 'soft', transition: 'slide', motif: 'circle' },
  paper: { about: 'warm paper and ink, serif titles: the explainer of a good newspaper', mode: 'light', palette: { bg: '#F2EDE4', accent: '#C2410C', accent2: '#1E3A8A' }, display: 'Instrument Serif', text: 'Inter', scale: 'balanced', motion: 'dreamy', texture: 'paper', background: 'paper', corners: 'sharp', transition: 'dissolve', motif: 'line' },
  poster: { about: 'loud capitals, flat colour, hard cuts: a manifesto, a sale, sport', mode: 'light', palette: { bg: '#F4F1EA', ink: '#111111', accent: '#E8432E' }, display: 'Anton', text: 'Inter', scale: 'dramatic', motion: 'snappy', texture: 'grain', background: 'flat', corners: 'sharp', transition: 'wipe', motif: 'bars' },
  studio: { about: 'black and one vivid colour, expressive type, playful rhythm: creative tools, culture', mode: 'dark', palette: { bg: '#0D0D0F', accent: '#C6F432', accent2: '#FF5FA2' }, display: 'Bricolage Grotesque', text: 'Inter', scale: 'dramatic', motion: 'elastic', texture: 'grain', background: 'shapes', corners: 'round', transition: 'motif', motif: 'circle' },
  terminal: { about: 'code, mono labels, a grid floor: developer tools', mode: 'dark', palette: { bg: '#070A08', accent: '#3BE27A', accent2: '#7CF0C0' }, display: 'Space Grotesk', text: 'Inter', scale: 'balanced', motion: 'mechanical', texture: 'film', background: 'floor', corners: 'sharp', transition: 'cut', motif: 'square' },
  soft: { about: 'pastel light, rounded serif warmth, gentle moves: lifestyle, food, wellbeing', mode: 'light', palette: { bg: '#FBF5EE', accent: '#E07A5F', accent2: '#3D405B' }, display: 'Fraunces', text: 'Manrope', scale: 'balanced', motion: 'smooth', texture: 'paper', background: 'mesh', corners: 'round', transition: 'dissolve', motif: 'dot' },
  luxe: { about: 'deep tones, a classic serif, slow light: luxury, finance with heritage', mode: 'dark', palette: { bg: '#0E0C0A', ink: '#F3EBDD', accent: '#C9A45C', accent2: '#8C6A3F' }, display: 'Playfair Display', text: 'Manrope', scale: 'quiet', motion: 'dreamy', texture: 'film', background: 'glow', corners: 'sharp', transition: 'dissolve', motif: 'frame' },
};

/** everything the scenes draw with */
export interface Style {
  mode: 'dark' | 'light';
  tokens: Record<string, Token>;
  /** the colours of the tokens, for gradients and blends */
  colors: { bg: string; surface: string; ink: string; muted: string; faint: string; accent: string; accent2: string; glow: string; good: string; bad: string };
  display: Family;
  text: Family;
  mono: Family;
  upper: boolean;
  /** headline size factor */
  scale: number;
  motion: Motion;
  pace: number;
  stagger: number;
  /** how much a word blurs as it enters (em) */
  blur: number;
  texture: string;
  background: Background;
  /** card corner radius, fraction of the frame's short side */
  radius: number;
  transition: Transition;
  motif: Motif;
  glow: boolean;
  finish: Effect[];
}

const c = (value: string, description: string): Token => ({ type: 'color', value, description });
const e = (value: number[], description: string): Token => ({ type: 'ease', value, description });
const n = (value: number, description: string): Token => ({ type: 'number', value, description });

/**
 * The art direction resolved: the preset (if any) under the model's choices,
 * the brand's colours as the accents when the palette does not set them.
 */
export function resolveStyle(spec: StyleSpec, brandColors: string[] = []): Style {
  const preset: StyleSpec = (spec.preset && PRESETS[spec.preset]) || {};
  const s: StyleSpec = { ...preset, ...spec, palette: { ...preset.palette, ...(brandColors[0] ? { accent: brandColors[0], ...(brandColors[1] ? { accent2: brandColors[1] } : {}) } : {}), ...spec.palette } };
  const mode = s.mode ?? 'dark', dark = mode === 'dark';
  const accent0 = s.palette?.accent && isHex(s.palette.accent) ? s.palette.accent : '#3D5BFF';
  const [hue, sat] = hexToHsl(accent0);
  // the ground and the ink carry a trace of the brand's hue
  const bg = s.palette?.bg ?? hslToHex(dark ? [hue, Math.min(0.35, sat * 0.4), 0.045] : [hue, Math.min(0.3, sat * 0.25), 0.965]);
  const ink = s.palette?.ink ?? hslToHex(dark ? [hue, 0.25, 0.95] : [hue, 0.25, 0.09]);
  const surface = s.palette?.surface ?? (dark ? mix(bg, ink, 0.06) : mix(bg, '#FFFFFF', 0.85));
  const muted = s.palette?.muted ?? mix(ink, bg, 0.36);
  const faint = mix(ink, bg, 0.62);
  const accent = legible(accent0, bg, 3);
  const scheme = s.scheme ?? 'analogous';
  const derived = scheme === 'mono' ? turn(accent, 0, { l: dark ? Math.min(0.85, hexToHsl(accent)[2] + 0.2) : Math.max(0.25, hexToHsl(accent)[2] - 0.15) })
    : scheme === 'analogous' ? turn(accent, 32) : scheme === 'duotone' ? turn(accent, 70) : scheme === 'complement' ? turn(accent, 180) : turn(accent, 150, { s: 0.9 });
  const accent2 = legible(s.palette?.accent2 && isHex(s.palette.accent2) ? s.palette.accent2 : derived, bg, 2.6);
  const glow = dark ? accent : mix(accent, '#FFFFFF', 0.62);
  const good = legible(dark ? '#19C98D' : '#11A36A', bg, 3), bad = legible(dark ? '#F5404F' : '#E5484D', bg, 3);
  const display = familyOf(s.display) ?? FAMILIES[0], text = familyOf(s.text) ?? familyOf('Inter')!, mono = familyOf('JetBrains Mono')!;
  const motion = s.motion ?? 'smooth', m = MOTION[motion];
  const texture = s.texture ?? 'grain', glowing = s.glow ?? dark;
  const tokens: Record<string, Token> = {
    plate: c(bg, 'the ground'), plate2: c(surface, 'a raised ground'), ink: c(ink, 'titles'), ink2: c(muted, 'secondary text'), ink3: c(faint, 'faint text, axes'),
    line: c(withAlpha(ink, dark ? 0.1 : 0.12), 'hairlines'), card: c(surface, 'cards'), cardLine: c(withAlpha(ink, dark ? 0.12 : 0.09), 'card borders'),
    accent: c(accent, 'the brand colour'), accent2: c(accent2, 'its companion'), glow: c(glow, 'light'), good: c(good, 'rises, success'), bad: c(bad, 'falls, errors'),
    enter: e(m.enter, 'entrances'), exit: e(m.exit, 'exits'), standard: e(m.standard, 'moves within a scene'), emphasized: e(m.emphasized, 'expressive moves'), pop: e(m.pop, 'a landing that settles'),
    pace: n(m.pace, 'seconds of an entrance'), stagger: n(m.stagger, 'seconds between siblings'),
  };
  return {
    mode, tokens, colors: { bg, surface, ink, muted, faint, accent, accent2, glow, good, bad },
    display, text, mono, upper: s.upper ?? display.upper ?? false,
    scale: { quiet: 0.82, balanced: 1, dramatic: 1.32 }[s.scale ?? 'balanced'],
    motion, pace: m.pace, stagger: m.stagger, blur: m.blur,
    texture, background: s.background ?? (dark ? 'glow' : 'mesh'),
    radius: { sharp: 0.004, soft: 0.02, round: 0.04 }[s.corners ?? 'soft'],
    transition: s.transition ?? 'push', motif: s.motif ?? 'none', glow: glowing,
    finish: finish(texture, glowing, dark),
  };
}

/** the picture's finish: light that blooms on the lit looks, a grain, a vignette */
function finish(texture: string, glow: boolean, dark: boolean): Effect[] {
  const grain = { none: 0, grain: 0.022, paper: 0.03, film: 0.04 }[texture] ?? 0.02;
  return [
    ...(glow ? [{ id: 'bloom', type: 'look.bloom', props: { amount: dark ? 0.32 : 0.12, threshold: 0.72 } }] : []),
    ...(glow && dark ? [{ id: 'chromatic', type: 'look.chromatic', props: { amount: 0.6 } }] : []),
    ...(texture === 'film' ? [{ id: 'grade', type: 'look.grade', props: { lift: 0.01, saturation: 0.94, temperature: 0.03 } }] : []),
    { id: 'vignette', type: 'look.vignette', props: { amount: dark ? 0.26 : texture === 'paper' ? 0.16 : 0.08 } },
    ...(grain ? [{ id: 'grain', type: 'look.grain', props: { amount: grain, seed: { $expr: 'frame + 1' } } }] : []),
  ];
}

/** the readability of the palette, for the review */
export const paletteContrast = (st: Style) => ({ ink: contrast(st.colors.ink, st.colors.bg), muted: contrast(st.colors.muted, st.colors.bg), accent: contrast(st.colors.accent, st.colors.bg) });
