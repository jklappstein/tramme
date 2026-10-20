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
