// The page's half of the sandboxed drawing (stage 2 of plugin-isolation.md).
// A sandboxable node (one that needs no synchronous geometry on the page) is
// registered with a wrapper instead of its own draw: the wrapper asks the
// sandbox for the layer's picture at this frame and draws what comes back.
// The first pass of a frame has nothing yet, so it defers — renderComplete
// waits and draws again with the fresh picture, which keeps stills and
// exports exact — and a fast preview pass draws the layer's last picture
// rather than nothing. One sample per frame: a plugin layer's motion blur
// takes its picture at the first sub-time.

import type { Host, NodeType, Rect, TrammeDoc } from '@tramme/core';
import type { PluginHost } from './host.ts';
import type { SandboxDoc } from './protocol.ts';

/** what the wrapper needs from the editor: the document and its loaded assets */
export interface SandboxContext {
  doc: TrammeDoc;
  docUrl: string;
  /** the loaded value of an asset (a picture, a json), or null */
  loaded(id: string): unknown | null;
}

let env: { host: () => PluginHost; context: () => SandboxContext | null } | null = null;

/** bound once by the preview: every sandboxed draw goes through the project's sandbox */
export function bindSandbox(e: { host: () => PluginHost; context: () => SandboxContext | null }) { env = e; }

/** a node whose geometry the page never needs synchronously can draw in the sandbox */
export const sandboxable = (node: NodeType) => !node.path && !node.handles && !node.export;

/**
 * The node as the page's registry holds it: schemas, notes, simulations
 * (still stepped on the page, their state shipped per frame) — and a draw
 * that asks the sandbox instead of the plugin's code.
 */
export function sandboxNode(node: NodeType): NodeType {
  return {
    ...node,
    path: undefined,
    handles: undefined,
    export: undefined,
    bounds: undefined,
    load: undefined,
    render: { canvas2d: (ctx, props, host) => drawSandboxed(ctx, host, node, props) },
  };
}

interface Picture { frame: number; bitmap?: CanvasImageSource; area?: Rect; err?: string }
/** the last picture of a layer (drawn again while the fresh one is in flight) */
const ready = new Map<string, Picture>();
/** the draws in flight, by layer and frame */
const pending = new Map<string, Promise<Picture>>();

const FALLING: Rect = { x: -60, y: -60, w: 120, h: 120 };

function drawSandboxed(ctx: CanvasRenderingContext2D, host: Host, node: NodeType, props: unknown) {
  const entry = ready.get(host.layerId);
  if (entry && entry.frame === host.frame) {
    if (entry.err || !entry.bitmap || !entry.area) throw new Error(entry.err ?? `${node.type} drew nothing`);
    ctx.drawImage(entry.bitmap, entry.area.x, entry.area.y, entry.area.w, entry.area.h);
    return;
  }
  const key = `${host.layerId}/${host.frame}`;
  let p = pending.get(key);
  if (!p) {
    p = request(host, node.type, props, entry?.frame);
    pending.set(key, p);
    void p.then((r) => {
      const old = ready.get(host.layerId);
      if (old?.bitmap && old.bitmap !== r.bitmap) (old.bitmap as { close?(): void }).close?.();
      ready.set(host.layerId, { ...r, frame: host.frame });
    }).catch(() => {}).finally(() => pending.delete(key));
    host.defer?.(p);
  }
  // the last picture stands in until the fresh one has crossed
  if (entry?.bitmap && entry.area) ctx.drawImage(entry.bitmap, entry.area.x, entry.area.y, entry.area.w, entry.area.h);
}

async function request(host: Host, type: string, props: unknown, previousFrame?: number): Promise<Picture> {
  const e = env;
  if (!e) return { err: 'the plugin sandbox is not bound', frame: previousFrame ?? host.frame };
  const doc = e.context();
  if (!doc) return { err: 'no document to draw from', frame: previousFrame ?? host.frame };
  const h = e.host();
  sendDoc(h, doc);
  // the other layers at this instant, for host.layer
  const comp = Object.values(doc.doc.compositions).find((c) => c.layers[host.layerId]);
  const layers = (comp?.order ?? []).map((id) => { const l = host.layer?.(id); return l ? { id, ...l } : null; }).filter((l) => !!l);
  const results = await h.draw({
    frame: host.frame,
    comp: { width: host.width, height: host.height, duration: host.duration, fps: host.fps },
    layers,
    items: [{ id: host.layerId, type, props, state: host.state?.(), t: host.t, frame: host.frame }],
  });
  const r = results.find((x) => x.id === host.layerId);
  if (!r) return { err: 'the sandbox sent no picture', frame: host.frame };
  return { bitmap: r.bitmap as CanvasImageSource | undefined, area: r.area, err: r.ok ? undefined : r.err, frame: host.frame };
}

/** the document's side, sent when the document (or an asset) changed */
let lastDoc: TrammeDoc | null = null;
const shipped = new WeakSet<object>();
function sendDoc(h: PluginHost, doc: SandboxContext) {
  if (doc.doc === lastDoc) return;
  lastDoc = doc.doc;
  const images: Record<string, unknown> = {}, json: Record<string, unknown> = {};
  const fonts: SandboxDoc['fonts'] = [];
  for (const [id, a] of Object.entries(doc.doc.assets)) {
    if (shipped.has(a)) continue;
    shipped.add(a);
    if (a.type === 'image' || a.type === 'json') {
      const v = doc.loaded(id);
      if (v !== null) (a.type === 'image' ? images : json)[id] = v;
    } else if (a.type === 'font') {
      fonts.push({ url: new URL(a.src, doc.docUrl).href, family: a.family ?? id, weight: a.weight });
    }
  }
  h.setDoc({ doc: doc.doc, docUrl: doc.docUrl, images, json, fonts });
}

/** a project change invalidates what crossed (the previews rebind) */
export function resetSandbox() {
  lastDoc = null;
  for (const [, p] of pending) p.catch(() => {});
  pending.clear();
  for (const [, pic] of ready) (pic.bitmap as { close?(): void } | undefined)?.close?.();
  ready.clear();
}
