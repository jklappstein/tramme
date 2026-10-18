import { describe, expect, it } from 'vitest';
import { clearMargins, freeSides, largestFree } from '../src/space.ts';

const grid = (cols: number, rows: number, busy: number[]) => ({ cols, rows, busy });

describe('the free space of a frame', () => {
  it('finds the sides that stay clear', () => {
    // a subject on the right third, the left clear
    const busy = Array.from({ length: 9 * 5 }, (_, i) => (i % 9 >= 6 ? 0.9 : 0.1));
    const sides = freeSides(grid(9, 5, busy));
    expect(sides.left).toBe(1);
    expect(sides.right).toBe(0);
    expect(sides.top).toBeCloseTo(2 / 3);
  });

  it('finds the largest clear rectangle', () => {
    // everything busy but a clear band from column 1 to 5, rows 1 to 3
    const busy = Array.from({ length: 9 * 5 }, (_, i) => {
      const c = i % 9, r = Math.floor(i / 9);
      return c >= 1 && c <= 5 && r >= 1 && r <= 3 ? 0.1 : 0.9;
    });
    const rect = largestFree(grid(9, 5, busy));
    expect(rect).toEqual({ x: 1 / 9, y: 1 / 5, w: 5 / 9, h: 3 / 5 });
  });

  it('gives the whole frame when all is clear, and nothing when all is crowded', () => {
    const all = grid(4, 3, new Array(12).fill(0.1));
    expect(largestFree(all)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    const full = grid(4, 3, new Array(12).fill(0.9));
    expect(largestFree(full)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(clearMargins(full).left).toBe(0);
    expect(clearMargins(all).left).toBe(1);
  });

  it('measures the clear margins inward from each edge', () => {
    // a subject on the right third: the left two thirds clear, nothing free on the right
    const busy = Array.from({ length: 9 * 5 }, (_, i) => (i % 9 >= 6 ? 0.9 : 0.1));
    const m = clearMargins(grid(9, 5, busy));
    expect(m.left).toBeCloseTo(6 / 9);
    expect(m.right).toBe(0);
    // every row holds the subject: no clear band at the top or the bottom
    expect(m.top).toBe(0);
    expect(m.bottom).toBe(0);
  });
});
