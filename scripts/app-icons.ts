// The editor's icons as an installed app (apps/editor/icons, served at
// /icons): the PNGs Android, Chrome and iOS ask for, drawn from
// apps/editor/icon.svg. "any" keeps its rounded square; the maskable one and
// Apple's fill the whole square (the system cuts its own shape) with the mark
// inside the safe zone. build.ts copies them and names them in the manifest.
//
//   node scripts/app-icons.ts

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'apps/editor/icons');
const icon = fs.readFileSync(path.join(ROOT, 'apps/editor/icon.svg'), 'utf8');

// the mark: the group of the icon, drawn again on a full square
const mark = /<g\b[^>]*\bfill="([^"]+)"[^>]*>([\s\S]*?)<\/g>/.exec(icon);
const plate = /<rect\b[^>]*\bfill="([^"]+)"/.exec(icon);
if (!mark || !plate) throw new Error('apps/editor/icon.svg: its plate (a rect) and its mark (a filled group) were not found');
// the mark's centre in the icon's 24-unit box (its rects span x 2.5–21.5, y 2.6–22.6)
const full = (scale: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="${plate[1]}"/>`
  + `<g transform="translate(12 12) scale(${scale}) translate(-12 -12.6)" fill="${mark[1]}">${mark[2]}</g></svg>`;

const ICONS: [string, string, number][] = [
  ['icon-192.png', icon, 192],
  ['icon-512.png', icon, 512],
  // the safe zone is the centred circle of 80 %: the mark keeps well inside it
  ['maskable-512.png', full(0.6), 512],
  ['apple-touch-icon.png', full(0.72), 180],
];

fs.mkdirSync(OUT, { recursive: true });
for (const [name, svg, size] of ICONS) {
  await sharp(Buffer.from(svg), { density: 72 * size / 24 }).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(OUT, name));
  console.log(`${path.relative(ROOT, path.join(OUT, name))} (${size}×${size})`);
}
