# To validate on a computer

What the roadmap loop could not check in its cloud container (no GPU, no
H.264 in its Chromium, no access to the model hub, no phone), gathered as it
goes. Each line names the box it comes from and how to check it. Nothing here
blocked a box; the loop listed it and went on.

## Before anything

```
git checkout feat/roadmap-loop
npm ci
npm run typecheck && npm test
```

The tests the loop ran passed in the container (with the GTK and WebKit
development libraries installed for the desktop storage test).

## Performance

- **Step 1 — reference figures.** On a machine with a real GPU and Chrome:
  `npm run tramme -- load --json bench-before.json`. The figures in
  `docs/performance-roadmap.md` (step 1) come from a container without a GPU,
  where reading the pixels back weighs on every case and the `effects` case
  takes 40 s a frame; replace them with yours.
- **Step 1 — the 4K cases in H.264.** The load cases make their 4K source in
  VP9 because the container's Chromium has no H.264. With Chrome, an H.264
  source is the usual case: try `video4k` with a phone's MP4 in its place
  (`<out>/video4k/media/source-4k.webm` replaced by your file under the same
  name) and see whether the figures move.
- **Step 5 — the crossfade in the preview.** Open the `crossfade4k` case
  (`tramme load crossfade4k --frames 1 --out ~/tramme-load`, then the folder
  `~/tramme-load/crossfade4k` in the editor) and play it: it should hold
  30 fps where `develop` stuttered. In the container, waiting for video went
  from 359 to 84 ms a frame on export.
- **Step 5 — one asset per file.** In the editor: import the same video twice
  from the assets panel (a toast says it is already there, one file in the
  project); attach the same picture twice to the assistant; make a new project
  from a folder holding a file and its copy (one asset). A video over 64 MB is
  hashed by slices: check that importing a long video stays quick.

## Editing

The container could not reach the model hub (huggingface.co was refused by
its network policy) and has no GPU: no model was downloaded or run there.

- **Step 1 — the Models section.** Settings → Models, in English and in
  French: five rows (two for the cut-out), each with its default; choose
  another and run its tool (cut-out on a short clip, `detect` or `track`,
  `depth` on a photo, a transcription).
- **Step 1 — the catalogue, model by model.** For each model in
  `apps/editor/src/models.ts` not marked `checked`: the repository and file
  exist (`BritishWerewolf/U-2-Net`, `BritishWerewolf/IS-Net`,
  `Xenova/yolos-small`, `Xenova/detr-resnet-50`,
  `Xenova/depth-anything-small-hf`, `onnx-community/depth-anything-v2-base`,
  `Xenova/whisper-base`, `Xenova/whisper-tiny`,
  `onnx-community/whisper-large-v3-turbo`), its licence on the model card
  matches the catalogue, its size is about the one written (`mb`), and the tool
  gives a right result with it. Set `checked: true` for the ones that pass,
  remove the others. The IS-Net adapter (1024 px, mean 0.5, deviation 1, the
  output stretched from its range) is the one to watch.
- **Step 1 — the default cut-out's size.** The catalogue says about 168 MB for
  U²-Net human segmentation (the full U²-Net network); the former comment in
  `cutout.ts` said 4.6 MB for both. The cache listing of the next box shows the
  real figure.
- **Step 1 — a model hub id.** Settings → Models → Other models: type a
  detection model (`Xenova/detr-resnet-101`, say) and Try and use; it should
  download, answer, and become the row's choice. A wrong id should say why.
- **Step 1 — downloads and the cache.** Settings → Models: Download now on a
  row (the percentage moves, then "In this browser" with its weight); run its
  tool, nothing downloads again; Delete, the row says "Not downloaded"; pick
  another model, the former one shows under "In this browser" with Delete.
  Checked in the container with fake files put in the cache, never with a
  real download.
- **Step 1 — transcription by every path.** With the companion running
  (`npm run tramme -- agent`), choose Whisper base in Settings → Models and
  transcribe a clip: the companion's log should load `Xenova/whisper-base`;
  with `TRAMME_WHISPER_MODEL` set, that one instead. Then, in the desktop app
  or `npm run dev:personal` without a companion and without a server route,
  transcribe again: the progress says "in this browser" and the words come.
- **Step 1 — what made an asset.** After a cut-out, a depth, a track of a
  named object and a transcription, open `document.tramme.json`: each new
  asset has `madeBy` (the cut-out of a person: the matte and the detector).
  Change the model in the settings: the asset and its render stay as they
  were until the tool runs again.
- **Step 2 — a speed ramp, seen.** A video layer with rate keyframes 1 →
  0.3 → 1 over two seconds: the preview slows and speeds up smoothly; an MP4
  export (`tramme render`) shows the same frames (`tramme still` at a few times
  against the preview); a callout made by `track` on that video stays on its
  subject through the ramp; captions with `follow` on the video stay on the
  words. Rate 0 freezes; a negative rate plays backwards and stops at the
  file's first frame.
- **Step 2 — the sound on a ramp.** Play the ramped video with its sound in
  the preview: the voice slows and drops with the picture, without a gap; an
  MP4 export sounds the same. A video at a fixed 0.5 speed now sounds lower in
  the preview as in the export (the browser used to keep its pitch).
- **Step 2 — the speed presets.** Select a video layer, open Curves: the
  Speed row writes each preset around the playhead (checked in the container
  on a layer without a real file); play each one and judge its feel.
- **Step 3 — transitions, on footage.** `CHROME_PATH=… npx vitest run
  packages/cli/test/transitions.test.ts` renders every kind (it ran in the
  container with Chromium's software GL). Then on two real clips that overlap:
  each kind in the preview and an export, and the glitch, whose rows only show
  on a picture with detail.
- **Step 3 — the sound of a transition.** Two clips with speech or music
  joined by a crossfade: the level holds through the window (no dip, no
  bump), the outgoing sound is gone after it; with Sound crossfade off, both
  play as they are.
- **Step 3 — a transition from the timeline.** Two video clips cut end to
  end: the second clip's menu → Transition from the shot before… → Push: the
  clips overlap around the cut, the band shows; drag its edge, the overlap
  follows. A clip that starts at the very beginning of its file, against a
  first one at the very end of its own: the toast says how much is missing.
  (Checked in the container on two shapes, without video files.)
- **Step 4 — the key on real footage.** A green-screen clip with
  `fx.key`: the screen gone in the matte view with the default tolerance or a
  little more; hair keeps its strands, spill takes the green off them; choke
  for a hard edge. Its rendered test ran in the container on drawn shapes.
- **Step 4 — the dropper.** On a keyed clip, the target button beside Key
  colour, then a click on the screen in the viewport: the colour is the
  screen's (the key is off while picking); Escape cancels. Try it on a
  phone too (a tap).
- **Step 5 — masks.** Inspector → Masks → + on a video layer: a rectangle
  over it; change mode, feather, expansion, invert, add a second one in
  subtract, and see the picture follow; an export shows the same.
- **Step 5 — masks in the viewport.** Select a masked layer: its masks'
  vertices show; drag one, Alt+click the outline to add one, Delete removes
  the selected one; with two masks, Delete takes from the one clicked.
- **History.** Commit `f466b6a` alone does not typecheck (a label declared
  twice); `ef9f34f`, right after it, fixes it. Every other commit passed the
  checks before it was pushed.
- **Step 5 — a mask on a tracked object.** Track a moving object (track
  tool), draw a mask around it at a moment it shows, then Follow a track on
  the mask: it stays on the object as it moves. A rotated layer drifts (only
  its scale is counted).
- **Step 6 — a real LUT.** Import a camera's log-to-Rec.709 `.cube` (33³ or
  65³) and a look LUT; `fx.lut` on log footage at strength 1: the picture
  looks like the camera's own conversion. In the desktop app too (`.cube`
  added to its store's allowed files).
- **Step 6 — curves.** An adjustment layer with `fx.curves`: drag the
  master curve's points (a contrast S), add one, double-click to remove it;
  pull the blue curve down for a warm cast. On a phone, the square takes a
  finger (its points are small).
- **Step 6 — wheels.** An adjustment layer with `fx.wheels`: the gain toward
  orange warms the highlights, the lift toward teal cools the shadows (the
  classic look); double-click a wheel to reset it. Judge the strength of the
  wheels against a colourist's tool (lift ×0.25, gamma and gain ×0.5 per unit).
- **Step 6 — scopes.** Select a layer with a grading effect: the waveform and
  the vectorscope show in the viewport's corner and follow the grade and the
  time; on a phone they shrink. Compare with a known colour chart (skin tones
  on the vectorscope's skin line, between red and yellow).
- **Step 7 — stabilisation on real footage.** A handheld phone clip: run
  `stabilize` (the / menu or the assistant), then play it: the shake gone, a
  pan kept, no breathing zoom; `lock` on a tripod-like shot; a clip with a
  cut in it does not drift across the cut. Measured in the container on a
  synthetic shake only.
## Editing, steps 7 to 9

- **Step 8 — proxies.** Import a 4K or 60 fps phone video in the assets
  panel on a modest computer: the question comes (and not for a 1080p file
  on a fast one); make the proxy, the preview plays smoothly; Settings →
  Preview → Play proxies off: the original plays again; an export uses the
  original (its size and sharpness).
- **Step 9 — voices, heard.** A voice-over with each voice (pitch ±5
  semitones, robot, telephone, radio, megaphone, echo) in the preview and in
  an MP4 export: the same sound; a speech clip at 0.7× with Keep the pitch:
  slow but at its pitch. Listen for the shifter's grain on deep voices.

## Components, step 1

- **Instances in the editor.** Open a project with a component (a
  composition with `params`) held by a few comp layers with different
  `params` and `overrides` (written by hand or by the assistant): the
  preview, a still and an MP4 export show each instance with its values;
  change the component (its plate colour, a layer's keyframes): every
  instance follows, except what one overrides. The inspector has no
  parameter fields yet (step 5); it shows the comp node's own props.
- **Detach.** Only in `@tramme/core` for now (`detachPlan`; the tool and the
  button come with steps 4 and 5). Rendered identical to the instance in
  Chrome at four times, within 2 levels; check on a device's GPU path too.
- **Styles.** A document with `styles` (a look, a keyframed entrance) applied
  to layers with `at`: they animate from `at`. The inspector shows the
  layer's own values, not the style's (step 5 marks them).

## Components, step 2

- **A distribution in the editor.** A comp layer with `distribute` (a grid
  of 40 cards, the palette in order, a title from `index`): the preview
  plays it smoothly enough on a laptop (each instance is a composition read
  per frame; the Evaluator for many instances is Performance step 3), the
  selection box takes all the instances, an export matches the preview.
- **Rows of data.** A JSON asset of rows (an array of objects) imported, a
  distribution with `rows` and `row.name` in a rule: one card per row.
- **Not yet:** detaching a distribution (refused, `distributed`), editing
  the layout in the inspector (step 5).

## Components, step 3

- **The time field, seen.** On a grid of 40 cards (a distribution with
  `time: { mode: 'distance', amount: 0.8 }`): a ripple from the centre in the
  preview and an export; `noise` with `speed` 0.3 looks liquid, not
  jittery; animate the seed in the inspector (the parameter shows
  Animated): no frame jumps. Judge the amounts the assistant notes (0.3 to
  1.2 s across the field) on real briefs.
- **The modifier block in the inspector.** Add Time field to a property:
  the By segments (Rank, Direction, Distance, Noise), the Loop toggle and
  the Centre fields show in EN and FR.

## Components, step 4

- **The bench brief.** Ask the assistant for "a grid of forty product cards
  in the palette entering as a wave from the centre": it should write one
  card, `define_component`, then one `instantiate` with a grid, a palette
  rule and a time field. Compare the tokens written with a run before this
  branch (the roadmap's done-when); the bench needs a model key, not run
  here.
- **The / menu.** Make a component, Place a component, Detach an instance:
  their forms (JSON fields for parameters, rules and the time field are
  plain text there), in EN and FR.
- **Dressings as instances.** apply_template "keyword" twice, "title",
  "lower-third": the timeline shows one comp layer each, the look in a
  `tpl-…` composition; the keyword's wiggle now runs in the instance's own
  time (its phase differs from before, by design). A keyword cannot be
  detached (its wiggle reads the time); a lower third can.
- **The Repeated elements check** on an old project with copied cards.

## Components, step 5

- **The inspector.** Select an instance: Instance of …, its parameters as
  properties (keyframe one, link one), its overrides listed (remove one);
  the open and detach buttons. In a composition, a property's ⋯ menu →
  Expose as a parameter; the composition's Parameters section lists them
  with their instances' count. Seen in screenshots here (EN and FR); try
  it by hand on a phone (the menu on a long press).
- **The library.** Compositions list → a component's menu → Keep in the
  library (desktop app, CLI server and personal deployment each store it as
  `component-<name>.js` beside the plugins); in another project,
  `/component-use` lists and brings it in. Not run against a real library
  server here (the tools are unit-tested on packing and unpacking only).
- **Not done:** the volume view (the roadmap's "later").

## Performance, step 3

- **The frame budget on a real machine.** `tramme load instances` on a
  laptop with a GPU: here (software GL) the frame is 349 ms, of which
  readback 252 ms (the software GPU), draw 38 ms (the 400 nested
  evaluations, about 12 ms, and the Canvas 2D of 1200 shapes). The
  done-when is the editor's preview: open a project with a 400-instance
  distribution and a time field (the `instances` case's document, written by
  `tramme load --out`), play it, read the frame time in the preview's
  stats; it should hold 30 fps on a laptop.
- `node bench/evaluate-instances.ts` prints the evaluation alone (12 ms
  here, 29 before).
