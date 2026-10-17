// Films from a description: the assistant directs (an idea, a structure, an
// art direction, scenes composed of elements) and this package builds the
// compositions, the same in the editor and on the command line. The craft
// (palettes, type, layouts, entrances, cameras, passes, finish, sound) lives
// here once, so a film costs the model a page of JSON rather than hundreds of
// operations, and its guide teaches a method rather than a template: the same
// brief can be directed many ways, each of them well.

import { buildFilm, type FilmBuild } from './compile.ts';
import { FAMILIES } from './fonts.ts';
import { iconNames } from './icons.ts';
import { CAMERAS, ELEMENTS, FORMATS, LAYOUTS, MOODS, readFilm, TREATMENTS, type Film } from './spec.ts';
import { BACKGROUNDS, MOTIFS, MOTIONS, PRESETS, SCHEMES, TRANSITIONS } from './style.ts';
import { UI_KINDS } from './ui.ts';

export { buildFilm, type FilmBuild } from './compile.ts';
export { filmOps, filmTarget, madeByFilm, SPEC_ASSET, SPEC_PATH } from './apply.ts';
export { FAMILIES, familyOf, fontAsset, fontFile, type Family, type FontFile } from './fonts.ts';
export { PRESETS, resolveStyle, type Style, type StyleSpec } from './style.ts';
export { CAMERAS, ELEMENTS, FORMATS, LAYOUTS, readFilm, sceneSeconds, TREATMENTS, type Brand, type ElementSpec, type Film, type FilmSpec, type FormatName, type SceneSpec } from './spec.ts';
export { review } from './review.ts';
export { textWidth, wrap, fit } from './metrics.ts';
export { ICONS, iconNames } from './icons.ts';
export { UI_KINDS } from './ui.ts';

/** the film tool's input: the description itself (checked field by field by readFilm) */
export const FILM_INPUT = {
  type: 'object',
  properties: {
    title: { type: 'string', title: 'Title' },
    concept: { type: 'string', title: 'Concept', description: 'the idea of the film in one sentence, its own' },
    format: { title: 'Format', description: `${Object.keys(FORMATS).join(', ')}, or [width, height]; the composition's size by default` },
    fps: { type: 'integer', minimum: 24, maximum: 60, title: 'Frame rate' },
    seed: { type: 'integer', minimum: 0, title: 'Seed', description: 'another take of the same description: positions, angles, chords' },
    brand: { type: 'object', title: 'Brand', description: '{ name, logo (image asset), colors (["#RRGGBB", …]: the accent first), font and textFont (font assets of the project), url }' },
    style: { type: 'object', title: 'Art direction', description: '{ preset?, mode, palette, scheme, display, text, upper, scale, motion, texture, background, corners, transition, motif, glow } (see film-guide)' },
    music: { type: 'object', title: 'Music', description: `{ bpm, mood (${MOODS.join(', ')}), asset (a sound of the project), bed (false: no music made), effects (false: no whooshes, hits, clicks) }` },
    scenes: { type: 'array', title: 'Scenes', description: 'in order: { layout?, flip?, beats or seconds, camera?, bg?, transition?, elements: [...] }' },
  },
  required: ['scenes'],
} as const;

/** stories a film can tell, and what each is for: the model picks one, or invents its own */
const STRUCTURES: Record<string, string> = {
  'problem, turn, proof': 'the pain in the viewer\'s words, the turn (the product), proof shown working, the call: a tool that removes a pain',
  'one claim, three proofs': 'a bold claim, three proofs each told differently (a figure, the product, a voice), the name: confidence',
  'the changing word': 'one line whose last word keeps changing (swap), carried through the film: a platform that does many things, a manifesto',
  'before and after': 'the same composition twice, mirrored (flip), the old way then the new: a change you can see',
  'the number': 'a figure that grows into the story, each scene adding what it means: results, data, a report',
  'the journey': 'steps on a line, a day in a life, from sign-up to the first win: a process, onboarding',
  'cold open': 'the product already in use, no title; the name and the claim come last: a teaser, an app',
  'question and answer': 'a question asked in the first scene, answered in the last: curiosity, a reframe',
  'countdown': 'three (or five) things, counted, each scene its own composition: features, reasons',
  'manifesto': 'big type alone, one statement a scene, hard rhythm, the logo at the end: a brand, a movement',
};

const LAYOUT_DOCS: Record<typeof LAYOUTS[number], string> = {
  center: 'one column in the middle, words over what is shown: a statement, an end card',
  left: 'the words on the left, what is shown across from them (flip: mirrored)',
  right: 'the words on the right, what is shown across from them',
  split: 'two halves, the visual given a little more room',
  poster: 'a huge headline across the frame, a visual small in a corner: a claim, a manifesto',
  grid: 'a title above, several visuals in cells: features, comparisons',
  full: 'the visual takes the frame, a small title over it: a product moment',
  corner: 'the visual large, the words low in a corner: cinematic, a caption',
};
const CAMERA_DOCS: Record<typeof CAMERAS[number], string> = {
  still: 'no move: a moment to read, a mechanical style',
  push: 'slowly in, the content coming forward: a statement',
  pull: 'back from close: a reveal, an ending',
  drift: 'a sideways float: beside a product',
  pan: 'a level glide across: wide layouts, lists',
  rise: 'upward: growth, lift',
  punch: 'starts close and snaps back: energy, on a beat',
};
const TREATMENT_DOCS: Record<typeof TREATMENTS[number], string> = {
  mask: 'words rise from under their line',
  blur: 'words clear from a blur',
  fade: 'a soft rise and fade',
  type: 'typed with a caret: a prompt, a search, code',
  letters: 'letter by letter, popping: a name, one short word',
  scale: 'words pop from small: a punch',
  swap: 'the last word gives way to others in turn (swap: ["…", "…"]), the last one staying: alternatives',
  highlight: 'a marker sweeps behind the emphasis words',
  underline: 'a line drawn under the emphasis words',
  split: 'lines slide in from both sides: a confrontation',
};
const MOTION_DOCS: Record<typeof MOTIONS[number], string> = {
  snappy: 'quick, crisp, a small kick: tech, sport, sales',
  smooth: 'long eased glides: premium products, most launches',
  elastic: 'overshoots and settles: playful, consumer, creative',
  mechanical: 'precise, even, stepped: developer tools, engineering',
  dreamy: 'slow, soft, floating, dissolving: lifestyle, luxury, calm',
};
const BACKGROUND_DOCS: Record<typeof BACKGROUNDS[number], string> = {
  flat: 'the plain ground: graphic, confident',
  light: 'planes of light sweeping across: premium tech on dark',
  glow: 'soft pools of the brand\'s light',
  gradient: 'one wide gradient of the accents',
  mesh: 'soft tinted blobs: friendly, light',
  grid: 'a fine grid fading out: technical, data',
  dots: 'a dot grid: calm tech',
  lines: 'parallel lines at an angle: editorial, motion',
  shapes: 'the motif large and faint, drifting: playful, brand',
  floor: 'a grid floor running to a horizon: futuristic, developer',
  paper: 'warm light on paper: editorial, warm',
};
const TRANSITION_DOCS: Record<typeof TRANSITIONS[number], string> = {
  cut: 'a hard cut on the beat',
  push: 'forward through a blur into the next',
  slide: 'the next slides in from the right',
  whip: 'a fast blurred whip pan',
  zoom: 'through the scene into the next, from close',
  dissolve: 'one melts into the next: calm',
  wipe: 'a band of the accents wipes across',
  iris: 'the next opens in a circle from the centre',
  motif: 'the motif sweeps across, large: the signature pass',
  flash: 'a hard cut with a flash of light',
};
const SCHEME_DOCS: Record<typeof SCHEMES[number], string> = {
  mono: 'a lighter or darker shade of the accent',
  analogous: 'a neighbouring hue',
  duotone: 'a distinct second hue',
  complement: 'the opposite hue',
  vivid: 'a saturated split complement',
};

/** a chance of the clock, or of a seed (the tests) */
function chance(seed?: number) {
  let s = seed ?? Math.floor(Math.random() * 2 ** 31);
  return <T>(list: readonly T[]): T => { s = (s * 1103515245 + 12345) % 2 ** 31; return list[s % list.length]; };
}

/**
 * The guide the model reads before directing a film: the method, the
 * principles, the clichés to avoid, the whole vocabulary, and a starting hand
 * drawn at random (a structure, a mode, a voice of type, a motion, a pass, a
 * motif, a ground), so the same brief asked twice starts from two directions.
 */
export function filmGuide(seed?: number): string {
  const draw = chance(seed);
  const kinds = [...new Set(FAMILIES.filter((f) => f.kind !== 'mono').map((f) => f.kind))];
  const list = (docs: Record<string, string>) => Object.entries(docs).map(([k, d]) => `${k} (${d})`).join('; ');
  const field = (k: string, f: { type: string; doc: string; required?: boolean; options?: readonly string[] }) => `${k}${f.required ? '' : '?'}${f.options ? ` (${f.options.join('|')})` : ''}: ${f.doc}`;
  return [
    'A film is a description this tool builds into compositions, motion and sound:',
    '{ title?, concept, format?, fps?, seed?, brand?, style, music?, scenes: [{ layout?, flip?, beats?, camera?, bg?, transition?, elements: [...] }] }',
    '',
    'How to direct it',
    '1. The idea. Write the concept first: one sentence only this subject could have, not "a modern launch video". Give it a signature: one device that comes back and pays off (the motif, a word that keeps changing, a number that climbs, a line that draws itself, a mirrored composition).',
    '2. The structure. Choose the one that tells this story, or invent one; never default to title, logo, figure, end card:',
    ...Object.entries(STRUCTURES).map(([k, d]) => `   - ${k}: ${d}`),
    '3. The direction, decided from the subject, its audience and its brand: mode, palette (the brand\'s colours become the accents, the scheme derives the rest), a display face whose voice fits and a quiet text face, the motion, the grounds, the texture, the corners, the pass between scenes, the motif. A preset is a starting point to bend (change three of its choices at least), never the answer.',
    '4. The scenes: one idea each. Vary the composition (layout, flip), the scale (one scene almost empty around a huge word, the next dense with the product), the length (2 or 4 beats for a punch, 8 to 16 to read or watch), the camera and the entrances. Words and figures come from the brief and the sources, as they are: a figure nobody gave is left out.',
    '5. Build (film), then look (film-review: a frame of each scene and an art director\'s notes). Fix what it shows in one more build, then stop.',
    '',
    'A starting hand for this film, drawn at random: take it unless it fights the brief or the brand, and say what you kept.',
    `   structure: ${draw(Object.keys(STRUCTURES))}; mode: ${draw(['dark', 'light'])}; display voice: ${draw(kinds)}; motion: ${draw(MOTIONS)}; pass: ${draw(TRANSITIONS.filter((t) => t !== 'cut'))}; motif: ${draw(MOTIFS.filter((m) => m !== 'none'))}; ground: ${draw(BACKGROUNDS)}`,
    '',
    'Principles',
    '- Hierarchy: one thing first in every frame. The accent marks one or two words, the action or the number, never everything.',
    '- Reading takes time: about three words a second, plus a beat. A headline is two to eight words; the rest goes to a line under it or to the next scene.',
    '- Contrast: big against small, empty against full, still against fast, dark against light.',
    '- Rhythm: scenes are counted in beats and cut on them; alternate lengths; the music drops on the first reveal (a logo, the motif bursting).',
    '- Motion means something: swap for alternatives, highlight or underline for the word that matters, type for a prompt or code, letters for a name, split for a confrontation, scale for a punch.',
    '- The product is the proof: an interface, a device, code or a chart, large, one at a time, doing something.',
    '- End on the brand: the logo, a line, a call to act.',
    '',
    'Avoid (what makes a film look generated)',
    '- every scene centred, every headline entering the same way, every scene the same length, every pass a push;',
    '- sentences as headlines; "Introducing…", "The future of…", "Revolutionize", "Seamless"; three cards of Fast, Secure, Simple;',
    '- the accent on everything; glows and blobs with nothing to light;',
    '- a number without what it measures; figures, names or quotes nobody gave.',
    '',
    'Vocabulary',
    `format: ${Object.keys(FORMATS).join(' | ')} | [width, height]. fps: 24, 25, 30, 50, 60. seed: another take of the same description (positions, angles, chords).`,
    'brand: { name, logo (image asset), colors (["#accent", "#second"]), font and textFont (font assets of the project), url }.',
    `music: { bpm (40 to 220, 116 by default: scenes are counted in its beats), mood (${MOODS.join(' | ')}: from the style by default), asset (a sound of the project instead), bed: false (no music made), effects: false (no whooshes, hits, clicks) }.`,
    'style: { preset?, mode, palette?, scheme, display, text, upper, scale, motion, texture, background, corners, transition, motif, glow }',
    '   mode: dark | light. palette: any of { bg, surface, ink, muted, accent, accent2 } as #RRGGBB, the rest derived (the ground and the ink keep a trace of the accent\'s hue, contrast is kept).',
    `   scheme (the second accent from the first): ${list(SCHEME_DOCS)}.`,
    '   scale: quiet | balanced | dramatic (huge headlines). upper: headlines in capitals. corners: sharp | soft | round. texture: none | grain | paper | film. glow: light that blooms (cinematic) or none (flat, graphic).',
    `   motion: ${list(MOTION_DOCS)}.`,
    `   background (each scene's ground; a scene may take another with bg): ${list(BACKGROUND_DOCS)}.`,
    `   transition (the pass between scenes; a scene may choose its own into the next): ${list(TRANSITION_DOCS)}.`,
    `   motif (the shape that comes back: in the shapes ground, the motif element, the motif pass): ${MOTIFS.join(', ')} (logo: the brand's picture).`,
    `   display and text, by name (their files come with the film): ${FAMILIES.map((f) => `${f.name} (${f.kind}: ${f.voice}${f.upper ? '; capitals' : ''})`).join('; ')}.`,
    `   presets, starting points: ${Object.entries(PRESETS).map(([k, p]) => `${k} (${p.about}: ${p.mode}, ${p.display}, ${p.motion}, ${p.background}, ${p.transition}, motif ${p.motif})`).join('; ')}.`,
    'scene: { layout?, flip? (mirrored), beats? (8 by default) or seconds?, camera? (from the layout by default), bg?, transition? (into the next), elements: one to six, entering in the order written }',
    `   layout: ${list(LAYOUT_DOCS)}.`,
    `   camera: ${list(CAMERA_DOCS)}.`,
    'elements: { type, ...its fields }',
    ...Object.entries(ELEMENTS).map(([type, e]) => `   ${type}: ${e.doc}. ${Object.entries(e.fields).map(([k, f]) => field(k, f)).join('; ')}`),
    `   treatment (how a text enters; the motion's own by default): ${list(TREATMENT_DOCS)}.`,
    `interface items (ui and device elements: { title?, subtitle?, items: [...] }): ${Object.values(UI_KINDS).join('; ')}.`,
    `icons: ${iconNames.join(', ')}.`,
  ].join('\n');
}

/** reads and builds a film in one go: the build, or the problems of the description */
export function compileFilm(input: unknown, o: { comp: string; size?: [number, number]; fps?: number; assets?: Record<string, { type: string; family?: string }>; sound?: boolean }): { build: FilmBuild; film: Film } | { issues: string[] } {
  const { film, issues } = readFilm(input, { size: o.size, fps: o.fps, assets: o.assets });
  if (!film) return { issues };
  const families = Object.fromEntries(Object.entries(o.assets ?? {}).filter(([, a]) => a.type === 'font' && a.family).map(([id, a]) => [id, a.family!]));
  return { build: buildFilm(film, { comp: o.comp, families, sound: o.sound }), film };
}
