// How wide a line of text is drawn, from the advances measured in Chrome for
// the shipped fonts (scripts/font-metrics.ts writes metrics.json): the film
// lays its text out the same in the editor and on the command line. Weights
// between two measured ones are interpolated; a family not measured is read
// as Inter, a character not measured as an average letter.

import METRICS from './metrics.json' with { type: 'json' };

interface Table { size: number; weights: number[]; widths: Record<string, number[]>; fallback: number[]; kernWeights?: number[]; kern?: Record<string, number[]> }
const TABLES = METRICS as Record<string, Table>;

/** a measure taken at a few weights, read at any weight (interpolated between them, held beyond) */
function at(row: number[], ws: number[], weight: number): number {
  if (weight <= ws[0]) return row[0];
  for (let i = 1; i < ws.length; i++) {
    if (weight <= ws[i]) return row[i - 1] + ((row[i] - row[i - 1]) * (weight - ws[i - 1])) / (ws[i] - ws[i - 1]);
  }
  return row[row.length - 1];
}

/** width in px of a single line, its pairs kerned, tracking (em) included between characters */
export function textWidth(text: string, size: number, weight = 400, family = 'Inter', tracking = 0): number {
  const table = TABLES[family] ?? TABLES.Inter;
  const chars = [...text];
  let sum = 0;
  chars.forEach((ch, i) => {
    sum += at(table.widths[ch] ?? table.fallback, table.weights, weight);
    const pair = i ? table.kern?.[chars[i - 1] + ch] : undefined;
    if (pair) sum += at(pair, table.kernWeights!, weight);
  });
  return (sum / table.size) * size + Math.max(0, chars.length - 1) * tracking * size;
}

/** words laid in lines no wider than `max` px */
export function wrap(text: string, max: number, size: number, weight = 400, family = 'Inter', tracking = 0): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && textWidth(next, size, weight, family, tracking) > max) { lines.push(line); line = word; }
      else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * The largest size from `size` down to `min` at which the text fits in
 * `maxLines` lines of `max` px, with its lines.
 */
export function fit(text: string, o: { size: number; min: number; max: number; maxLines: number; weight?: number; family?: string; tracking?: number }): { size: number; lines: string[] } {
  let size = o.size;
  for (;;) {
    const lines = wrap(text, o.max, size, o.weight, o.family, o.tracking);
    const widest = Math.max(...lines.map((l) => textWidth(l, size, o.weight, o.family, o.tracking)));
    if ((lines.length <= o.maxLines && widest <= o.max) || size <= o.min) return { size: Math.round(size), lines };
    size *= 0.94;
  }
}
