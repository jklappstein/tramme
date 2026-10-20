import { describe, expect, it } from 'vitest';
import { applyLut, parseCube } from '../src/lut.ts';

/** a 2³ table that swaps red and blue */
const SWAP = `# swap
TITLE "Swap"
LUT_3D_SIZE 2
DOMAIN_MIN 0 0 0
DOMAIN_MAX 1 1 1
${[0, 1].flatMap((b) => [0, 1].flatMap((g) => [0, 1].map((r) => `${b} ${g} ${r}`))).join('\n')}
`;

describe('a .cube LUT', () => {
  it('reads its size, title, domain and table, red fastest', () => {
    const lut = parseCube(SWAP);
    expect(lut).toMatchObject({ kind: 'lut3d', title: 'Swap', size: 2, domainMin: [0, 0, 0], domainMax: [1, 1, 1] });
    expect(Array.from(lut.data.slice(3, 6))).toEqual([0, 0, 1]);
  });

  it('maps a colour through the table, between its points', () => {
    const lut = parseCube(SWAP);
    expect(applyLut(lut, [1, 0, 0])).toEqual([0, 0, 1]);
    const [r, g, b] = applyLut(lut, [0.25, 0.5, 0.75]);
    expect([r, g, b].map((x) => +x.toFixed(6))).toEqual([0.75, 0.5, 0.25]);
  });

  it('says what is wrong with a file it cannot read', () => {
    expect(() => parseCube('LUT_1D_SIZE 1024\n0 0 0')).toThrow(/1D/);
    expect(() => parseCube('LUT_3D_SIZE 2\n0 0 0')).toThrow(/1 values for 8/);
    expect(() => parseCube('0 0 0')).toThrow(/before LUT_3D_SIZE/);
    expect(() => parseCube('LUT_3D_SIZE 2\n0 0 x\n')).toThrow(/three numbers/);
  });
});
