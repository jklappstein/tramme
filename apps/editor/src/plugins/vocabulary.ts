// How the document's plugins join the editor's vocabulary under stage 1 of
// the isolation plan (docs/plugin-isolation.md): nodes, effects, modifiers
// and the data exports (kits, presets, prompts, tours, translations) stay on
// the page — they draw — while the tools and checks run in the sandbox, as
// registry entries whose calls bridge there. The assistant's surface does not
// change: use_tool and list_nodes speak in names and schemas as before.

import type { PluginModule, Registry, TrammeDoc } from '@tramme/core';
import type { PluginHost } from './host.ts';
import { noteSandboxDeclaration, sandboxNode } from './sandbox-draw.ts';

/**
 * What the page's registry takes from a plugin module: the tools and checks
 * go to the sandbox (stage 1), and every node draws from the sandbox too
 * (stage 2) — its geometry (outline, handles, vector export) is served from
 * what the sandbox ships with the frames. The module itself still loads on
 * the page for nothing but its declarations; its authoring and drawing code
 * is reached only through the sandbox's copy. (Still on the page, documented:
 * modifiers, Canvas2D effects and the stepping of simulations.)
 */
export function filterModule(mod: PluginModule): PluginModule {
  const { tools: _tools, checks: _checks, ...rest } = mod;
  return {
    ...rest,
    nodes: rest.nodes?.map((n) => sandboxNode(n)),
  };
}

/** the plugins whose isolated entries a registry already carries */
const attached = new WeakMap<Registry, Set<string>>();

/**
 * Give the registry the plugin's tools and checks as sandbox-backed entries
 * (idempotent: a registry that already carries a plugin is left alone). The
 * urls come from the renderer's asset store, so an edited plugin file (its
 * url re-versioned) is loaded again in the sandbox.
 */
export async function attachIsolated(registry: Registry, host: PluginHost, doc: TrammeDoc, urlOf: (id: string) => string | null): Promise<void> {
  const list = (doc.plugins ?? []).map((id) => ({ id, url: urlOf(id) })).filter((p): p is { id: string; url: string } => !!p.url);
  if (!list.length) return;
  let done = attached.get(registry);
  if (!done) attached.set(registry, done = new Set());
  const missing = list.filter((p) => !done.has(p.id));
  if (!missing.length) return;
  const decls = await host.ensure(missing);
  for (const { id } of missing) {
    done.add(id);
    const d = decls.get(id);
    if (!d) throw new Error(`plugin ${id} did not load in the sandbox`);
    noteSandboxDeclaration(d);
    if (!d.tools.length && !d.checks.length) continue;
    registry.use({
      tools: d.tools.map((t) => ({ ...t, run: (input, ctx) => host.runTool(t.name, input, ctx) })),
      checks: d.checks.map((c) => ({ ...c, run: (ctx) => host.runCheck(c.name, ctx) })),
    }, id);
  }
}
