import { describe, expect, it } from 'vitest';
import { applyOps, validate, type ToolContext, type TrammeDoc } from '@tramme/core';
import { newProject } from '@tramme/project';
import { editorRegistry } from '../src/vocabulary.ts';

const reg = editorRegistry();
const project = () => newProject({ name: 'Cuts', width: 1080, height: 1920, fps: 30, duration: 30 }).doc;
const ctxOf = (doc: TrammeDoc, transcript: unknown, time = 0): ToolContext =>
  ({ doc, compId: doc.root, time, selection: [], registry: reg, transcript: async () => transcript } as unknown as ToolContext);

/** run a tool of the vocabulary and apply its operations */
async function use(doc: TrammeDoc, transcript: unknown, name: string, input: Record<string, unknown>): Promise<TrammeDoc> {
  const out = (await reg.tool(name).tool.run(input, ctxOf(doc, transcript))) as { ops: never[] };
  return applyOps(doc, out.ops).doc;
}

describe('silences', () => {
  it('split a talking video into the spans where something is said', async () => {
    let doc = project();
    doc = { ...doc, assets: { ...doc.assets, talk: { type: 'video', src: 'assets/talk.mp4' } } };
    doc = applyOps(doc, [
      { op: 'add', path: '/compositions/main/layers/talk', value: { type: 'video', name: 'Talk', in: 0, out: 20, props: { video: 'talk', size: [1080, 1920], fit: 'cover', start: 5 } } },
      { op: 'add', path: '/compositions/main/layers/caption', value: { type: 'text', in: 2, out: 5, props: { text: 'Hello', size: 60 } } },
      { op: 'replace', path: '/compositions/main/order', value: ['talk', 'caption'] },
    ]).doc;
    // the layer shows the file 5 s to 25 s; words at 5-7, one 1.4 s hesitation, then words filling the tail to 25
    const transcript = { version: 1, duration: 25, words: [
      { w: 'So,', s: 5, e: 7 }, { w: 'well,', s: 8.4, e: 9 }, { w: 'here', s: 9, e: 10 }, { w: 'is', s: 10, e: 10.4 }, { w: 'the', s: 10.4, e: 10.7 }, { w: 'thing.', s: 10.7, e: 24 }, { w: 'More.', s: 24, e: 25 },
    ] };
    doc = await use(doc, transcript, 'silences', { video: 'talk', min: 0.5, keep: 0.12 });
    const c = doc.compositions.main;
    const spans = c.order.filter((id) => c.layers[id].props?.video === 'talk');
    expect(spans).toHaveLength(2);
    // the first span keeps the layer: it ends where the cut happens; the second picks the file up after the gap
    const [a, b] = spans;
    expect(c.layers[a].out).toBeCloseTo(2.58, 2);
    expect(c.layers[b].in as number).toBeCloseTo(c.layers[a].out as number, 2);
    expect((c.layers[b].props as { start: number }).start).toBeCloseTo(7.82, 2);
    // the caption after the cut is left alone
    expect(c.layers.caption.out).toBe(5);
    expect(validate(doc, reg)).toEqual([]);
  });

  it('refuse what it cannot cut', async () => {
    await expect(use(project(), { version: 1, duration: 10, words: [{ w: 'one', s: 0, e: 1 }] }, 'silences', {})).rejects.toThrow(/no video/);
    let doc = project();
    doc = { ...doc, assets: { ...doc.assets, talk: { type: 'video', src: 'assets/talk.mp4' } } };
    doc = applyOps(doc, [
      { op: 'add', path: '/compositions/main/layers/talk', value: { type: 'video', in: 0, out: 6, props: { video: 'talk', size: [1080, 1920] } } },
      { op: 'replace', path: '/compositions/main/order', value: ['talk'] },
    ]).doc;
    await expect(use(doc, { version: 1, duration: 10, words: [{ w: 'one', s: 0, e: 1 }] }, 'silences', { video: 'talk' })).rejects.toThrow(/too few words/);
    const tight = { version: 1, duration: 10, words: [{ w: 'a', s: 0, e: 2 }, { w: 'b', s: 2.1, e: 4 }, { w: 'c', s: 4.2, e: 6 }] };
    await expect(use(doc, tight, 'silences', { video: 'talk' })).rejects.toThrow(/no silence worth cutting/);
  });
});
