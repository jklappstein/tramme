import { describe, expect, it } from 'vitest';
import type { Composition, TrammeDoc } from '@tramme/core';
import { applyOps as apply } from '@tramme/core';
import { carriedStart, contentEnd, crossfadeOps, describeOp, isToolAsset, mediaAssetsOf, splitLayerOps, trimInOps } from '../src/model.ts';
import { passes } from '../src/ai/server.ts';

const comp = (layers: Composition['layers']): Composition => ({ name: 'Main', width: 1920, height: 1080, fps: 30, duration: 60, layers, order: Object.keys(layers) });

describe('where the content of a composition ends', () => {
  it('is the out point of its last layer', () => {
    expect(contentEnd(comp({ a: { type: 'text', out: 12 }, b: { type: 'image', in: 10, out: 20 } }))).toBe(20);
  });
  it('is the whole composition when a layer runs to its end', () => {
    expect(contentEnd(comp({ a: { type: 'text', out: 12 }, bg: { type: 'shape.rect' } }))).toBe(60);
  });
});

describe('a proposal line', () => {
  const doc = { assets: { refkit: { type: 'module', src: 'plugins/refkit.js', name: 'Reference kit' } }, plugins: ['charts'] } as unknown as TrammeDoc;
  it('names a file instead of showing its JSON', () => {
    const line = describeOp(doc, { op: 'add', path: '/assets/kit2', value: { type: 'module', src: 'plugins/kit2.js', name: 'Kit 2' } });
    expect(line).toContain('Kit 2');
    expect(line).not.toContain('{');
    expect(describeOp(doc, { op: 'replace', path: '/assets/refkit/src', value: 'plugins/x.js' })).toContain('Reference kit');
  });
  it('tells the plugins in use once the change is made', () => {
    expect(describeOp(doc, { op: 'add', path: '/plugins/-', value: 'refkit' })).toContain('charts, Reference kit');
    expect(describeOp(doc, { op: 'replace', path: '/plugins', value: ['refkit'] })).toContain('Reference kit');
    expect(describeOp(doc, { op: 'remove', path: '/plugins/0' })).not.toContain('charts');
  });
});

describe('a failure worth a new attempt', () => {
  it('is the network or a busy server', () => {
    for (const m of ['Failed to fetch', 'companion: HTTP 503', 'Overloaded', 'read ECONNRESET', 'stream ended before the answer', 'rate_limit_error: rate limit, retry soon']) expect(passes(m), m).toBe(true);
  });
  it('is never a quota, a plan or a key', () => {
    for (const m of ['You exceeded your current quota, please check your plan and billing details', 'Claude AI usage limit reached|1760000000', 'invalid x-api-key', 'HTTP 401', 'Please run /login', 'a property is missing']) expect(passes(m), m).toBe(false);
  });
});

const applyOps = (doc: TrammeDoc, ops: Parameters<typeof apply>[1]) => apply(doc, ops).doc;

describe('a clip cut at the playhead', () => {
  const doc = (layers: Composition['layers'], children?: Record<string, string[]>) => {
    const c = comp(layers);
    if (children) { for (const [g, ch] of Object.entries(children)) c.layers[g].children = ch; c.order = c.order.filter((id) => !Object.values(children).flat().includes(id)); }
    return { version: 1, root: 'main', compositions: { main: c }, assets: {}, tokens: {} } as unknown as TrammeDoc;
  };
  it('keeps what a video, a sound or a composition plays in place', () => {
    expect(carriedStart({ type: 'video', props: { start: 2 } }, 3)).toBe(5);
    expect(carriedStart({ type: 'audio', props: { rate: 2 } }, 3)).toBe(6);
    expect(carriedStart({ type: 'comp', props: { start: 1, speed: 0.5 } }, 4)).toBe(3);
    expect(carriedStart({ type: 'comp', props: { remap: 2 } }, 4)).toBeNull();
    expect(carriedStart({ type: 'video', props: { start: { $k: [{ t: 0, v: 0 }] } } }, 1)).toBeNull();
    expect(carriedStart({ type: 'text', props: {} }, 1)).toBeNull();
  });
  it('trims the head of a video in its file', () => {
    const d = applyOps(doc({ v: { type: 'video', in: 2, out: 10, props: { video: 'a', start: 1 } } }), trimInOps(doc({ v: { type: 'video', in: 2, out: 10, props: { video: 'a', start: 1 } } }), 'main', 'v', 5));
    expect(d.compositions.main.layers.v).toMatchObject({ in: 5, out: 10, props: { start: 4 } });
  });
  it('splits a clip in two that play on as one', () => {
    const d0 = doc({ v: { type: 'video', in: 2, out: 10, props: { video: 'a', start: 1 } }, t: { type: 'text' } });
    const r = splitLayerOps(d0, 'main', 'v', 6)!;
    const d = applyOps(d0, r.ops), c = d.compositions.main;
    expect(r.id).toBe('v-2');
    expect(c.layers.v).toMatchObject({ in: 2, out: 6, props: { start: 1 } });
    expect(c.layers['v-2']).toMatchObject({ in: 6, out: 10, props: { video: 'a', start: 5 } });
    expect(c.order).toEqual(['v', 'v-2', 't']);
  });
  it('places the second part inside the same group, and refuses outside the clip or on a group', () => {
    const d0 = doc({ g: { type: 'group' }, a: { type: 'text', in: 0, out: 4 }, b: { type: 'text' } }, { g: ['a', 'b'] });
    const d = applyOps(d0, splitLayerOps(d0, 'main', 'a', 1)!.ops);
    expect(d.compositions.main.layers.g.children).toEqual(['a', 'a-2', 'b']);
    expect(d.compositions.main.order).toEqual(['g']);
    expect(splitLayerOps(d0, 'main', 'a', 4)).toBeNull();
    expect(splitLayerOps(d0, 'main', 'g', 1)).toBeNull();
  });
  it('cross-fades two clips that meet: the earlier one gives way, whichever is asked', () => {
    const keys = (d: TrammeDoc, id: string) => (d.compositions.main.layers[id].transform?.opacity as { $k: { t: number; v: number }[] }).$k.map((k) => [k.t, k.v]);
    // a before b, overlapping from 4 to 6 s: a fades out, b fades in, around 5 s
    const d0 = doc({ a: { type: 'video', in: 0, out: 6 }, b: { type: 'video', in: 4, out: 10 } });
    const fromA = applyOps(d0, crossfadeOps(d0, 'main', 'a', 0.5)!.ops);
    expect(keys(fromA, 'a')).toEqual([[4.5, 1], [5.5, 0]]);
    expect(keys(fromA, 'b')).toEqual([[4.5, 0], [5.5, 1]]);
    // the later clip lower in the stack: the same hand-over
    const d1 = doc({ b: { type: 'video', in: 4, out: 10 }, a: { type: 'video', in: 0, out: 6 } });
    const fromB = applyOps(d1, crossfadeOps(d1, 'main', 'b', 0.5)!.ops);
    expect(keys(fromB, 'a')).toEqual([[4.5, 1], [5.5, 0]]);
    expect(keys(fromB, 'b')).toEqual([[4.5, 0], [5.5, 1]]);
  });
  it('reads the media of the selected layers, a 3D model included, and tells the tools\' own files apart', () => {
    const d0 = doc({ m: { type: 'model.3d', props: { source: 'beetle' } }, p: { type: 'image', props: { image: 'photo-cut' } }, t: { type: 'text' } });
    d0.assets = { beetle: { type: 'model', src: 'assets/chat/beetle.glb' }, 'photo-cut': { type: 'image', src: 'assets/cutout/photo.png' } };
    expect(mediaAssetsOf(d0, 'main', ['m', 't'], ['model'])).toEqual(['beetle']);
    // a selected cut-out is a choice: it is read like any picture
    expect(mediaAssetsOf(d0, 'main', ['p'], ['image'])).toEqual(['photo-cut']);
    // a tool's file, by its name or by where it was written (an id cut to 64 characters loses its suffix)
    expect(isToolAsset('depth-photo')).toBe(true);
    expect(isToolAsset('a-very-long-name', { src: 'assets/cutout/a-very-long-name.png' })).toBe(true);
    expect(isToolAsset('photo', { src: 'assets/photo.png' })).toBe(false);
  });
  it('refuses a cross-fade when one clip holds the other', () => {
    expect(crossfadeOps(doc({ a: { type: 'video', in: 4, out: 6 }, b: { type: 'video', in: 0, out: 10 } }), 'main', 'a', 0.5)).toBeNull();
    expect(crossfadeOps(doc({ a: { type: 'video', in: 0, out: 10 }, b: { type: 'video', in: 4, out: 6 } }), 'main', 'a', 0.5)).toBeNull();
  });
});
