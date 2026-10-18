// Free space of a frame, as data: a small grid of how busy each cell is
// (edges, faces, anything already drawn), turned into the sides that stay
// clear and the largest clear rectangle — where a title or a caption can go
// without covering what matters. Pure: the space tool feeds it a grid.

export interface SpaceGrid {
  cols: number;
  rows: number;
  /** how busy each cell is, 0 clear to 1 crowded, row by row from the top left */
  busy: number[];
}

/** the sides of the frame that stay clear, as a fraction of their edge (1: the whole side is free) */
export function freeSides(g: SpaceGrid, busy = 0.45): { left: number; right: number; top: number; bottom: number } {
  const side = (cells: number[]) => cells.filter((v) => v < busy).length / cells.length;
  const col = (c: number) => Array.from({ length: g.rows }, (_, r) => g.busy[r * g.cols + c]);
  const row = (r: number) => Array.from({ length: g.cols }, (_, c) => g.busy[r * g.cols + c]);
  return { left: side(col(0)), right: side(col(g.cols - 1)), top: side(row(0)), bottom: side(row(g.rows - 1)) };
}

/** the largest rectangle of clear cells, in fractions of the frame (x, y of its top left) */
export function largestFree(g: SpaceGrid, busy = 0.45): { x: number; y: number; w: number; h: number } {
  const open = (r: number, c: number) => g.busy[r * g.cols + c] < busy ? 1 : 0;
  // the largest rectangle in a binary grid: a histogram of clear runs, swept row by row
  const heights = new Array<number>(g.cols).fill(0);
  let best = { x: 0, y: 0, w: 0, h: 0, area: 0 };
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) heights[c] = open(r, c) ? heights[c] + 1 : 0;
    const stack: number[] = [];
    for (let c = 0; c <= g.cols; c++) {
      const h = c === g.cols ? 0 : heights[c];
      while (stack.length && heights[stack[stack.length - 1]] >= h) {
        const top = stack.pop()!;
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const width = c - left, height = heights[top];
        if (width * height > best.area) best = { x: left, y: r - height + 1, w: width, h: height, area: width * height };
      }
      stack.push(c);
    }
  }
  return { x: best.x / g.cols, y: best.y / g.rows, w: best.w / g.cols, h: best.h / g.rows };
}

/**
 * How far into the frame the clear margins reach on each side, in fractions
 * of the frame (0: nothing free): the columns (or rows) from that edge inward
 * that stay clear, a line counting as clear when `share` of its cells are.
 */
export function clearMargins(g: SpaceGrid, busy = 0.45, share = 0.9): { left: number; right: number; top: number; bottom: number } {
  const clear = (cells: number[]) => cells.filter((v) => v < busy).length >= share * cells.length;
  const col = (c: number) => Array.from({ length: g.rows }, (_, r) => g.busy[r * g.cols + c]);
  const row = (r: number) => Array.from({ length: g.cols }, (_, c) => g.busy[r * g.cols + c]);
  /** the clear lines from an edge inward, until the first busy one */
  const depth = (n: number, line: (i: number) => number[]) => {
    let i = 0;
    while (i < n && clear(line(i))) i++;
    return i / n;
  };
  return {
    left: depth(g.cols, (i) => col(i)),
    right: depth(g.cols, (i) => col(g.cols - 1 - i)),
    top: depth(g.rows, (i) => row(i)),
    bottom: depth(g.rows, (i) => row(g.rows - 1 - i)),
  };
}
