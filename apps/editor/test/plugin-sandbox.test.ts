// The plugin sandbox's protocol, end to end without a browser: the host and
// the worker side wired directly, as the worker's postMessage would. What
// must hold: the page learns what a plugin declares without its code, a tool
// runs with its reaches bridged (files, writes, stills, progress, abort), a
// check receives plain data only, and the sandbox's realm lets no network
// beyond its own origin.

import { describe, expect, it, vi } from 'vitest';
import { newProject, type Manifest } from '@tramme/project';
import { Registry, toolOutput, type PluginModule, type ToolContext, type CheckContext, type TrammeDoc } from '@tramme/core';
import { connectHost } from '../src/plugins/host.ts';
import { guardRealm, startWorkerSide } from '../src/plugins/worker-side.ts';
import { attachIsolated, filterModule } from '../src/plugins/vocabulary.ts';

const DOC_URL = 'https://tramme.test/p1/document.tramme.json';

/** a plugin module, as the sandbox imports it */
const plugin = (): PluginModule => ({
  meta: { name: 'stars', api: 1 },
  nodes: [{
    type: 'sky.moon', title: 'Moon', category: 'Shapes', props: { radius: { type: 'number', default: 10 } },
    render: { canvas2d: () => {} }, bounds: () => null, simulate: { init: () => 0, step: (s) => s },
  }],
  tools: [{
    name: 'sky.stars', title: 'Star field', description: 'scatters stars',
    input: { type: 'object', properties: { count: { type: 'integer' } }, required: ['count'] },
    async run(input: { count: number }, ctx: ToolContext) {
      const text = await ctx.readText('assets/sky.txt');
      await ctx.writeFile('assets/stars.json', `{"count":${input.count},"read":${text === null ? 'null' : `"${text}"`}}`);
      ctx.progress?.(1, 2, 'placing');
      return { text: `${input.count} stars over ${ctx.assetUrl('moon')}`, ops: [{ op: 'add', path: '/compositions/c/layers/x', value: { type: 'sky.moon' } }] };
    },
  }],
  checks: [{
    name: 'sky.cover', description: 'the sky is not empty',
    run({ samples }) {
      const crossed = samples.some((s) => s.layers.some((p) => p.node.render?.canvas2d || p.node.simulate));
      if (crossed) return [{ check: 'sky.cover', severity: 'warning', message: 'a node crossed with its code' }];
      return samples.some((s) => s.layers.some((p) => p.id === 'moon' && p.opacity > 0.5))
        ? [] : [{ check: 'sky.cover', severity: 'info', message: 'the sky is empty' }];
    },
  }],
});

/** the host and the sandbox wired as a pair (what postMessage does) */
function pair(fixtures: Map<string, PluginModule>, onImport?: (url: string) => void) {
  const side = startWorkerSide({
    post: (m) => queueMicrotask(() => receive(m)),
    importModule: async (url) => {
      onImport?.(url);
      const mod = fixtures.get(url);
      if (!mod) throw new Error(`no such module: ${url}`);
      return mod;
    },
  });
  const { host, receive } = connectHost((m) => queueMicrotask(() => side.receive(m)), () => DOC_URL);
  return { host };
}

const doc = (): { doc: TrammeDoc; manifest: Manifest } => newProject({ name: 'T', width: 100, height: 100, fps: 30, duration: 1 });

/** a page context that records what the sandbox asks */
function toolCtx(doc: TrammeDoc, over: Partial<ToolContext> = {}): ToolContext & { wrote: [string, string][] } {
  const wrote: [string, string][] = [];
  const base: ToolContext = {
    doc, compId: doc.root, time: 0, selection: [], registry: new Registry(),
    assetUrl: () => 'https://tramme.test/p1/assets/moon.png',
    readText: async () => 'night',
    files: async () => [{ path: 'assets/sky.txt', size: 5 }],
    fileUrl: (p) => `https://tramme.test/p1/${p}`,
    writeFile: async (path, data) => { wrote.push([path, typeof data === 'string' ? data : await data.text()]); return path; },
    renderStill: async () => 'data:image/jpeg;base64,AAA',
    transcript: async () => { throw new Error('no transcript here'); },
    signal: new AbortController().signal,
    progress: () => {},
    ...over,
  };
  return Object.assign(base, { wrote });
}

describe('the plugin sandbox', () => {
  it('tells the page what a plugin declares, without its code', async () => {
    const { host } = pair(new Map([['blob:stars', plugin()]]));
    const decls = await host.ensure([{ id: 'stars', url: 'blob:stars' }]);
    const d = decls.get('stars')!;
    expect(d.meta?.name).toBe('stars');
    expect(d.tools.map((t) => t.name)).toEqual(['sky.stars']);
    expect(d.tools[0]).not.toHaveProperty('run');
    expect(d.checks.map((c) => c.name)).toEqual(['sky.cover']);
    expect(d.nodes[0].type).toBe('sky.moon');
    expect(d.nodes[0]).not.toHaveProperty('render');
    // the same url again: nothing reloaded
    const again = await host.ensure([{ id: 'stars', url: 'blob:stars' }]);
    expect(again.get('stars')).toBe(d);
  });

  it('runs a tool with its reaches bridged to the page', async () => {
    const { host } = pair(new Map([['blob:stars', plugin()]]));
    const reg = new Registry();
    const { doc: d } = doc();
    d.assets.stars = { type: 'module', src: 'plugins/stars.js' };
    d.plugins = ['stars'];
    d.assets.moon = { type: 'image', src: 'assets/moon.png' };
    await attachIsolated(reg, host, d, () => 'blob:stars');
    const entry = reg.tool('sky.stars');
    expect(entry.from).toBe('stars');
    const ctx = toolCtx(d);
    const progress = vi.fn();
    ctx.progress = progress;
    const out = toolOutput(await entry.tool.run({ count: 12 }, ctx));
    expect(out.text).toBe('12 stars over https://tramme.test/p1/assets/moon.png');
    expect(out.ops).toHaveLength(1);
    expect(ctx.wrote).toEqual([['assets/stars.json', '{"count":12,"read":"night"}']]);
    expect(progress).toHaveBeenCalledWith(1, 2, 'placing');
  });

  it('keeps a plugin that the sandbox cannot load out of the vocabulary', async () => {
    const { host } = pair(new Map());
    const reg = new Registry();
    const { doc: d } = doc();
    d.plugins = ['ghost'];
    d.assets.ghost = { type: 'module', src: 'plugins/ghost.js' };
    await expect(attachIsolated(reg, host, d, () => 'blob:ghost')).rejects.toThrow(/ghost/);
    expect(reg.hasTool('sky.stars')).toBe(false);
  });

  it('gives a check plain samples, and returns its issues', async () => {
    const { host } = pair(new Map([['blob:stars', plugin()]]));
    const reg = new Registry();
    const { doc: d } = doc();
    d.plugins = ['stars'];
    d.assets.stars = { type: 'module', src: 'plugins/stars.js' };
    await attachIsolated(reg, host, d, () => 'blob:stars');
    const node = { type: 'sky.moon', title: 'Moon', category: 'Shapes', props: {}, render: { canvas2d: () => {} } } as never;
    const check = reg.listChecks().find((c) => c.check.name === 'sky.cover')!.check;
    const ctx = {
      doc: d, compId: d.root, comp: d.compositions[d.root], registry: reg, evaluator: undefined as never,
      samples: [{ t: 0, layers: [{ id: 'moon', layer: {} as never, node, props: {}, opacity: 0.9, box: null }] }],
      step: 0.25, data: () => undefined,
    } as CheckContext;
    // the node's code never crossed: the check's own guard says so
    expect(await check.run(ctx)).toEqual([]);
    ctx.samples[0].layers[0].id = 'darkness';
    expect(await check.run(ctx)).toEqual([{ check: 'sky.cover', severity: 'info', message: 'the sky is empty' }]);
  });

  it('stops a tool whose turn was stopped', async () => {
    const waiting: PluginModule = {
      tools: [{ name: 'sky.wait', description: 'waits', async run(_i: unknown, ctx: ToolContext) { await ctx.readText('never'); return 'done'; } }],
    };
    const { host } = pair(new Map([['blob:wait', waiting]]));
    await host.ensure([{ id: 'wait', url: 'blob:wait' }]);
    const controller = new AbortController();
    const ctx = toolCtx(doc().doc, { readText: () => new Promise<string | null>(() => {}), signal: controller.signal });
    const p = host.runTool('sky.wait', {}, ctx);
    await new Promise((r) => setTimeout(r, 10));
    controller.abort();
    await expect(p).rejects.toThrow(/aborted/);
  });

  it('loads a plugin again when its url changed (an edited file), and not before', async () => {
    const mod = plugin();
    let imports = 0;
    const { host } = pair(new Map([
      ['blob:stars?v=1', mod],
      ['blob:stars?v=2', { ...mod, tools: [{ ...mod.tools![0], name: 'sky.stars2' }] }],
    ]), (url) => { imports++; void url; });
    const first = await host.ensure([{ id: 'stars', url: 'blob:stars?v=1' }]);
    expect(first.get('stars')?.tools[0].name).toBe('sky.stars');
    await host.ensure([{ id: 'stars', url: 'blob:stars?v=1' }]);
    expect(imports).toBe(1);
    const second = await host.ensure([{ id: 'stars', url: 'blob:stars?v=2' }]);
    expect(imports).toBe(2);
    expect(second.get('stars')?.tools[0].name).toBe('sky.stars2');
  });

  it('narrows the realm it runs in: own origin only, no sockets', async () => {
    const calls: string[] = [];
    const realm: { fetch?: typeof fetch; WebSocket?: unknown; location?: { href: string } } = {
      fetch: ((input: RequestInfo | URL) => { calls.push(String(input)); return Promise.resolve(new Response('ok')); }) as typeof fetch,
      WebSocket: class {},
      location: { href: 'https://tramme.test/plugin-worker.js' },
    };
    guardRealm(realm, 'https://tramme.test');
    await (realm.fetch as typeof fetch)('https://tramme.test/api/config');
    await expect((realm.fetch as typeof fetch)('https://evil.test/x')).rejects.toThrow(/evil\.test/);
    expect(realm.WebSocket).toBeUndefined();
    expect(calls).toEqual(['https://tramme.test/api/config']);
  });

  it('strips the tools and checks from what the page registers', () => {
    const filtered = filterModule(plugin());
    expect(filtered.tools).toBeUndefined();
    expect(filtered.checks).toBeUndefined();
    expect(filtered.nodes).toHaveLength(1);
    expect(filtered.meta?.name).toBe('stars');
  });
});
