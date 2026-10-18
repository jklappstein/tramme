// The sandbox's real raster: what draws a sandboxed layer in the worker. A
// plugin node's own canvas2d runs on an OffscreenCanvas sized to its bounds
// (in local units, translated so the bounds' corner is the origin); its gl
// runs on the node type's WebGL2 service of its own (the same nodeContext the
// engine uses, which prefers an OffscreenCanvas already). The picture comes
// back as an ImageBitmap, transferred. What a draw may reach is what a draw
// needs: evaluated props, the frame's numbers, the simulation state computed
// on the page, the other layers' evaluated data, and the document's pictures,
// json and fonts — not video frames, not other layers' pixels.

import type { Host, NodeType, PluginModule } from '@tramme/core';
import { nodeContext, resizeNode } from '@tramme/render/src/gpu.ts';
import type { DrawPayload, DrawResult, SandboxDoc } from './protocol.ts';
import type { SandboxDrawSide } from './worker-side.ts';

const MAX_PIXELS = 2048;
const FALLING_AREA = { x: -60, y: -60, w: 120, h: 120 };

interface DocSide {
  doc: Record<string, unknown> | null;
  docUrl: string;
  images: Map<string, unknown>;
  json: Map<string, unknown>;
  fonts: Set<string>;
}

export function makeSandboxDraw(modules: Map<string, PluginModule>): SandboxDrawSide {
  const side: DocSide = { doc: null, docUrl: '', images: new Map(), json: new Map(), fonts: new Set() };
  const self_ = self as unknown as { fonts: { add(f: unknown): void } };

  const nodeOf = (type: string): NodeType | null => {
    for (const mod of modules.values()) {
      const n = mod.nodes?.find((x) => x.type === type);
      if (n) return n;
    }
    return null;
  };

  const assetInfo = (id: string): Record<string, unknown> => {
    const assets = side.doc?.assets as Record<string, Record<string, unknown>> | undefined;
    const a = assets?.[id];
    if (!a) throw new Error(`unknown asset: ${id}`);
    return a;
  };

  const hostOf = (item: DrawPayload['items'][number], payload: DrawPayload): Host => ({
    layerId: item.id,
    t: item.t,
    frame: item.frame,
    fps: payload.comp.fps,
    width: payload.comp.width,
    height: payload.comp.height,
    duration: payload.comp.duration,
    asset: ((id: string) => {
      if (side.images.has(id)) return side.images.get(id);
      if (side.json.has(id)) return side.json.get(id);
      const a = assetInfo(id);
      if (a.type === 'font') return a.family ?? id;
      if (a.type === 'video') throw new Error('host.asset: video frames do not cross the sandbox (a video is read by its own layer)');
      if (a.type === 'module') throw new Error('host.asset: module namespaces do not cross the sandbox');
      throw new Error(`host.asset: the asset "${id}" (${String(a.type)}) is not in the sandbox`);
    }) as Host['asset'],
    assetInfo: (id) => assetInfo(id) as never,
    assetUrl: (id) => new URL(String(assetInfo(id).src), side.docUrl).href,
    state: (() => item.state) as Host['state'],
    layer: ((id: string) => payload.layers.find((l) => l.id === id) ?? null) as Host['layer'],
    defer: () => {},
    drawComposition: () => { throw new Error('host.drawComposition does not cross the sandbox'); },
    drawLayer: () => { throw new Error('host.drawLayer does not cross the sandbox'); },
  });

  return {
    setDoc(d: SandboxDoc) {
      side.doc = d.doc as Record<string, unknown>;
      side.docUrl = d.docUrl;
      side.images = new Map(Object.entries(d.images ?? {}));
      side.json = new Map(Object.entries(d.json ?? {}));
      for (const f of d.fonts ?? []) {
        if (side.fonts.has(f.url)) continue;
        side.fonts.add(f.url);
        void fetch(f.url).then((r) => r.arrayBuffer()).then((data) => {
          const face = new FontFace(f.family, data, { weight: f.weight ?? '400' });
          return face.load();
        }).then((face) => self_.fonts.add(face)).catch(() => {});
      }
    },

    async draw(payload: DrawPayload) {
      const results = await Promise.all(payload.items.map(async (item): Promise<DrawResult> => {
        const node = nodeOf(item.type);
        if (!node) return { id: item.id, ok: false, err: `unknown node type: ${item.type}` };
        const host = hostOf(item, payload);
        let area = FALLING_AREA;
        try { area = node.bounds?.(item.props, host) ?? FALLING_AREA; } catch { area = FALLING_AREA; }
        const w = Math.min(MAX_PIXELS, Math.max(1, Math.round(area.w))), h = Math.min(MAX_PIXELS, Math.max(1, Math.round(area.h)));
        try {
          if (node.render.canvas2d) {
            const canvas = new OffscreenCanvas(w, h);
            // the same 2D surface API the engine draws with, on an OffscreenCanvas
            const ctx = canvas.getContext('2d', { alpha: true })! as unknown as CanvasRenderingContext2D;
            // the plugin draws in local units: the bounds' corner becomes the origin
            ctx.translate(-area.x, -area.y);
            node.render.canvas2d(ctx, item.props, host);
            const bitmap = await createImageBitmap(canvas);
            return { id: item.id, ok: true, bitmap, area };
          }
          if (node.render.gl) {
            const g = nodeContext(`sandbox/${item.type}`);
            resizeNode(g, w, h);
            node.render.gl(g, item.props, host, area);
            const bitmap = await createImageBitmap(g.canvas as OffscreenCanvas, 0, (g.canvas as OffscreenCanvas).height - h, w, h);
            return { id: item.id, ok: true, bitmap, area };
          }
          return { id: item.id, ok: false, err: `${item.type} draws nothing` };
        } catch (e) {
          return { id: item.id, ok: false, err: (e as Error).message };
        }
      }));
      const transfer: Transferable[] = results.flatMap((r) => (r.ok && r.bitmap ? [r.bitmap as Transferable] : []));
      return { results, transfer };
    },
  };
}
