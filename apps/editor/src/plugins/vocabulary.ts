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

/** the plugins (id and url) a registry already carries from a sandbox, or was refused */
const attached = new WeakMap<Registry, { host: PluginHost; done: Set<string> }>();

/**
 * Give the registry the plugin's tools and checks as sandbox-backed entries
 * (idempotent: a plugin already attached at its url, or refused at it, is left
 * alone; another sandbox attaches them all again). The urls come from the
 * renderer's asset store, so an edited plugin file (its url re-versioned) is
 * loaded again. One plugin that cannot load keeps none of the others out;
 * the refusals are thrown together once all the others are attached.
 */
export async function attachIsolated(registry: Registry, host: PluginHost, doc: TrammeDoc, urlOf: (id: string) => string | null): Promise<void> {
  const list = (doc.plugins ?? []).map((id) => ({ id, url: urlOf(id) })).filter((p): p is { id: string; url: string } => !!p.url);
  if (!list.length) return;
  let seen = attached.get(registry);
  if (seen?.host !== host) attached.set(registry, seen = { host, done: new Set() });
  const { done } = seen;
  const missing = list.filter((p) => !done.has(`${p.id}\n${p.url}`));
  if (!missing.length) return;
  const refused: string[] = [];
  await Promise.all(missing.map(async (p) => {
    try {
      const d = (await host.ensure([p])).get(p.id)!;
      noteSandboxDeclaration(d);
      if (d.tools.length || d.checks.length) {
        registry.use({
          tools: d.tools.map((t) => ({ ...t, run: (input, ctx) => host.runTool(t.name, input, ctx) })),
          checks: d.checks.map((c) => ({ ...c, run: (ctx) => host.runCheck(c.name, ctx) })),
        }, p.id);
      }
    } catch (e) { refused.push((e as Error).message); }
    // said once per url: the same file is not tried again at each edit of the document
    done.add(`${p.id}\n${p.url}`);
  }));
  if (refused.length) throw new Error(refused.join('; '));
}
