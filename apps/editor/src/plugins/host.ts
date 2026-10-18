// The page's end of the plugin sandbox: it owns the worker and bridges the
// contexts. A tool or check that runs inside asks for the project's files,
// stills and transcripts here, and its operations come back as plain data,
// validated and proposed like any tool's (ai/tools.ts calls the wrappers the
// registry carries — plugins/vocabulary.ts puts them there).

import { toolOutput, type CheckContext, type NodeType, type PlacedLayer, type QualityIssue, type ToolContext, type ToolOutput } from '@tramme/core';
import type { Ask, DrawPayload, DrawResult, FromWorker, PluginDecl, SandboxDoc, ToWorker } from './protocol.ts';

/** the schema of a node without its code: what a check's samples may cross */
const schemaOf = (n: NodeType) => ({ type: n.type, title: n.title, category: n.category, description: n.description, ai: n.ai, props: n.props, ...(n.container ? { container: true } : {}) });

export interface PluginHost {
  /** the declarations of the loaded plugins (a known url is not loaded again) */
  ensure(plugins: { id: string; url: string }[]): Promise<Map<string, PluginDecl>>;
  /** run a plugin's tool against the page's context; rejects on error or abort */
  runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutput>;
  /** run a plugin's check against the page's context */
  runCheck(name: string, ctx: CheckContext): Promise<QualityIssue[]>;
  /** the document's side of the sandbox (assets, fonts): sent when it changes */
  setDoc(doc: SandboxDoc): void;
  /** draw a frame's sandboxed layers; resolves with one result per item */
  draw(payload: DrawPayload): Promise<DrawResult[]>;
  /** a node's vector export, computed in the sandbox */
  exportOf(type: string, props: unknown): Promise<{ svg?: string; lottie?: unknown; err?: string }>;
  dispose(): void;
}

/**
 * The protocol's page side, on any transport (a worker in the editor, a
 * direct pair in tests). `docUrl` is the open document's address, the base
 * the sandbox resolves asset and file urls against.
 */
export function connectHost(send: (m: ToWorker) => void, docUrl: () => string): { host: PluginHost; receive: (m: FromWorker) => void } {
  let call = 0;
  const decls = new Map<string, PluginDecl>();
  const urls = new Map<string, string>();
  const waits = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const loads = new Map<number, { resolve: (d: Map<string, PluginDecl>) => void; reject: (e: Error) => void; wanted: Set<string> }>();
  /** the page context of a running call, asked for files, stills, data */
  const bridges = new Map<number, ToolContext | CheckContext>();
  /** a node type's schema, computed once (checks ship many samples of the same types) */
  const schemas = new WeakMap<NodeType, unknown>();
  const schemaShipped = (n: NodeType) => {
    let s = schemas.get(n);
    if (!s) { s = schemaOf(n); schemas.set(n, s); }
    return s;
  };

  const answer = (ctx: ToolContext | CheckContext, a: Ask): unknown | Promise<unknown> => {
    if (a.kind === 'readText') return (ctx as ToolContext).readText(a.path);
    if (a.kind === 'files') return (ctx as ToolContext).files();
    if (a.kind === 'writeFile') return (ctx as ToolContext).writeFile(a.path, 'text' in a.data ? a.data.text : new Blob([a.data.bytes]));
    if (a.kind === 'renderStill') return (ctx as ToolContext).renderStill(a.t, a.compId);
    if (a.kind === 'transcript') return (ctx as ToolContext).transcript(a.assetId, { ask: a.ask });
    return (ctx as CheckContext).data(a.assetId);
  };

  const receive = (m: FromWorker) => {
    if (m.kind === 'loaded') {
      for (const d of m.plugins) decls.set(d.id, d);
      for (const [c, w] of [...loads]) {
        if (![...w.wanted].every((id) => decls.has(id))) continue;
        loads.delete(c);
        w.resolve(decls);
      }
      return;
    }
    if (m.kind === 'loadFailed') {
      const first = [...loads.entries()][0];
      if (first) { loads.delete(first[0]); first[1].reject(new Error(`plugin ${m.id}: ${m.message}`)); }
      return;
    }
    if (m.kind === 'result') {
      const w = waits.get(m.call);
      if (!w) return;
      waits.delete(m.call);
      bridges.delete(m.call);
      if (m.err) w.reject(new Error(m.err));
      else w.resolve(m.ok);
      return;
    }
    if (m.kind === 'drawn') {
      const w = waits.get(m.call);
      if (!w) return;
      waits.delete(m.call);
      w.resolve(m.results);
      return;
    }
    if (m.kind === 'exported') {
      const w = waits.get(m.call);
      if (!w) return;
      waits.delete(m.call);
      if (m.err) w.reject(new Error(m.err));
      else w.resolve({ svg: m.svg, lottie: m.lottie });
      return;
    }
    if (m.kind === 'progress') {
      const ctx = bridges.get(m.call);
      if (ctx && 'progress' in ctx) (ctx as ToolContext).progress?.(m.done, m.total, m.step);
      return;
    }
    if (m.kind === 'ask') {
      const ctx = bridges.get(m.call);
      if (!ctx) { send({ kind: 'answer', id: m.id, err: 'the call is over' }); return; }
      void Promise.resolve()
        .then(() => answer(ctx, m.q))
        .then((ok) => send({ kind: 'answer', id: m.id, ok: ok === undefined ? null : ok }))
        .catch((e: Error) => send({ kind: 'answer', id: m.id, err: e.message }));
    }
  };

  const run = (msg: ToWorker & { call: number }, ctx?: ToolContext | CheckContext, signal?: AbortSignal): Promise<unknown> => {
    const c = msg.call;
    if (ctx) bridges.set(c, ctx);
    const stop = () => send({ kind: 'abort', call: c });
    signal?.addEventListener('abort', stop, { once: true });
    send(msg);
    return new Promise((resolve, reject) => waits.set(c, {
      resolve: (v) => { signal?.removeEventListener('abort', stop); resolve(v); },
      reject: (e) => { signal?.removeEventListener('abort', stop); reject(e); },
    }));
  };

  const host: PluginHost = {
    ensure(plugins) {
      const fresh = plugins.filter((p) => urls.get(p.id) !== p.url);
      if (!fresh.length) return Promise.resolve(new Map(decls));
      for (const p of fresh) urls.set(p.id, p.url);
      return new Promise((resolve, reject) => {
        const c = ++call;
        loads.set(c, { resolve, reject, wanted: new Set(fresh.map((p) => p.id)) });
        send({ kind: 'load', plugins: fresh });
      });
    },
    async runTool(name, input, ctx) {
      const out = await run({ kind: 'tool', name, input, call: ++call, ctx: { doc: ctx.doc, compId: ctx.compId, time: ctx.time, selection: ctx.selection, docUrl: docUrl() } }, ctx, ctx.signal);
      return toolOutput(out);
    },
    async runCheck(name, ctx) {
      // the samples cross as plain data: each layer's node becomes its schema
      const samples = ctx.samples.map((s) => ({ ...s, layers: s.layers.map((p: PlacedLayer) => ({ ...p, node: schemaShipped(p.node) })) }));
      const out = await run({ kind: 'check', name, call: ++call, ctx: { doc: ctx.doc, compId: ctx.compId, comp: ctx.comp, step: ctx.step, samples } }, ctx);
      return Array.isArray(out) ? out as QualityIssue[] : [];
    },
    setDoc(doc) {
      send({ kind: 'doc', doc });
    },
    async draw(payload) {
      return await run({ kind: 'draw', call: ++call, payload }) as DrawResult[];
    },
    async exportOf(type, props) {
      const r = await run({ kind: 'export', call: ++call, type, props });
      return (r ?? {}) as { svg?: string; lottie?: unknown; err?: string };
    },
    dispose() {
      for (const [, w] of waits) w.reject(new Error('the plugin sandbox is closed'));
      waits.clear();
      loads.clear();
    },
  };

  return { host, receive };
}

/** the editor's sandbox: one browser worker, at its fixed address */
export function browserHost(docUrl: string): PluginHost {
  const worker = new Worker('/plugin-worker.js', { type: 'module' });
  const { host, receive } = connectHost((m) => worker.postMessage(m), () => docUrl);
  worker.onmessage = (e: MessageEvent) => receive(e.data as FromWorker);
  worker.onerror = () => host.dispose();
  return {
    ...host,
    dispose() { host.dispose(); worker.terminate(); },
  };
}
