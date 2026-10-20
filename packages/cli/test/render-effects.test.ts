// Effects drawn by Chrome, read back pixel by pixel. The transitions: a red
// shot, a blue one overlapping it from 1 s, a transition of 1 s on the blue
// one. The key: a red subject on a green screen, keyed over white.
// Contributors without Chrome skip these (CHROME_PATH points to one).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHROME, launch, openDoc } from '../src/browser.ts';
import { readConfig, Server } from '../src/server.ts';

type Pixel = [number, number, number];
const KINDS = ['crossfade', 'dip', 'push', 'slide', 'zoom', 'whip', 'luma', 'glitch'];

function doc(kind: string) {
  const full = { transform: { position: [160, 90] } };
  return {
    schema: 'tramme/1', meta: { title: kind }, tokens: {}, assets: {}, root: 'main',
    compositions: { main: { name: 'Main', width: 320, height: 180, fps: 30, duration: 3, background: '#000000', motionBlur: { samples: 1, shutter: 0 }, order: ['m', 'a', 'b'], layers: {
      a: { type: 'shape.rect', in: 0, out: 2, ...full, props: { size: [320, 180], fill: '#FF0000' } },
      b: { type: 'shape.rect', in: 1, out: 3, ...full, props: { size: [320, 180], fill: '#0000FF' }, effects: [{ id: 'tr', type: 'fx.transition', props: { from: 'a', kind, duration: 1, color: '#FFFFFF', map: 'm' } }] },
      // the luma wipe's picture: dark on the left
      m: { type: 'shape.rect', visible: false, ...full, props: { size: [320, 180], fill: { type: 'linear', from: [-160, 0], to: [160, 0], stops: [[0, '#000000'], [1, '#FFFFFF']] } } },
    } } },
  };
}

/** a red disc on a green screen (a little lighter at the top: a screen is never even), keyed */
function keyed(view: 'result' | 'matte', tolerance = 0.12) {
  const full = { transform: { position: [160, 90] } };
  return {
    schema: 'tramme/1', meta: { title: 'key' }, tokens: {}, assets: {}, root: 'main',
    compositions: { main: { name: 'Main', width: 320, height: 180, fps: 30, duration: 1, background: '#FFFFFF', motionBlur: { samples: 1, shutter: 0 }, order: ['shot'], layers: {
      shot: { type: 'group', children: ['screen', 'subject'], effects: [{ id: 'k', type: 'fx.key', props: { color: '#00B140', tolerance, view } }] },
      screen: { type: 'shape.rect', ...full, props: { size: [320, 180], fill: { type: 'linear', from: [0, -90], to: [0, 90], stops: [[0, '#10C850'], [1, '#00A038']] } } },
      subject: { type: 'shape.ellipse', ...full, props: { size: [80, 80], fill: '#D02020' } },
    } } },
  };
}

/** a blue frame over white, cut by the masks given (a disc of radius 50 at the centre, a band across the top) */
const DISC = { v: [[0, -50], [50, 0], [0, 50], [-50, 0]], i: [[-27.6, 0], [0, -27.6], [27.6, 0], [0, 27.6]], o: [[27.6, 0], [0, 27.6], [-27.6, 0], [0, -27.6]], closed: true };
const BAND = { v: [[-160, -90], [160, -90], [160, -40], [-160, -40]], closed: true };
function masked(masks: unknown[]) {
  return {
    schema: 'tramme/1', meta: { title: 'masks' }, tokens: {}, assets: {}, root: 'main',
    compositions: { main: { name: 'Main', width: 320, height: 180, fps: 30, duration: 1, background: '#FFFFFF', motionBlur: { samples: 1, shutter: 0 }, order: ['frame'], layers: {
      frame: { type: 'shape.rect', transform: { position: [160, 90] }, props: { size: [320, 180], fill: '#0000FF' }, masks },
    } } },
  };
}
const MASKS: Record<string, unknown[]> = {
  disc: [{ id: 'm', props: { path: DISC } }],
  hole: [{ id: 'm', props: { path: DISC, mode: 'subtract' } }],
  inverted: [{ id: 'm', props: { path: DISC, invert: true } }],
  grown: [{ id: 'm', props: { path: DISC, expansion: 20 } }],
  feathered: [{ id: 'm', props: { path: DISC, feather: 30 } }],
  // the disc and the band, then only where both are
  both: [{ id: 'a', props: { path: { v: [[-160, -90], [160, -90], [160, 90], [-160, 90]], closed: true } } }, { id: 'b', props: { path: DISC, mode: 'intersect' } }, { id: 'c', props: { path: BAND, mode: 'subtract' } }],
};

/** a red frame through a LUT that swaps red and blue, at a strength */
const SWAP_CUBE = `LUT_3D_SIZE 2\n${[0, 1].flatMap((b) => [0, 1].flatMap((g) => [0, 1].map((r) => `${b} ${g} ${r}`))).join('\n')}\n`;
function graded(strength: number) {
  return {
    schema: 'tramme/1', meta: { title: 'lut' }, tokens: {}, assets: { swap: { type: 'lut', src: 'swap.cube' } }, root: 'main',
    compositions: { main: { name: 'Main', width: 320, height: 180, fps: 30, duration: 1, background: '#000000', motionBlur: { samples: 1, shutter: 0 }, order: ['frame'], layers: {
      frame: { type: 'shape.rect', transform: { position: [160, 90] }, props: { size: [320, 180], fill: '#FF0000' }, effects: [{ id: 'g', type: 'fx.lut', props: { lut: 'swap', strength } }] },
    } } },
  };
}

let dir = '', server: Server, close: () => Promise<void>, still: (kind: string, t: number) => Promise<(x: number, y: number) => Pixel>;

describe.skipIf(!CHROME)('effects, rendered', () => {
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tramme-transitions-'));
    for (const k of KINDS) fs.writeFileSync(path.join(dir, `${k}.tramme.json`), JSON.stringify(doc(k)));
    fs.writeFileSync(path.join(dir, 'key.tramme.json'), JSON.stringify(keyed('result')));
    fs.writeFileSync(path.join(dir, 'swap.cube'), SWAP_CUBE);
    fs.writeFileSync(path.join(dir, 'lut.tramme.json'), JSON.stringify(graded(1)));
    fs.writeFileSync(path.join(dir, 'lut-half.tramme.json'), JSON.stringify(graded(0.5)));
    for (const [name, masks] of Object.entries(MASKS)) fs.writeFileSync(path.join(dir, `mask-${name}.tramme.json`), JSON.stringify(masked(masks)));
    fs.writeFileSync(path.join(dir, 'key-matte.tramme.json'), JSON.stringify(keyed('matte')));
    server = new Server(readConfig(path.join(dir, 'crossfade.tramme.json')));
    const port = await server.start();
    const { browser, page } = await launch();
    close = async () => { await browser.close(); server.close(); };
    still = async (kind, t) => {
      await openDoc(page, port, `/project/${kind}.tramme.json`);
      const url: string = await page.evaluate((x) => (window as any).TRAMME.still(x), t);
      const png = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
      return (x, y) => { const i = (y * png.width + x) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
    };
  }, 120_000);
  afterAll(async () => { await close?.(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

  const near = (a: Pixel, b: Pixel) => a.every((v, i) => Math.abs(v - b[i]) <= 3);
  const RED: Pixel = [255, 0, 0], BLUE: Pixel = [0, 0, 255];

  it('crossfades linearly and dips through a colour', async () => {
    expect(near((await still('crossfade', 1.5))(160, 90), [128, 0, 128])).toBe(true);
    expect(near((await still('dip', 1.5))(160, 90), [255, 255, 255])).toBe(true);
    expect(near((await still('dip', 1.25))(160, 90), [255, 128, 128])).toBe(true);
  }, 60_000);

  it('pushes the new shot in from the side its direction names, blurred along the move', async () => {
    const half = await still('push', 1.5);
    expect(near(half(20, 90), RED)).toBe(true);
    expect(near(half(300, 90), BLUE)).toBe(true);
    // the edge spread over pixels rather than a hard line
    const edge = half(160, 90);
    expect(edge[0]).toBeGreaterThan(40);
    expect(edge[2]).toBeGreaterThan(40);
  }, 60_000);

  it('opens a luma wipe where its picture is dark first', async () => {
    const f = await still('luma', 1.25);
    expect(near(f(20, 90), BLUE)).toBe(true);
    expect(near(f(300, 90), RED)).toBe(true);
  }, 60_000);

  it('shows the outgoing shot before and the incoming one after, whatever the kind', async () => {
    for (const k of KINDS) {
      expect(near((await still(k, 0.5))(160, 90), RED), `${k} before`).toBe(true);
      expect(near((await still(k, 2.5))(160, 90), BLUE), `${k} after`).toBe(true);
    }
  }, 120_000);

  it('keys a green screen out, the subject kept, the matte to judge it', async () => {
    const f = await still('key', 0.5);
    // the screen gone at the top and the bottom (light and shade alike): the white background through it
    expect(near(f(10, 5), [255, 255, 255])).toBe(true);
    expect(near(f(10, 175), [255, 255, 255])).toBe(true);
    expect(near(f(160, 90), [208, 32, 32])).toBe(true);
    const m = await still('key-matte', 0.5);
    expect(near(m(10, 5), [0, 0, 0])).toBe(true);
    expect(near(m(160, 90), [255, 255, 255])).toBe(true);
  }, 60_000);

  it('cuts a layer by its masks: added, taken away, inverted, grown, feathered, combined', async () => {
    const WHITE: Pixel = [255, 255, 255];
    const disc = await still('mask-disc', 0.5);
    expect(near(disc(160, 90), BLUE)).toBe(true);
    expect(near(disc(10, 10), WHITE)).toBe(true);
    const hole = await still('mask-hole', 0.5);
    expect(near(hole(160, 90), WHITE)).toBe(true);
    expect(near(hole(10, 10), BLUE)).toBe(true);
    const inv = await still('mask-inverted', 0.5);
    expect(near(inv(160, 90), WHITE)).toBe(true);
    expect(near(inv(10, 10), BLUE)).toBe(true);
    // 60 px from the centre: outside the disc, inside it grown by 20
    expect(near(disc(220, 90), WHITE)).toBe(true);
    expect(near((await still('mask-grown', 0.5))(220, 90), BLUE)).toBe(true);
    // feathered: its edge between the two
    const edge = (await still('mask-feathered', 0.5))(210, 90);
    expect(edge[2]).toBe(255);
    expect(edge[0]).toBeGreaterThan(30);
    expect(edge[0]).toBeLessThan(225);
    // the frame, intersected with the disc, without the band: the disc's top is gone
    const both = await still('mask-both', 0.5);
    expect(near(both(160, 90), BLUE)).toBe(true);
    expect(near(both(160, 45), WHITE)).toBe(true);
    expect(near(both(10, 170), WHITE)).toBe(true);
  }, 120_000);

  it('grades through a .cube LUT, at its strength', async () => {
    expect(near((await still('lut', 0.5))(160, 90), BLUE)).toBe(true);
    expect(near((await still('lut-half', 0.5))(160, 90), [128, 0, 128])).toBe(true);
  }, 60_000);
});
