// The thumbnails of a video along its clip: one small canvas per slot, decoded
// from the preview's own video decoder (a second decoder would double the
// memory), one at a time, a quarter of a second quantised so the clips of one
// file share their thumbs. Nothing runs while the film plays (the preview has
// the decoder), nothing runs for a hidden timeline, and a small LRU (a few MB
// at most) keeps the recent ones: scrolling back is instant, the decoder is
// never asked twice for the same moment. The timeline repaints at most three
// times a second as thumbs arrive.

import { signal } from '@preact/signals';
import { assetData } from './preview.ts';
import { S } from './state.ts';

/** changes when new thumbs are ready: the timeline follows (throttled) */
export const filmVersion = signal(0);

/** one thumbnail (the timeline's slots draw them at this size), and the LRU's length (≈ 5 MB of small canvases) */
export const FILM_W = 64, FILM_H = 36;
const MAX = 600;
const cache = new Map<string, HTMLCanvasElement>();
/** the decodes asked for, deduplicated by quantised time */
const queue = new Map<string, { asset: string; t: number }>();
let draining = false, lastBump = 0;

const quant = (t: number) => Math.round(t * 4) / 4;
const key = (asset: string, t: number) => `${asset}|${quant(t)}`;

function keep(k: string, c: HTMLCanvasElement) {
  cache.delete(k);
  cache.set(k, c);
  while (cache.size > MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** the thumbnail at a moment of a file, when it is ready; null asks for it (and the timeline repaints when it comes) */
export function filmThumb(asset: string, t: number): HTMLCanvasElement | null {
  const k = key(asset, t);
  const hit = cache.get(k);
  if (hit) { cache.delete(k); cache.set(k, hit); return hit; }
  if (assetData(asset) && !queue.has(k)) { queue.set(k, { asset, t: quant(t) }); void drain(); }
  return null;
}

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.size) {
    // the film plays: the decoder belongs to the preview, the thumbs wait
    if (S.playing.peek()) { await sleep(500); continue; }
    const next = queue.entries().next();
    if (next.done) break;
    const [k, job] = next.value;
    queue.delete(k);
    try {
      const vf = assetData(job.asset) as
        | { request(t: number): Promise<void>; frameAt(t: number): { image: CanvasImageSource | null }; width: number; height: number }
        | undefined;
      if (vf) {
        await vf.request(job.t);
        const f = vf.frameAt(job.t);
        if (f.image) {
          const c = document.createElement('canvas');
          c.width = FILM_W; c.height = FILM_H;
          const g = c.getContext('2d')!;
          const s = Math.max(FILM_W / vf.width, FILM_H / vf.height);
          g.drawImage(f.image, (FILM_W - vf.width * s) / 2, (FILM_H - vf.height * s) / 2, vf.width * s, vf.height * s);
          keep(k, c);
        }
      }
    } catch { /* a file that will not decode stays uncached: its slot simply stays empty */ }
    const now = performance.now();
    if (now - lastBump > 300) { lastBump = now; filmVersion.value++; }
    await sleep(0);
  }
  draining = false;
}
