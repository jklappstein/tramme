# Performance roadmap

How tramme renders faster without leaving its stack: measure where a frame's time goes, export in parallel, prepare the Evaluator for documents with hundreds of instances, and move to WebGL or to Rust compiled to WebAssembly only what a measure points at. A rewrite in pure Rust is not the plan: the browser gives text shaping, Canvas 2D, WebCodecs and the JavaScript of expressions and plugins for free, the editor stays on the web anyway, and months of rewriting would stop the work that sets tramme apart. That choice is reopened only if the measures of step 1 show the JavaScript itself is the limit.

Status: not started. Tick the boxes as steps land, and keep this file as the reference instead of re-deciding the plan.

## Where things stand

- The export already converts to YUV on the GPU: `readPixels` hands back ffmpeg's rawvideo yuv420p (`packages/render/src/compositor.ts`), no conversion on the CPU.
- One frame is in flight on the WebSocket while the next renders (double buffer, `capture` in `packages/cli/src/page.ts`).
- The Evaluator caches static properties across frames (`packages/core/src/evaluate.ts`).
- The time per frame is measured, as a total only.
- One page renders every frame of an export in order (`packages/cli/src/jobs.ts`).

## Principles

- **Measure before changing.** Every step after the first states the figure it should move, and is checked against it.
- **Rendering stays a pure function of time.** It is what makes parallel export and caching safe; nothing here may break it.
- **Same pixels.** An optimisation is done when the export it produces is identical frame by frame to the one before it, or the difference is understood and accepted.
- **Rust where measured, through WebAssembly.** A hot spot moves to a module called from TypeScript, the same in the editor, the export and the worker; never a second implementation of the engine.

## Steps

### Step 1. Where a frame's time goes

- [ ] `capture` times each frame's parts apart: evaluation, drawing, GPU readback, waiting for the send. The breakdown is reported next to the existing `ms/image`.
- [ ] Load cases in `bench/`: many layers, blurs and effects, a 4K source video, a simulation (particles, cloth), and later a distribution of hundreds of instances.
- [ ] A command that runs them and prints the breakdown, so a change is compared before and after.

Done when: for each load case we can say whether the bottleneck is the JavaScript, the GPU, video decoding or the transfer.

### Step 2. Parallel export

- [ ] The film cut into N segments rendered by N pages of the same Chrome, each encoding its segment; the segments joined by ffmpeg without re-encoding (cuts on keyframes).
- [ ] N bounded by memory (each page opens its own video decoders) and by the GPU; a sensible default from the machine, overridable.
- [ ] Simulations started mid-film: check that `particles`, `cloth`, `rope` and `flock` give at frame k the same result whether rendering started at 0 or at k; fix those that keep state across frames.
- [ ] Sound mixed once over the whole film, not per segment.

Done when: an export with N pages is identical frame by frame to the sequential one, and faster by close to N on a multi-core machine for the load cases.

### Step 3. The Evaluator for many instances

- [ ] A per-frame cache of values by `(address, t)` for the calls through `base(t)`: `smooth` already makes 9 per value, `timeField` over hundreds of instances will make many more (`docs/components-roadmap.md`).
- [ ] The instances of a distribution evaluated in batches into typed arrays rather than object by object: the shape that suits a WebAssembly module if step 1 calls for one.

Done when: a distribution of several hundred instances with a time field stays within the frame budget of the editor's preview.

### Step 4. What the measures point at

- [ ] Layers costly in Canvas 2D (blurs, shadows, compositing) drawn through WebGL2, later WebGPU.
- [ ] Hot spots in Rust compiled to WebAssembly, only those step 1 shows: simulations, noise in bulk, sound analysis. One module, called from TypeScript, working in the editor, the export and the worker; native through Tauri on the desktop if it helps.

Done when: each move is justified by a figure from step 1 and improves it, with the same pixels.
