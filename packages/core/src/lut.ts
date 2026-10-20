// LUTs (docs/editing-roadmap.md, step 6): a .cube file (the format Resolve,
// Premiere and the cameras' log conversions write) read into a 3D table the
// renderer turns into a texture. Its lines: LUT_3D_SIZE n, DOMAIN_MIN and
// DOMAIN_MAX, then n³ lines "r g b", red changing fastest.

export interface Lut3D {
  kind: 'lut3d';
  title?: string;
  size: number;
  /** n³ RGB triplets, red fastest, then green, then blue */
  data: Float32Array;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
}

/** the largest table read (128³ triplets, about 25 MB as floats) */
export const LUT_MAX_SIZE = 128;

export function parseCube(text: string): Lut3D {
  let size = 0, title: string | undefined, n = 0;
  let domainMin: [number, number, number] = [0, 0, 0], domainMax: [number, number, number] = [1, 1, 1];
  let data: Float32Array | null = null;
  const triplet = (parts: string[], what: string): [number, number, number] => {
    const v = parts.slice(0, 3).map(Number);
    if (v.length < 3 || v.some((x) => !Number.isFinite(x))) throw new Error(`${what}: three numbers expected`);
    return v as [number, number, number];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/), word = parts[0].toUpperCase();
    if (word === 'TITLE') { title = line.slice(5).trim().replace(/^"|"$/g, ''); continue; }
    if (word === 'LUT_1D_SIZE') throw new Error('a 1D LUT: only 3D LUTs are read (LUT_3D_SIZE)');
    if (word === 'LUT_3D_SIZE') {
      size = Number(parts[1]);
      if (!Number.isInteger(size) || size < 2 || size > LUT_MAX_SIZE) throw new Error(`LUT_3D_SIZE ${parts[1]}: 2 to ${LUT_MAX_SIZE} expected`);
      data = new Float32Array(size * size * size * 3);
      continue;
    }
    if (word === 'DOMAIN_MIN') { domainMin = triplet(parts.slice(1), 'DOMAIN_MIN'); continue; }
    if (word === 'DOMAIN_MAX') { domainMax = triplet(parts.slice(1), 'DOMAIN_MAX'); continue; }
    if (/^[A-Z_]+$/.test(word)) continue; // a keyword some tools add (LUT_IN_VIDEO_RANGE…): nothing for the picture
    if (!data) throw new Error('values before LUT_3D_SIZE');
    if (n >= size ** 3) throw new Error(`more than ${size ** 3} values`);
    data.set(triplet(parts, `line ${n + 1} of the table`), n * 3);
    n++;
  }
  if (!data) throw new Error('no LUT_3D_SIZE: not a 3D .cube file');
  if (n !== size ** 3) throw new Error(`${n} values for ${size ** 3} expected`);
  return { kind: 'lut3d', title, size, data, domainMin, domainMax };
}

/** a colour (0..1) through a table, by trilinear interpolation: what the GPU does, for the tests and the checks */
export function applyLut(lut: Lut3D, rgb: [number, number, number]): [number, number, number] {
  const n = lut.size, d = lut.data;
  const pos = rgb.map((v, k) => Math.min(n - 1, Math.max(0, ((v - lut.domainMin[k]) / (lut.domainMax[k] - lut.domainMin[k] || 1)) * (n - 1))));
  const i0 = pos.map(Math.floor), f = pos.map((p, k) => p - i0[k]), i1 = i0.map((i) => Math.min(n - 1, i + 1));
  const at = (r: number, g: number, b: number, c: number) => d[((b * n + g) * n + r) * 3 + c];
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const c00 = lerp(at(i0[0], i0[1], i0[2], c), at(i1[0], i0[1], i0[2], c), f[0]);
    const c10 = lerp(at(i0[0], i1[1], i0[2], c), at(i1[0], i1[1], i0[2], c), f[0]);
    const c01 = lerp(at(i0[0], i0[1], i1[2], c), at(i1[0], i0[1], i1[2], c), f[0]);
    const c11 = lerp(at(i0[0], i1[1], i1[2], c), at(i1[0], i1[1], i1[2], c), f[0]);
    out[c] = lerp(lerp(c00, c10, f[1]), lerp(c01, c11, f[1]), f[2]);
  }
  return out;
}
