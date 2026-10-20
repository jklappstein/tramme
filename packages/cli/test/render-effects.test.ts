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

let dir = '', server: Server, close: () => Promise<void>, still: (kind: string, t: number) => Promise<(x: number, y: number) => Pixel>;

describe.skipIf(!CHROME)('effects, rendered', () => {
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tramme-transitions-'));
    for (const k of KINDS) fs.writeFileSync(path.join(dir, `${k}.tramme.json`), JSON.stringify(doc(k)));
    fs.writeFileSync(path.join(dir, 'key.tramme.json'), JSON.stringify(keyed('result')));
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
});
