// Colours as a designer handles them: hue, saturation and lightness to shift
// a brand colour into a palette, and the contrast that keeps it legible.

import { parseColor } from '@tramme/core';

export type Hsl = [h: number, s: number, l: number];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** red, green, blue (0 to 255) of any colour the document takes */
export const hexToRgb = (color: string): [number, number, number] => { const [r, g, b] = parseColor(color); return [r, g, b]; };

export const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export function hexToHsl(hex: string): Hsl {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToHex([h, s, l]: Hsl): string {
  const hh = ((h % 360) + 360) % 360 / 360, ss = clamp01(s), ll = clamp01(l);
  if (ss === 0) return rgbToHex(ll * 255, ll * 255, ll * 255);
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss, p = 2 * ll - q;
  const ch = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return rgbToHex(ch(hh + 1 / 3) * 255, ch(hh) * 255, ch(hh - 1 / 3) * 255);
}

/** WCAG relative luminance */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21 */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** a mix of two colours (t = 0: a, 1: b) */
export function mix(a: string, b: string, t: number): string {
  const p = hexToRgb(a), q = hexToRgb(b);
  return rgbToHex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
}

/** a colour moved in lightness until it reads against `on` at `ratio` (lighter on dark, darker on light) */
export function legible(hex: string, on: string, ratio: number): string {
  let [h, s, l] = hexToHsl(hex);
  const up = luminance(on) < 0.2;
  for (let i = 0; i < 40 && contrast(hslToHex([h, s, l]), on) < ratio; i++) l = clamp01(l + (up ? 0.025 : -0.025));
  return hslToHex([h, s, l]);
}

/** a colour with its hue turned and its saturation and lightness set or kept */
export const turn = (hex: string, deg: number, o: { s?: number; l?: number } = {}) => {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex([h + deg, o.s ?? s, o.l ?? l]);
};

/** a colour at an opacity, #RRGGBBAA */
export const withAlpha = (hex: string, a: number) => `${hex.slice(0, 7).toUpperCase()}${Math.round(clamp01(a) * 255).toString(16).padStart(2, '0').toUpperCase()}`;

/** a #RGB, #RRGGBB or #RRGGBBAA colour (what a palette is written with) */
export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);
