import { describe, expect, it } from 'vitest';
import { cells } from '../src/text.ts';

/** a context whose glyphs have the widths given (8 for any other) */
const ctx = (widths: Record<string, number>) => ({ measureText: (ch: string) => ({ width: widths[ch] ?? 8 }) }) as unknown as CanvasRenderingContext2D;

describe('counter', () => {
  it('rolls every digit in a cell as wide as the widest digit, other signs at their own width', () => {
    const c = ctx({ '1': 10, '8': 14, ',': 5, d: 12 });
    expect(cells(c, '1,8')).toEqual([14, 5, 14]);
    expect(cells(c, '1,8', 0.5)).toEqual([14, 5, 14]);
    // a letter is not a digit, even "d"
    expect(cells(c, 'd%')).toEqual([12, 8]);
  });

  it('lands set as type: each digit settles to its own width at the end of the roll', () => {
    const c = ctx({ '1': 10, '8': 14, ',': 5 });
    expect(cells(c, '1,8', 1)).toEqual([10, 5, 14]);
    const mid = cells(c, '1,8', 0.925)[0];
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(14);
  });
});
