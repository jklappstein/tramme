import { describe, expect, it } from 'vitest';
import { Renderer } from '../src/renderer.ts';

/** what a frame waits for, without a canvas: settle reads only the pending list */
const waiting = (...pending: Promise<unknown>[]) => Object.assign(Object.create(Renderer.prototype), { pending, late: false }) as Renderer;
const never = () => new Promise<void>(() => {});

describe('a frame waiting for what it lacks', () => {
  it('draws again once it came', async () => {
    const r = waiting(Promise.resolve());
    expect(await r.settle(1000)).toBe(true);
    expect(r.late).toBe(false);
  });

  it('stops waiting at the limit for what never comes, and says it is late', async () => {
    const r = waiting(never());
    expect(await r.settle(20)).toBe(false);
    expect(r.late).toBe(true);
  });

  it('stops at once when the export is cancelled', async () => {
    const stop = new AbortController();
    const r = waiting(never());
    const wait = r.settle(60_000, stop.signal);
    stop.abort(new DOMException('stopped', 'AbortError'));
    await expect(wait).rejects.toThrow('stopped');
  });
});
