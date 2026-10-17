// A built film as changes to a document: its tokens, its assets, its
// compositions, the description kept beside them. The same operations for
// the editor's film tool (a proposal the user applies) and the command line
// (applied to a new project). Building again replaces what the film made and
// leaves the user's own compositions alone.

import { pointer, type Op, type TrammeDoc } from '@tramme/core';
import type { FilmBuild } from './compile.ts';

/** where the description is kept in the project */
export const SPEC_PATH = 'assets/film/film.json';
export const SPEC_ASSET = 'film';

/** a composition the film made: its scenes, the passes between them, its music and its effects, nothing else */
export function madeByFilm(doc: TrammeDoc, id: string): boolean {
  const c = doc.compositions[id];
  return !!c && Object.entries(c.layers).every(([lid, l]) => (l.type === 'comp' && String(l.props?.comp ?? '').startsWith(`${id}-`))
    || lid.startsWith('pass-')
    || (l.type === 'audio' && (String(l.props?.audio ?? '').startsWith('film-') || l.name === 'Music')));
}

/** where a film goes: the root when it is empty or a film already, a new composition (made the root) otherwise */
export function filmTarget(doc: TrammeDoc): { comp: string; root: boolean } {
  if (madeByFilm(doc, doc.root)) return { comp: doc.root, root: false };
  let id = 'film';
  for (let i = 2; doc.compositions[id] && !madeByFilm(doc, id); i++) id = `film-${i}`;
  return { comp: id, root: true };
}

/** the operations that put a built film into the document (its files are written apart) */
export function filmOps(doc: TrammeDoc, build: FilmBuild, where: { comp: string; root: boolean }): Op[] {
  const ops: Op[] = [];
  for (const [name, token] of Object.entries(build.tokens)) ops.push({ op: 'add', path: pointer('tokens', name), value: token });
  for (const [id, asset] of Object.entries(build.assets)) ops.push({ op: 'add', path: pointer('assets', id), value: asset });
  ops.push({ op: 'add', path: pointer('assets', SPEC_ASSET), value: { type: 'json', src: SPEC_PATH, name: 'Film · description' } });
  // the scenes of an earlier build that this one no longer has
  const scene = new RegExp(`^${where.comp}-\\d{2}(-|$)`);
  for (const id of Object.keys(doc.compositions)) if (scene.test(id) && !build.compositions[id]) ops.push({ op: 'remove', path: pointer('compositions', id) });
  for (const [id, c] of Object.entries(build.compositions)) ops.push({ op: 'add', path: pointer('compositions', id), value: c });
  if (where.root) ops.push({ op: 'replace', path: '/root', value: where.comp });
  return ops;
}
