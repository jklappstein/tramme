// Lip sync from a transcript: the words said turn into mouth shapes (visemes,
// the classic nine a drawn rig holds), each held while its letters would be
// spoken and a closed mouth between the words. Pure: the lipsync tool turns
// these into keys on a sequence's `drawing`.

import type { TranscriptWord } from './transcript.ts';

export type Viseme = 'closed' | 'mbp' | 'fv' | 'ai' | 'e' | 'o' | 'u' | 'l' | 'd';

/** the letters that read the same in French and English, roughly enough for a mouth */
const DIGRAPHS: Record<string, Viseme> = {
  sh: 'd', ch: 'd', th: 'd', ph: 'fv', gh: 'd', ck: 'd', qu: 'u',
  oo: 'u', ou: 'u', ow: 'o', oi: 'ai', oy: 'ai',
  ai: 'ai', ay: 'ai', ei: 'e', ey: 'e', ea: 'e', ee: 'e', ie: 'ai', igh: 'ai', oa: 'o', eu: 'e', au: 'o',
};

const SINGLES: Record<string, Viseme> = {
  a: 'ai', i: 'ai', y: 'ai', e: 'e', o: 'o', u: 'u',
  m: 'mbp', b: 'mbp', p: 'mbp', f: 'fv', v: 'fv', l: 'l',
  w: 'u', q: 'u', r: 'o',
};

/** a word's mouth shapes, in the order its letters would be spoken */
export function phonemes(word: string, language?: string): Viseme[] {
  const w = word.toLowerCase().replace(/[^a-zà-ÿ]/g, '');
  const out: Viseme[] = [];
  for (let i = 0; i < w.length;) {
    const two = DIGRAPHS[w.slice(i, i + 3)] ? 3 : DIGRAPHS[w.slice(i, i + 2)] ? 2 : 0;
    if (two) { out.push(DIGRAPHS[w.slice(i, i + two)]); i += two; continue; }
    const c = w[i];
    if (language?.toLowerCase().startsWith('fr') && c === 'e' && i === w.length - 1 && w.length > 3) break; // a French final e stays silent
    out.push(SINGLES[c] ?? 'd');
    i++;
  }
  return out.length ? out : ['closed'];
}

export interface MouthKey { t: number; v: Viseme }

/** the whole transcript as mouth keys: each word's shapes share its time, the mouth closes between words */
export function mouthKeys(words: TranscriptWord[], opts: { gap?: number; min?: number } = {}): MouthKey[] {
  const gap = opts.gap ?? 0.06, min = opts.min ?? 0.04;
  const keys: MouthKey[] = [];
  let last = -1;
  for (const word of words) {
    if (word.s - last >= gap && keys.length) keys.push({ t: Math.max(keys[keys.length - 1].t + 0.001, word.s - gap / 2), v: 'closed' });
    const shapes = phonemes(word.w, undefined);
    const span = Math.max(word.e - word.s, min * shapes.length);
    shapes.forEach((v, i) => {
      const t = word.s + (span * i) / shapes.length;
      if (keys.length && keys[keys.length - 1].v === v && t - keys[keys.length - 1].t < min) return; // hold the same shape
      keys.push({ t, v });
    });
    last = Math.max(last, word.e);
  }
  return keys;
}
