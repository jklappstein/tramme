// The plugin sandbox's own file, served at /plugin-worker.js: one browser
// worker per project (created by plugins/host.ts). Its globals are narrowed
// before any plugin loads, then the shared logic of worker-side.ts does the
// talking, and worker-draw.ts the drawing. Plugin modules are imported here,
// so their code runs with no DOM, no origin of its own, and only the reaches
// the page bridges back.

import { makeSandboxDraw } from './worker-draw.ts';
import { guardRealm, startWorkerSide } from './worker-side.ts';

const self_ = self as unknown as { location: { href: string }; postMessage(m: unknown, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent) => void) | null; WebSocket?: unknown; fetch?: typeof fetch };

guardRealm(self_, new URL(self_.location.href).origin);

const side = startWorkerSide({
  post: (m, transfer) => self_.postMessage(m, transfer ?? []),
  importModule: (url) => import(/* @vite-ignore */ url),
  sandbox: (modules) => makeSandboxDraw(modules),
});

self_.onmessage = (e: MessageEvent) => side.receive(e.data as never);
