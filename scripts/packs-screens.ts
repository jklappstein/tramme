// The three mock phone screens of the "Packs" example (examples/packs):
// plain dark-UI app screens drawn with pngjs, so the example needs no
// binaries a designer made. Run: node scripts/packs-screens.ts
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const W = 750, H = 1500;
const OUT = path.join(import.meta.dirname, '..', 'examples', 'packs', 'assets', 'screens');
fs.mkdirSync(OUT, { recursive: true });

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const png = () => Object.assign(new PNG({ width: W, height: H }), {});
const rect = (img: PNG, x: number, y: number, w: number, h: number, c: string) => {
  const [r, g, b] = hex(c);
  for (let yy = Math.max(0, y | 0); yy < Math.min(H, y + h); yy++) {
    for (let xx = Math.max(0, x | 0); xx < Math.min(W, x + w); xx++) {
      const i = (yy * W + xx) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
};
const circle = (img: PNG, cx: number, cy: number, rad: number, c: string) => {
  const [r, g, b] = hex(c);
  for (let yy = Math.max(0, (cy - rad) | 0); yy < Math.min(H, cy + rad); yy++) {
    for (let xx = Math.max(0, (cx - rad) | 0); xx < Math.min(W, cx + rad); xx++) {
      if ((xx - cx) ** 2 + (yy - cy) ** 2 > rad * rad) continue;
      const i = (yy * W + xx) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
};
/** a rounded card: a rect with discs on its corners */
const card = (img: PNG, x: number, y: number, w: number, h: number, rad: number, c: string) => {
  rect(img, x, y + rad, w, h - 2 * rad, c);
  rect(img, x + rad, y, w - 2 * rad, h, c);
  circle(img, x + rad, y + rad, rad, c); circle(img, x + w - rad, y + rad, rad, c);
  circle(img, x + rad, y + h - rad, rad, c); circle(img, x + w - rad, y + h - rad, rad, c);
};
const save = (img: PNG, name: string) => fs.writeFileSync(path.join(OUT, name), PNG.sync.write(img));

const BG = '#12171D', PANEL = '#1B232B', PANEL2 = '#232D37', ACCENT = '#2EC4B6', INK = '#8B98A5', DARK = '#0B0F12';

// ── home: a feed of cards ────────────────────────────────────
const home = png();
rect(home, 0, 0, W, H, BG);
rect(home, 0, 0, W, 150, DARK);
circle(home, 90, 75, 26, ACCENT);
rect(home, 150, 58, 260, 34, PANEL2);
circle(home, W - 90, 75, 26, PANEL2);
for (let i = 0; i < 4; i++) {
  const y = 210 + i * 300;
  card(home, 40, y, W - 80, 250, 28, PANEL);
  circle(home, 110, y + 78, 38, i % 2 ? '#F2B54D' : ACCENT);
  rect(home, 180, y + 52, 320, 26, PANEL2);
  rect(home, 180, y + 100, 440, 20, '#161D24');
  rect(home, 180, y + 138, 380, 20, '#161D24');
  if (i === 1) rect(home, 70, y + 190, 300, 36, ACCENT);
}
rect(home, 0, H - 130, W, 130, DARK);
[0.2, 0.4, 0.6, 0.8].forEach((f, i) => circle(home, W * f, H - 65, i === 0 ? 30 : 22, i === 0 ? ACCENT : PANEL2));
save(home, 'home.png');

// ── stats: a big figure and bars ─────────────────────────────
const stats = png();
rect(stats, 0, 0, W, H, BG);
rect(stats, 0, 0, W, 150, DARK);
rect(stats, 60, 58, 200, 34, PANEL2);
circle(stats, W - 90, 75, 26, PANEL2);
card(stats, 40, 210, W - 80, 320, 28, PANEL);
rect(stats, 100, 280, 340, 30, PANEL2);
rect(stats, 100, 350, 220, 84, ACCENT);
rect(stats, 100, 460, 420, 22, '#161D24');
const bars = [0.35, 0.55, 0.42, 0.8, 0.62, 0.95];
bars.forEach((f, i) => {
  const bw = 62, x = 90 + i * 100, bh = 420 * f;
  rect(stats, x, 980 - bh, bw, bh, i === 5 ? ACCENT : '#31404D');
});
rect(stats, 40, 1040, W - 80, 4, '#0B0F12');
for (let i = 0; i < 3; i++) card(stats, 40, 1090 + i * 130, W - 80, 100, 24, PANEL);
save(stats, 'stats.png');

// ── profile: an avatar and settings rows ─────────────────────
const profile = png();
rect(profile, 0, 0, W, H, BG);
rect(profile, 0, 0, W, 420, DARK);
circle(profile, W / 2, 190, 92, ACCENT);
rect(profile, W / 2 - 130, 310, 260, 30, PANEL2);
rect(profile, W / 2 - 80, 362, 160, 22, '#161D24');
const rows: [number, string][] = [[560, ACCENT], [720, PANEL2], [880, PANEL2]];
for (const [y, c] of rows) {
  card(profile, 40, y, W - 80, 110, 24, PANEL);
  circle(profile, 110, y + 55, 26, c);
  rect(profile, 170, y + 30, 380, 24, PANEL2);
  rect(profile, 170, y + 68, 260, 18, '#161D24');
}
card(profile, 40, 1240, W - 80, 130, 30, ACCENT);
rect(profile, W / 2 - 110, 1290, 220, 26, DARK);
save(profile, 'profile.png');

console.log(`three screens written to ${path.relative(process.cwd(), OUT)}`);
