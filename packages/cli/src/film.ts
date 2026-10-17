// tramme film <film.json> [--out folder] [--seed n]: a project folder built from a film
// description, the way the editor's film tool builds it, ready for `tramme
// render` or `tramme still`. The description is kept in the project
// (assets/film/film.json) for the next change.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyOps, stringifyDoc, validate } from '@tramme/core';
import { compileFilm, filmOps, filmTarget, fontFile, SPEC_PATH } from '@tramme/film';
import { builtinRegistry } from '@tramme/nodes';
import { DOCUMENT, MANIFEST, newProject } from '@tramme/project';

const FONTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fonts');

export async function cmdFilm(file: string, out?: string, seed?: number) {
  if (!file || !fs.existsSync(file)) throw new Error(`file not found: ${file ?? '(none)'}`);
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  // another take of the same description
  if (seed !== undefined) spec.seed = seed;
  const blank = newProject({ name: 'Film', width: 1920, height: 1080, fps: 30, duration: 10 });
  const where = filmTarget(blank.doc);
  const r = compileFilm(spec, { comp: where.comp });
  if ('issues' in r) throw new Error(`the film cannot be built:\n  ${r.issues.join('\n  ')}`);
  const { build, film } = r;
  const dir = path.resolve(out ?? path.join('out', path.basename(file).replace(/\.json$/, '')));
  const { manifest } = newProject({ name: film.title, width: film.width, height: film.height, fps: film.fps, duration: build.duration });
  const doc = applyOps(blank.doc, filmOps(blank.doc, build, where)).doc;
  doc.meta.title = film.title;
  const write = (p: string, data: string | Uint8Array) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), data); };
  // a font already in the folder (a film built there before) is not fetched again
  for (const f of build.files) if (!fs.existsSync(path.join(dir, f.path))) write(f.path, await fontFile(f, async (name) => fs.readFileSync(path.join(FONTS, name))));
  for (const f of build.made) write(f.path, f.data);
  write(SPEC_PATH, JSON.stringify(spec, null, 2) + '\n');
  write(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  write(DOCUMENT, stringifyDoc(doc));
  const layers = Object.values(doc.compositions).reduce((n, c) => n + Object.keys(c.layers).length, 0);
  console.log(`wrote ${path.relative(process.cwd(), dir)}: ${layers} layers in ${Object.keys(doc.compositions).length} compositions`);
  console.log(build.summary);
  const issues = validate(doc, builtinRegistry());
  for (const i of issues.slice(0, 40)) console.log(`  invalid: ${i.path} ${i.message}`);
  if (issues.length) throw new Error(`${issues.length} issue(s) in the built document`);
}
