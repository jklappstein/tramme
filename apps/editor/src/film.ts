// A whole film from a description (@tramme/film): the assistant reads the
// guide once (film-guide: the method, the vocabulary, a starting hand drawn
// at random), directs the film in a page (a concept, an art direction,
// scenes composed of elements) and the film tool builds every scene; then
// it looks (film-review: a contact sheet of the frames and an art director's
// notes) and fixes what matters in one more build. The description is kept
// in the project (assets/film/film.json): changing the film is changing it
// and building again, which rebuilds the scenes it made, the user's own
// compositions untouched.

import { runChecks, type Composition, type KitType, type QualityIssue, type ToolContext, type ToolType, type TrammeDoc } from '@tramme/core';
import { compileFilm, FILM_INPUT, fontFile, type FontFile, filmGuide, filmOps, filmTarget, madeByFilm, PRESETS, resolveStyle, SPEC_ASSET, SPEC_PATH } from '@tramme/film';
import { masterText, soundReport } from './mixing.ts';
import { analyses } from './perception.ts';
import { sheetOf, stills } from './review.ts';

/** a font shipped with the editor (fonts/) */
async function shippedFont(name: string): Promise<Uint8Array> {
  const r = await fetch(new URL(`/fonts/${name}`, location.href));
  if (!r.ok) throw new Error(`film: the shipped file fonts/${name} is missing (HTTP ${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

/** the fonts the film needs, copied once into the project (shipped, or fetched the first time a film uses them) */
async function copyFonts(ctx: ToolContext, files: FontFile[]) {
  const have = new Set((await ctx.files()).map((f) => f.path));
  for (const f of files) if (!have.has(f.path)) await ctx.writeFile(f.path, new Blob([await fontFile(f, shippedFont) as BlobPart]));
}

const guide: ToolType<Record<string, never>> = {
  name: 'film-guide', title: 'Film: the guide', description: 'how to direct a film for the film tool: the method, the principles, the whole vocabulary, and a direction to begin from, drawn at random',
  input: { type: 'object', properties: {} },
  ai: { when: 'once, before writing a film with the film tool' },
  run: () => filmGuide(),
};

const film: ToolType<Record<string, unknown>> = {
  name: 'film', title: 'Film from a description',
  description: 'builds a whole film from its direction: a concept, an art direction (palette, type, motion, grounds, passes, motif) and scenes composed of elements (words, figures, charts, interfaces, devices, code, lists, cards, quotes, the logo) in layouts, with their cameras. Every scene becomes a composition, played on the beat with its passes, its finish and its sound. Read film-guide first.',
  input: FILM_INPUT as unknown as ToolType['input'],
  ai: {
    when: 'a whole video from a brief (a launch, an announcement, an ad, an explainer, a teaser, a data story): direct it as a film description rather than laying out scenes by hand; to change it, change the description and run film again (it is kept in assets/film/film.json)',
    avoid: 'laying out by hand what an element and a layout do; editing the layers of a scene and then running film again (it rebuilds them)',
  },
  async run(input, ctx) {
    const doc = ctx.doc, where = filmTarget(doc), base = doc.compositions[doc.root];
    const r = compileFilm(input, { comp: where.comp, size: base ? [base.width, base.height] : undefined, fps: base?.fps, assets: doc.assets });
    if ('issues' in r) throw new Error(`the film cannot be built:\n${r.issues.join('\n')}`);
    const { build } = r;
    await copyFonts(ctx, build.files);
    for (const f of build.made) await ctx.writeFile(f.path, new Blob([f.data as BlobPart], { type: 'audio/wav' }));
    await ctx.writeFile(SPEC_PATH, JSON.stringify(input, null, 2));
    return {
      ops: filmOps(doc, build, where), label: `Film · ${r.film.title}`,
      // the files made again under the same names are read again
      reload: [SPEC_ASSET, ...Object.keys(build.assets).filter((id) => /^film-(music|sfx-)/.test(id))].filter((id) => doc.assets[id]),
      text: `${build.summary}\nNow look at it (use_tool "film-review"), fix what matters in the description and build once more.`,
    };
  },
};

/** the film of the project: its root when the film tool made it, or the first composition it made */
function filmComp(doc: ToolContext['doc']): string | undefined {
  const scenes = (id: string) => Object.values(doc.compositions[id]?.layers ?? {}).some((l) => l.type === 'comp');
  return [doc.root, ...Object.keys(doc.compositions)].find((id) => scenes(id) && madeByFilm(doc, id));
}

/** the film's frames side by side, large enough to judge the type: one picture for the whole film */
async function contactSheet(ctx: ToolContext, comp: Composition, id: string, times: number[], labels: string[]): Promise<string> {
  const cols = Math.min(times.length, comp.width > comp.height * 1.1 ? 3 : comp.height > comp.width * 1.1 ? 5 : 4);
  const w = Math.floor(1900 / cols), h = Math.round((w * comp.height) / comp.width);
  const images = await stills(ctx, times, id);
  return sheetOf(images.map((image, i) => ({ image, label: labels[i] })), w, h, cols);
}

/** a layer of a scene (`scene-02/title`, as the checks name it) drawn inside an interface or a piece of code: its small type is shown, not read */
function inMockup(doc: TrammeDoc, film: string, layer: string): boolean {
  const [outer, inner] = layer.split('/');
  const scene = inner ? doc.compositions[String(doc.compositions[film]?.layers[outer]?.props?.comp ?? '')] : undefined;
  if (!scene) return false;
  const parent = new Map<string, string>();
  for (const [id, l] of Object.entries(scene.layers)) for (const c of l.children ?? []) parent.set(c, id);
  for (let id: string | undefined = inner; id; id = parent.get(id)) if (/^(panel|device-|code)/.test(id)) return true;
  return false;
}

const review: ToolType<{ times?: number[] }> = {
  name: 'film-review', title: 'Film: the review',
  description: 'the check of a film: a contact sheet (a frame of each scene once it has settled, or the moments asked), an art director\'s notes on its description, the quality checks inside its scenes and its sound',
  input: { type: 'object', properties: { times: { type: 'array', items: { type: 'number' }, title: 'Moments', description: 'times in the film (s) to look at instead of one frame a scene: a pass, an entrance' } } },
  ai: { when: 'after building a film: see it whole and read what to fix before calling it done' },
  async run(input, ctx) {
    const doc = ctx.doc, id = filmComp(doc);
    if (!id) throw new Error('there is no film in this project yet: build one with the film tool');
    const comp = doc.compositions[id];
    const scenes = comp.order.map((lid) => comp.layers[lid]).filter((l) => l.type === 'comp').sort((a, b) => (a.in ?? 0) - (b.in ?? 0));
    // a scene is seen once its elements are in, before it starts to leave
    const at = (l: (typeof scenes)[number]) => { const t0 = l.in ?? 0, t1 = l.out ?? comp.duration; return Math.round(Math.min(t1 - 0.2, t0 + (t1 - t0) * 0.72) * 100) / 100; };
    const times = input.times?.length ? input.times.map((t) => Math.max(0, Math.min(comp.duration - 0.01, t))) : scenes.map(at);
    const labels = input.times?.length ? times.map((t) => `${t.toFixed(2)} s`) : scenes.map((_, i) => `${i + 1}`);
    const sheet = await contactSheet(ctx, comp, id, times, labels);
    // the quality checks inside the scenes and the sound, as the check tool reads a composition
    const on = { ...ctx, compId: id }, sound = await soundReport(on);
    const all: QualityIssue[] = [...await runChecks(doc, ctx.registry, id, { data: await analyses(on) }), ...sound.issues];
    // the small type of an interface or of code shown as a picture is not read: counted, not listed
    const decor = all.filter((i) => i.check === 'text-size' && (i.layers ?? []).length > 0 && i.layers!.every((l) => inMockup(doc, id, l)));
    const issues = all.filter((i) => !decor.includes(i)), warnings = issues.filter((i) => i.severity === 'warning').length;
    // what the description does that good films avoid, and what the build gave up
    const spec = await ctx.readText(SPEC_PATH);
    let notes: string[] = [];
    if (spec) {
      const r = compileFilm(JSON.parse(spec), { comp: id, size: [comp.width, comp.height], fps: comp.fps, assets: doc.assets, sound: false });
      notes = 'issues' in r ? r.issues.map((x) => `the description no longer builds: ${x}`) : r.build.notes;
    }
    return {
      images: [{ url: sheet, caption: input.times?.length ? `the film at ${labels.join(', ')}` : `the ${scenes.length} scenes, each once settled (${times.map((t) => `${t} s`).join(', ')})` }],
      text: [
        `Contact sheet of "${comp.name ?? id}": ${labels.length} frame${labels.length === 1 ? '' : 's'}.`,
        notes.length ? `Notes on the description:\n${notes.map((n) => `- ${n}`).join('\n')}` : 'Notes on the description: nothing flagged.',
        issues.length ? `Checks of the picture and the sound: ${warnings} warning(s), ${issues.length - warnings} note(s).\n${issues.map((i) => `- [${i.severity}] ${i.message}`).join('\n')}` : 'Checks of the picture and the sound: nothing found.',
        ...(decor.length ? [`${decor.length} small text(s) inside interfaces or code, under the reading size: shown, not read; leave them unless they carry the message.`] : []),
        ...(sound.master ? [masterText(sound.master)] : []),
        'Judge the frames as a director: is the idea readable, is each frame one clear thing, do the scenes vary, does the type breathe, is anything crowded, cut or lost? Fix what matters in the description and build once more (never by editing the layers of a scene: the next build replaces them); otherwise the film is done.',
      ].join('\n'),
    };
  },
};

export const FILM_TOOLS: ToolType[] = [guide, film, review];

/** the films' presets as style kits too: their palette and curves for a project that is not a film */
export const FILM_KITS: KitType[] = Object.entries(PRESETS).map(([name, p]) => ({ name, title: name[0].toUpperCase() + name.slice(1), description: p.about, tokens: resolveStyle({ preset: name }).tokens }));
