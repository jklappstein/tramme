// The review an art director gives before a film leaves the room: what the
// description does that good films avoid (the same composition three times
// running, every headline entering the same way, more words than a scene
// leaves time to read, a scene that holds too long on too little, a palette
// that does not read, an ending without the brand), each named with its
// place and what to do instead. It reads the description; the build adds
// what it had to give up (a picture shrunk to fit, a headline set smaller),
// and a contact sheet of the frames shows the rest.

import { wordCount as count } from './build.ts';
import { itemsOf } from './elements.ts';
import { rolesOf } from './layouts.ts';
import { cameraOf } from './scenes.ts';
import { sceneSeconds, type ElementSpec, type Film } from './spec.ts';
import { paletteContrast, type Style } from './style.ts';
import { defaultTreatment } from './text.ts';


/** the words a viewer reads in an element: the lines under the titles of cards and lists are skimmed (half); an interface, code or a picture is looked at, not read */
function wordsOf(el: ElementSpec): number {
  switch (el.type) {
    case 'text': case 'button': return count(el.text);
    case 'figure': return count(el.value) + count(el.label) + count(el.context);
    case 'chart': return count(el.title) + count(el.value) + count(el.delta);
    case 'quote': return count(el.quote) + count(el.name) + count(el.role);
    case 'logo': return count(el.tagline);
    case 'list': case 'cards': return itemsOf(el).reduce((s, it) => s + count(it.title) + count(it.text) / 2, 0);
    default: return 0;
  }
}

/** what the review finds in a film, one line each, with its place and what to do */
export function review(film: Film, style: Style): string[] {
  const out: string[] = [], scenes = film.scenes, n = scenes.length, beat = 60 / film.bpm;
  if (!film.concept.trim()) out.push('no concept: say the idea of the film in one sentence (concept), then let every scene serve it');

  /** three scenes or more in a row that do the same */
  const runs = (values: string[], what: string, advice: string) => {
    let from = 0;
    for (let i = 1; i <= values.length; i++) {
      if (i < values.length && values[i] === values[from]) continue;
      if (i - from >= 3) out.push(`scenes ${from + 1} to ${i} all ${what} ${values[from]}: ${advice}`);
      from = i;
    }
  };
  runs(scenes.map((s) => s.layout ?? 'center'), 'use the layout', 'change the composition from one to the next (left, split, poster, full, corner…)');
  runs(scenes.map((s, i) => cameraOf(s, i, style.motion)), 'have the camera', 'let one hold still, another drift or punch');

  const heads = scenes.flatMap((s) => { const r = rolesOf(s.elements); return s.elements.filter((_, j) => r[j] === 'headline'); });
  const ways = heads.map((e) => (e.treatment as string | undefined) ?? defaultTreatment(style.motion));
  if (heads.length >= 4 && new Set(ways).size === 1) out.push(`every headline enters the same way (${ways[0]}): give the lines that matter their own entrance (letters, highlight, swap, split…)`);

  const lengths = scenes.map((s) => sceneSeconds(film, s));
  if (n >= 5 && new Set(lengths).size === 1) out.push(`every scene runs ${lengths[0].toFixed(1)} s: vary the rhythm (a short punch of 2 or 4 beats between longer scenes)`);
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total > 60) out.push(`the film runs ${Math.round(total)} s: a promo holds attention for 15 to 45; cut scenes`);

  scenes.forEach((s, i) => {
    const at = `scene ${i + 1}`, dur = lengths[i], roles = rolesOf(s.elements);
    const words = Math.round(s.elements.reduce((sum, e) => sum + wordsOf(e), 0)), need = 0.8 + words / 3;
    if (dur < need * 0.85) out.push(`${at}: ${words} words in ${dur.toFixed(1)} s, too fast to read: cut words, or give it ${Math.ceil(need / beat / 2) * 2} beats`);
    else if (s.elements.every((e) => e.type === 'text') && words <= 4 && dur > 4.6) out.push(`${at} holds ${words} word${words === 1 ? '' : 's'} for ${dur.toFixed(1)} s: shorten it (4 beats) or give the eye something to follow`);
    if (s.elements.length > 4) out.push(`${at}: ${s.elements.length} elements: one idea per scene, split it`);
    s.elements.forEach((e, j) => {
      if (e.type !== 'text') return;
      const w = count(e.text);
      if (roles[j] === 'headline' && w > 9) out.push(`${at}: a headline of ${w} words: two to eight carry better, move the rest to a line under it or to the next scene`);
      if (roles[j] === 'headline' && style.upper && w > 6) out.push(`${at}: ${w} words in capitals read slowly: keep the capitals for short lines`);
      if (Array.isArray(e.emphasis) && e.emphasis.length > 2) out.push(`${at}: ${e.emphasis.length} words in the accent: keep it for one or two`);
      if (e.treatment === 'swap' && !(Array.isArray(e.swap) && e.swap.length)) out.push(`${at}: the swap treatment without words to swap (swap: ["…", "…"]): the last word stays as it is`);
    });
  });

  const pc = paletteContrast(style);
  if (pc.ink < 4.5) out.push(`the ink reads at ${pc.ink.toFixed(1)}:1 on the ground: titles want 4.5:1 at least, darken or lighten palette.ink`);
  if (pc.muted < 3) out.push(`secondary text reads at ${pc.muted.toFixed(1)}:1 on the ground: bring palette.muted closer to the ink`);
  if (style.text.kind === 'expressive' || style.text.kind === 'condensed') out.push(`${style.text.name} as the text face: a quiet face (Inter, Manrope, Sora) reads better under ${style.display.name}`);

  const end = scenes[n - 1]?.elements ?? [];
  if ((film.brand.name || film.brand.logo) && n > 1 && !end.some((e) => e.type === 'logo')) out.push('the film does not end on the brand: close on the logo, with a line or a call to act');
  return out;
}
