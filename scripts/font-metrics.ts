// Measures the catalogue's fonts (shipped in fonts/ or fetched) in Chrome, the way the renderer draws
// them, and writes the advance of each character at a few weights, and the
// pairs drawn closer or wider than their glyphs (kerning), into
// packages/film/src/metrics.json: the film lays out its text (centred lines,
// pills sized to their label, rows of a list) the same in the editor and on
// the command line, without a canvas. The families are the film's type
// catalogue (packages/film/src/fonts.ts).
//
//   node scripts/font-metrics.ts

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../packages/cli/src/browser.ts';
import { familyFiles, FAMILIES, fontFile } from '../packages/film/src/fonts.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'packages', 'film', 'src', 'metrics.json');

/** the characters whose pairs are kerned: letters, digits and the punctuation around words */
const KERNED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?\'"’“”-–—$€£%/()&';

/** printable ASCII, Latin-1 letters and the signs a film writes (currencies, dashes, quotes, arrows) */
const CHARS = [
  ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)),
  ...'àâäáãåæçèéêëìíîïñòóôöõøùúûüýÿœÀÂÄÁÃÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÖÕØÙÚÛÜÝŸŒßğışĞİŞ',
  ...'€£¥₿₦°±×÷·•…–—‘’‚“”„«»‹›†‡%‰′″→←↑↓↗↘✓✕★☆♥',
].join('');

/** measured at a display size, where the optical sizes of the variable faces mostly sit */
const SIZE = 200;

const { browser, page } = await launch();
try {
  const out: Record<string, { size: number; weights: number[]; widths: Record<string, number[]>; fallback: number[]; kernWeights?: number[]; kern?: Record<string, number[]> }> = {};
  for (const f of FAMILIES) {
    const data = Buffer.from(await fontFile(familyFiles(f)[0], async (name) => fs.readFileSync(path.join(ROOT, 'fonts', name)))).toString('base64');
    // pairs at a light and a bold weight when the face has them, its one weight otherwise; none for a monospace
    const kern = f.kind === 'mono' ? [] : [400, 700].filter((w) => f.measure.includes(w)).concat(f.measure.includes(400) ? [] : [f.measure[0]]);
    const { widths, pairs } = await page.evaluate(async (a) => {
      const face = new FontFace(a.family, `url(data:font/ttf;base64,${a.data})`, { weight: a.range });
      await face.load();
      document.fonts.add(face);
      const g = document.createElement('canvas').getContext('2d')!;
      const measure = (s: string, w: number) => { g.font = `${w} ${a.size}px "${a.family}"`; return g.measureText(s).width; };
      const table: Record<string, number[]> = {};
      for (const ch of a.chars) table[ch] = a.weights.map((w) => Math.round(measure(ch, w) * 10) / 10);
      // a pair drawn closer (or wider) than its two glyphs side by side; kept when it shows
      const kerned: Record<string, number[]> = {};
      for (const x of a.kernChars) for (const y of a.kernChars) {
        if (!a.kernWeights.length) break;
        const k = a.kernWeights.map((w) => Math.round((measure(x + y, w) - measure(x, w) - measure(y, w)) * 10) / 10);
        if (k.some((v) => Math.abs(v) >= 2)) kerned[x + y] = k;
      }
      return { widths: table, pairs: kerned };
    }, { family: f.name, range: f.weight, data, chars: CHARS, weights: f.measure, size: SIZE, kernChars: KERNED, kernWeights: kern });
    // what a character outside the table weighs: the mean of the lower-case letters
    const lower = 'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => widths[c]);
    const fallback = f.measure.map((_, i) => Math.round((lower.reduce((s, w) => s + w[i], 0) / lower.length) * 10) / 10);
    out[f.name] = { size: SIZE, weights: f.measure, widths, fallback, ...(kern.length ? { kernWeights: kern, kern: pairs } : {}) };
    console.log(`${f.name}: ${Object.keys(widths).length} characters at ${f.measure.join(', ')}, ${Object.keys(pairs).length} kerned pairs`);
  }
  fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
  console.log('wrote', path.relative(ROOT, OUT), `(${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
}
