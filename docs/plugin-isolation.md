# Isolating untrusted plugins

A design note, not a decision: the codebase gains nothing from it until the author picks an option. It follows the plugins roadmap's open case (step 10, "Isolation of untrusted plugins") and the import guard of the editor, which asks before running an archive's code but does not contain it.

## What runs today, and where

Everything a project brings runs **inside the page** (the editor's origin), with its rights — or inside Node, for the command line:

- **Project plugins** (JS modules in `plugins/`, listed in the document's `plugins`) are loaded in three places, each a plain dynamic `import()`:
  - `apps/editor/src/importer.ts` — during an archive import, to validate the document (behind the trust question since the import guard);
  - `packages/render/src/assets.ts` — the asset store of the renderer, whenever the document names a `module` asset (preview, exports);
  - `packages/cli/src/plugins.ts` — offline renders and `tramme validate` (a `data:` URL, or the file with an mtime cache).
- What a plugin contributes all runs in the same place: **nodes** (their `render.canvas2d` draws every frame; `simulate` steps a state machine frame by frame in the renderer, with checkpoints; `path`, `bounds` and `handles` feed the viewport's gizmos), **effects** (drawn on offscreen canvases, then composited), **modifiers** (pure functions the Evaluator calls), **checks**, **presets**, **tools** (assistant tools with a `ToolContext` that reads and writes the project), **tours**, **translations**.
- **Expressions** are compiled by `packages/core/src/expr.ts` (`new Function`) with the globals shadowed: honest code stays deterministic, hostile code is not contained — `SECURITY.md` says so.
- The engine draws synchronously on `Canvas2D` contexts the page owns; the WebGL2 compositor reads the result. The command line runs the same engine in headless Chrome, so the CLI's plugins have *Node's* rights — a local tool's rights, like a linter's.

The renderer's APIs a plugin host exposes (`host.layer()`, `host.state()`, `host.drawLayer()`, `host.drawComposition()`, `host.asset()`) are all satisfied from in-page state: the Evaluator, the simulation checkpoints, the decoded assets.

## The options

### A. One worker per open project, OffscreenCanvas, an image per frame

The whole render path — Evaluator, draw, simulations — moves into a worker that owns an `OffscreenCanvas`. The main thread receives one `ImageBitmap` per frame and blits it; edits go in as messages.

- **Latency**: one bitmap transfer per frame (near zero-copy). The interactive paths are the price: picking and the gizmos need geometry per `pointermove`, so the worker must answer geometry queries (a few hundred µs each) or the main thread keeps a mirror Evaluator for transforms and bounds only — two evaluators, one document, kept in step by the op log (operations are already the only way the document changes, which makes the mirror exact).
- **Determinism**: unchanged — the same pure functions, one clock (`t`), and simulations step in order in the worker exactly as they do today.
- **`host.layer()` / `host.state()`**: strictly better — the evaluator and the simulation checkpoints live where the plugins run.
- **Audio**: `OfflineAudioContext` does not exist in workers. The mix (preview meter, exports, the check tool) stays on the main thread; it needs only `audioClips` and the curves, which are plain data the worker can send. Plugin audio readers (`AudioReader`) read the mix's data, not its nodes: no canvas, no conflict.
- **Fonts and video**: `WorkerGlobalScope` has `fonts` (a `FontFaceSet`) and `VideoDecoder`, so the font and video assets load in the worker; SVG bitmaps via `createImageBitmap`.
- **Tools**: a plugin's tools keep running on the main thread at first (they need the DOM: pdf.js, media analysis, `ToolContext`); they are the remaining hole, documented, until they get their own story.
- **CLI and desktop**: the CLI already runs outside the page (Node — its own question, see below); the desktop app is the same webview and takes the worker as is.

Cost: moving `renderer.ts` and `preview.ts` onto messages is the single biggest lift in this note, and the viewport's interactivity is where the risk sits.

### B. A sandboxed iframe on another origin

The plugin code runs in an iframe with `sandbox="allow-scripts"` and an opaque origin.

- **Isolation**: weaker than it looks. No storage, no prompts — but `fetch` and image beacons stay open, so exfiltration of project files and provider calls through `api.reach` still work; CPU burn is unbounded. It buys mainly a killable frame.
- **Latency**: worse than A — a transfer per *layer* per frame if only plugin nodes render there, or per frame if the whole renderer moves.
- **Determinism**: a second copy of the engine must be bundled into the iframe; version drift between the two copies is a real risk.
- **`host.layer()` / `host.state()`**: the evaluator must exist in the iframe too — the same duplication as A, plus a message boundary.

Dominated by A: same work, weaker guarantee.

### C. Precompute and validate without running

Expressions and modifiers are pure and canvas-free; they could evaluate in a bare worker with no `OffscreenCanvas`. Static vetting of plugin code is not an option — JavaScript cannot be statically contained, and a linter is a speed bump.

- Alone, C leaves drawing (the bulk of a plugin's rights) on the main thread. It is not isolation; it is the first slice of A that carries no canvas cost, and it would change the evaluator's synchronous contract for an asynchronous one — the same plumbing A needs, for a part that runs no untrusted code today (expressions already exist only in documents, which the import guard asks about).

Not worth it on its own; it only pays as the first milestone of A if the evaluator is ever split.

## Recommendation

**A, staged**, each step shippable alone:

1. **The renderer moves into a worker** for the preview, geometry queries included; the main thread blits bitmaps and keeps a mirror evaluator for the gizmos. No security claim yet — the same code runs, elsewhere.
2. **Browser exports** render through the same worker (they already render off-screen; nothing user-facing changes).
3. **The import's "Run it" loads the plugins in the worker only**; the main thread stops importing project modules entirely. From this point the trust question guards real containment: a refused archive runs nothing, an accepted one runs with no page rights — no storage, no `api.reach`, no DOM. The plugin's nodes, effects, modifiers and simulations are covered; its **tools** (which need the DOM) stay main-thread and documented as the remaining trust, until a bridge gives them an explicit, narrowed `ToolContext`.
4. **A hung or crashed worker** is recovered by restarting it and re-stepping simulations from checkpoints (the machinery exists); the UI shows the project's plugins as stopped, not the editor as dead.

What stays out of scope, said plainly: the **CLI** runs untrusted plugins with Node's rights — that is a local tooling decision (like installing a linter), separate from the web threat model; and audio keeps its main-thread mixer.

## What the import guard already covers

The guard (`readArchive` → `codeInventory` → the ask) is consent, not containment: nothing from an archive runs — plugins are not imported, expressions not compiled — before the user says yes, knowing what the archive carries (the plugins with their file and size, the expressions with their first addresses). Refusal writes nothing; the shipped examples skip the question because they are vetted app content.

It does not cover: what an accepted project does afterwards (page rights: storage of the editor's origin, network, `api.reach` with the user's connected providers, unbounded CPU), a plugin the assistant writes *into an open project* (it runs with the project, as any edit does — the proposal preview shows its effects before it is applied, which is a preview, not a sandbox), and the CLI's Node rights. Those are exactly the gaps option A closes, minus the tools.
