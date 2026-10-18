# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Until 1.0.0, the document format and the APIs may still change between minor versions.

## [Unreleased]

## [0.7.1] - 2026-10-18

### Changed

- The studio's notes panel is resized like the atelier's panels: a handle between the film and the panel, from 330 to 640 px, remembered from one session to the next.
- The studio's note box grows to four lines, then scrolls; the film keeps the room of the box at its tallest, so writing neither shrinks it nor covers it.

### Fixed

- The model menu in the studio's notes panel was crushed to nothing: it keeps its room, its name shortens first, and on a narrow panel the route label (Companion) gives way instead of the buttons, the new conversation's included, being pushed out of the panel.

## [0.7.0] - 2026-10-18

### Added

- The studio, the default view of a project: the film in front, directed by notes. A note is written in the box under the picture, pinned to a moment or a place of the frame if needed, and the assistant answers with a take shown on the picture, kept or set aside. The storyboard below shows the scenes with their frames, the sound and the notes at their moment; a click on a scene puts the notes on it. The Direction panel holds the brief (subject, tone, rules), the look and the material of the film. The former layout stays as the atelier, one switch away in the top bar and the settings.
- The Transcribe button: on a sound or a video joined to a message, on the material of the film, in the assets, in a new "Speech" section of the inspector of sound and video layers, and in their menus. It reads the same state everywhere: to transcribe, under way, transcribed.
- The timeline's own menus on the right click. On a clip or its name: split at the playhead, trim the start or the end to the playhead, bring it to the playhead, then the layer's menu (the same as in the layer list). On an empty place or the ruler: the playhead or a marker there, end the composition there or at its content, add a layer, select all, the whole timeline in view. On a marker: go there, delete it. On a keyframe: go there, its curve.
- Guided tours "The tricks" (atelier: timeline zoom and lasso, snapping edges, cutting a video, the right click, scrubbing and arithmetic in fields, expressions and modifiers, the keyboard, export) and "Speech and transcription" (both views: where to transcribe, what the assistant does with the words). The editor tour's timeline step tells the new menus.
- The interface is bundled with its fonts (Geist and Geist Mono, OFL-1.1): it looks the same on every machine, offline included.
- A theme of previews in the settings: each of the five themes (studio, obsidienne, carbone, crépuscule, papier) is picked on a small picture drawn with its own colours, and "système" follows the computer's light or dark setting; papier joins the site's light palette.
- The lists of choices (a project's format, the frame rate, a property's choices) open the editor's own menu: a line of detail can sit under a choice, the chosen one carries a check, and the keyboard works through them (arrows, Enter, Escape, first letter). On a touchscreen the native list stays.
- A take announces itself with a clapperboard: a `clap` icon on its pill and its card, "Prise N" in the theme's accent.

### Changed

- The landing page follows the app: the studio first ("Motion design, directed in words", a new Studio section with its notes, takes and direction), then the atelier with its timeline menus; new pictures of both views in the paper and studio themes; the site's colours are the editor's paper and studio tokens; its words are a motion designer's (keyframes, curves, wiggle and loop, a style named once; the JSON and the terminal are links for the curious, no longer the pitch); sections are surfaces on the ground with gutters instead of hairlines, the top bar a floating pill, and the glows are gone. What the page loads is unchanged but for the studio's picture, lazy.
- Nothing is transcribed on its own any more: not a project made from a video or from sources, not a file joined to a message. The user starts it with the Transcribe button; when the assistant needs the words of a media not transcribed yet, it asks first in the conversation (a turn left alone never asks, and works without them). The project's first greetings say so.
- Dragging the left edge of a sound or a composition cuts its head off like a video's: what follows stays in place (its start in the file carried, at its rate or speed).
- The browser's menu no longer opens on the timeline, the transport, the curves or the storyboard (it stays in text fields), and a right press on the ruler no longer moves the playhead.
- One art direction for the whole application, built only on the theme's tokens (the reference board is `docs/design/board.html`): Geist everywhere (13 px base, Geist Mono for timecodes and values), text buttons as pills, icon buttons as 8 px rounded squares, fields without borders that take a 2 px accent ring on focus, panels and cards as 14 px surfaces set on the background and separated by 8 px gutters instead of seams, dialogs at 20 px over a blurred scrim. No colour is written outside the theme files any more; the playhead, the selection and the focus are the accent's, never a red of their own.
- The studio is dressed like the rest: the violet of the assistant, its gradients, halos and sparks are gone. Tramme at work is its mark breathing and a 2 px accent ring around the picture; the notes' numbers, the pins and the stage tags are the theme's accent; the storyboard's sounds are drawn (music neutral, voice accented, effects as ticks, heroes warm); the playhead is the same line in the studio, the storyboard and the timeline.
- The atelier is panels on a background: the left panel, the viewport, the bottom and the inspector are rounded surfaces in gutters, and the resizers hide in the gutters (an accent line while dragged). The viewport's toolbar and banners float as pills over the picture; the transport reads its time in mono; the timeline's clips keep their layer's colour and the chosen one takes an accent ring; the curves sit on a soft surface with their presets in a floating pill. On a phone, the tabs float in a pill above the safe area.
- The assistant speaks in one thread in both views: the notes with their number, the work as stages (its steps one click away) and the takes as cards, in the studio's side panel and in the atelier's assistant alike — the bubbles are gone.
- The settings' rows are grouped in cards, one section at a time under its title; the navigation reads as rounded lines. The guided tours follow the new shapes, and every `data-tour` marker stands where it was.
- The home screen's cards show each film at its own aspect ratio on the picture's stage colour: a vertical film no longer leaves empty bands beside its preview, and the examples follow.

### Fixed

- A field focused by the keyboard showed a doubled outline: the global focus ring painted on the field's inner input as well as on the field itself. Text controls now answer with their container's ring alone, and sliders and colour swatches keep a thin one.
- The projects' thumbnails left see-through bands (a checkerboard) beside vertical films: the thumb now takes the film's aspect from its manifest.

## [0.6.0] - 2026-10-11

### Added

- Markdown documents (`.md`, `.markdown`) come in with the sources now: dropped on the home screen, chosen with "From sources (files)" or a whole repository folder, or joined to a message. The assistant reads them whole with the sources tool (a long one continues with `read_file`), the way it reads a PDF page by page; a folder's `README.md` alone is enough to open a project from its sources.

### Changed

- The local companion runs the Antigravity CLI (`agy`, a Google login) in place of the Gemini CLI, which Google retired for personal accounts on June 18, 2026. The model menu offers it as "Antigravity", with the models it lists for the login (`agy models`: Gemini 3.1 Pro, Gemini Flash, Claude…), apart from the Gemini models of an API key; its default model takes an effort level. It runs with a home of its own under `~/.tramme/engines/antigravity`, so the user's plugins, skills and MCP servers stay out; it gets tramme's tools, and of its own only the reading of the images joined to the message. A model chosen for the Gemini CLI becomes Antigravity's default.

## [0.5.0] - 2026-10-11

### Added

- Importing a `.tramme` project that carries code — plugins, or expressions — now asks first, listing what it would run (the plugins with their file and size, the expressions with where they are). Nothing runs before the yes, and a refusal writes nothing. The shipped examples skip the question.
- With a finger, a long press opens the same menus as a right click: a keyframe's curve and delete, the layers, the compositions, the assets, the tokens and the project cards. A press held still never moves a key or a layer.
- Dragging over the timeline's tracks or the curve editor's background draws a lasso that selects the keyframes it covers, across layers and properties. Shift adds to the selection, Ctrl/Cmd flips it, and a selected group moves in one undo entry. With a finger the drag still scrolls.
- A path's vertices and tangents are manipulable in the viewport, for any node that declares a `path` property: drag a vertex (its tangents follow), drag a tangent with Shift held to keep the two mirrored, Alt+click the stroke to add a vertex, Delete to remove the selected one. An animated path gets a keyframe at the current time. The anchor cross drags too: the layer stays put on screen (the position compensates), Alt moves the anchor alone, and an animated or driven transform refuses with an explanation.
- An onion skin for drawn animation: with a sequence layer selected, the toolbar's onion button shows the previous drawing in red and the next in green over the picture, following the playhead at rest (hidden while playing or dragging). Never part of the document or the exports.
- Shorts: the title of each short lands with its first sentence (not at a fixed 0.2 s), each passage of the plan takes a strong word (keyword) that pops on screen the moment it is said — a word never said comes back in the answer — and a project with a brand (the plate and ink tokens) gets its progress bar and end card, the card lengthening the short. The build answers with a contact sheet of the shorts, a one-line check summary per short, and the export panel offers all the shorts at once, exported one by one, named after their titles and kept in renders/.
- A three-band equaliser on every sound (Sound layers and the sound of videos): `eqLow` (shelf at 120 Hz), `eqMid` (bell around `eqMidFreq`, 200 Hz to 8 kHz) and `eqHigh` (shelf at 8 kHz), in dB. A band left at 0 builds no filter, so an untouched mix sounds exactly as before.

### Changed

- The home screen's header is one door: a single New project button opens every way to start — blank project, a video, sources from files or from a folder, a `.tramme` or Lottie file. Dropping a file on the page opens it as before.

### Fixed

- The curve editor drew no curves: the path was built with a `W` where an `L` was meant, so keys and handles were there but the line between them never appeared. The background's click and lasso also stop being eaten by the grid and the curves themselves.

## [0.4.0] - 2026-10-10

### Added

- Sound that follows the picture: cues read from the animation's own timing (cuts, moves at their fastest, landings, appearances, about one hero in four seconds), placed on with `on: heroes, cuts, moves, lands, appears`; a hero stacked from several sounds (`sound: "a+b"`) with the music stopping before it and thinning out into it; `sound-find` brings CC0 recordings from Freesound (through Openverse), judged automatically, into your library with their credit; `mix` balances each effect against the music and voice band by band; `credits` writes where each sound comes from. The sounds placed go in a `Sound` group.
- Every export is mastered: a composition's `sound` settings bring it to a loudness (-14 LUFS by default, BS.1770) with its true peak under -1 dBTP, and give its effects one shared room. Audio layers say their `role` (effect, music, voice, ambience), `weight` (support, hero) and what they underline. The preview plays the same master.
- The check measures the mix: the master's loudness and peak, each effect on its cue and heard over the bed, the music under the voice, unplanned dips and silences; it shows a picture of the mix and lists moments to check by ear.
- ElevenLabs voice-overs with Eleven v4 by default, and v4 Turbo, v3, Multilingual v2 or Flash in the Sound settings; the style of a voice-over (an accent included) becomes an audio tag on v4 and v3. Music with `music_v2_5`. A voice picker in the Sound settings and a `voices` tool list the account's voices and the shared library's, filtered by language and accent.
- Fold or unfold every group at once (layers and timeline, one state for both; Alt+click folds a whole branch), and find a layer by its name.
- Several clips selected in the timeline (Ctrl+click, Shift+click, a band drawn in an empty part, Ctrl+A) move together; moved edges snap to the playhead, the markers and the other clips (Shift held: free).
- Waveforms in the sound clips of the timeline, and a solo button that plays one sound alone in the preview.

### Changed

- When the assistant applies its changes by itself, it no longer stops on a question: paid generations count against an allowance per turn (Sound settings), and it decides what a sensible choice answers instead of asking. A question asked during a turn shows in the conversation, and the user is told when away.

### Fixed

- The eye of a hidden layer and the clip badge keep their columns in the layer tree.

## [0.3.0] - 2026-10-10

### Added

- "From sources" takes a whole folder, chosen or dropped, its subfolders walked through. A kit among the files (a `brief.json` of kind `tramme-kit`, as an agent writes it from a project's repository) sets the project up: its name, its colours and curves as tokens, the fonts it names as font assets, its brief; the whole kit stays at `assets/sources/kit.json`, its paths pointing at the files as imported, and the assistant reads it first.

### Fixed

- An SVG with a viewBox and no size of its own (most logos) no longer stops the preview and the renders: it is drawn in its viewBox's proportions, 2048 px on its longest side.

## [0.2.0] - 2026-10-09

### Added

- The local companion runs Codex (a ChatGPT login) and the Gemini CLI (a Google login) besides Claude Code: it finds them on the computer, the model menu offers them ("ChatGPT (Codex)", "Gemini CLI"), and they reach tramme's tools as an MCP server held for the turn, with no shell, files or web of their own. Each keeps its session for the next message; switching agents midway hands the conversation over as text.
- The assistant's access puts the AI accounts first: with nothing connected, its panel offers to connect Claude, ChatGPT (OpenAI) or Gemini, and the local companion folds under it (never offered on a phone). When the chosen model cannot be reached but another AI is connected, its strongest model is taken and the user is told. The settings list the providers before the model and the companion.
- Projects from sources: "From sources" on the home screen (or several files dropped on it) brings documents (PDF), pictures, videos and sounds into a new project (`assets/sources/`). The `sources` tool lists them on a contact sheet and reads each one (a document's pages as text and pictures, a video's frames with what is said); the `/analyze` workflow reads them all, writes what it learned in the brief (`about`, `sources`) and proposes directions for the video before building. PDF documents join the project format and can be attached to a message. Tool contexts gain `files()` and `fileUrl(path)`.
- Personal mode, a public deployment without accounts (`npm run deploy:personal`, docs/deploy.md section 8): projects stay in each visitor's browser (IndexedDB, served by a service worker with the same routes as the Worker), keys in a key vault of another origin that the editor and the plugins cannot read, and the browser calls the providers itself (a relay that keeps nothing for those that refuse calls from a page). The server keeps nothing.
- `@tramme/api`: the storage and provider routes shared by the Worker, the service worker and the key vault, with a storage contract every bucket passes (R2, IndexedDB, memory).
- Example projects "Launch film" (45 s on the beat, nested compositions, a 2.5D camera, sound-reactive motion, music written as code) and "Showreel" (made by the assistant). "Hello", "Night sky" and "Road trip" leave the examples; the first two stay as test fixtures.

- Plugin tools: a project plugin can export `tools` that the assistant runs with `use_tool` (analyses, layouts, generators). A tool answers with text and images and may propose changes, which join the assistant's proposal.
- Notes for the assistant (`ai: { when, avoid, example }`) on nodes, effects, modifiers and tools; `list_nodes` and `tramme nodes` now list modifiers and tools too.
- Chat commands: typing `/` lists the tools and workflows (`/captions`, `/title`, `/keyword`, `/lower-third`, `/dress`, `/review`, and those of the project's plugins). A tool with its form filled runs at once, without a model; words after the command hand it to the assistant.
- Plugin workflows: a project plugin can export `prompts`, instructions for the assistant picked from the `/` menu.
- Quality checks: text too small, too brief or past the safe zone, overlapping text, text crossing an element, crowded entrances, still stretches. The `check` tool (assistant and `/check`) runs them and shows a contact sheet of the key moments; `motion` shows a strip of frames to judge a movement. Plugins add their own `checks`.
- Recipes: `kinetic-title`, `bar-chart`, `stat` and `transition` lay out whole animated pieces as editable layers; style kits (editorial, punchy, calm, neon) set the colours, curves and pace they follow. Plugins add their own `kits`.
- Perception tools: `beats` analyses music (tempo, beats, bars, sections, loudness per band), `shots` finds the cuts of a video, `subjects` finds the people in a video or an image (a small model run in the browser), `palette` turns the colours of a picture into tokens.
- Following the music: the `react` modifier and `audio()` in expressions make any property move with the beats, bars, hits or loudness of an analysed sound.
- Check `text-over-subject`: warns when text covers a face, once the people are known.
- Text behind the subject: the `cutout` tool (assistant and `/cutout`) cuts the person, or the main subject, out of a video layer with a small model run in the browser, saves the matte as a mask video timed like the file, and adds the same footage through that mask above the video. Titles placed between the two pass behind the person, in the preview and in every export.
- GPU effects: plugins write layer and finishing effects in GLSL; new built-in effects `fx.matte` (track matte from another layer), `fx.displace` (displacement map), `look.chromatic` (chromatic aberration), `look.grade` (colour grade in linear light). New property type `layer`.
- In the preview, a layer or effect that fails is drawn as a red frame and named in the error bar instead of blanking the whole picture.
- 2.5D camera: a composition can have a camera (pan, zoom, perspective, focus, depth blur) and layers a depth, for parallax and depth of field.
- Viewport handles declared by nodes (the rectangle's corner radius, plugin nodes' own points).
- Presets in the add menu: neon title, frosted card, light leak, spotlight; plugins add their own `presets`.
- Plugin nodes can say how they export to SVG and Lottie (`export.svg`, `export.lottie`).
- Plugin manifest (`meta` with the plugin API version, checked at load) and the `@tramme/plugin` package (types, `definePlugin()`).
- Plugin library shared by the projects: keep a project's plugin there and use it in another (`/library-add`, `/library-use`).
- Simulations: a node can carry a state from frame to frame (`simulate`), stepped deterministically with checkpoints; nodes read other layers with `host.layer()`. New `follow` node: a dot following a layer on a spring, with a trail.
- The assistant knows when each built-in node, effect and modifier fits (notes in `list_nodes`).
- Example project "Night sky": a project plugin with a node, a tool and a workflow.
- Plugins roadmap: `docs/plugins-roadmap.md`.
- Sound roadmap: `docs/sound-roadmap.md` (sound effects, ambiences and music made by the assistant in the editor).
- Sound library: 421 recorded sounds (Kenney's packs, CC0: impacts, interface, digital, jingles, sci-fi) measured and described in `sounds/catalog.json`, and 13 sounds written as code (whoosh, riser, sub boom, cinematic impact, glitch, sparkle…); your own sounds in a library shared by the projects (`/api/sounds`).
- Sound tools for the assistant and the `/` menu: `sfx` searches the library and places a sound on the moments the document names (entrances, exits, markers, cuts, beats, bars), its hit on the frame, its variants alternating; `synth` makes a sound from Web Audio code and answers with its waveform and measures; `duck` lowers music under a voice; `sound-keep` keeps a sound in the library; `generate-sound` has a provider make a sound effect, a music bed (ElevenLabs) or a voice-over (ElevenLabs, OpenAI, Gemini). The `/sound-design` workflow, and the assistant's guide for sound.
- The `generate-image` tool (assistant and `/generate-image`): a provider (OpenAI, Gemini, Z.AI) draws a picture the project lacks — a background a title reads over, a texture, an illustration, a prop — from its prompt, in the proportions of the composition; the file and what made it (`assets/images/<name>.image.json`: prompt, provider, model, proportions) join the project, the picture is proposed as an image layer (filling the frame or whole, over the whole composition or from a time, in the background on demand), and the tool answers with the picture so the assistant judges what was made. The keys stay in the Worker (`/api/generate-image`, `/api/config` lists the providers that draw); nothing is sent without the user's yes (the same setting as the paid sounds). The assistant's guide says when to have a picture made and why words never go in one (text layers say them).
- Generation roadmap: `docs/generation-roadmap.md` (pictures made by a provider, then takes, image to image, moving pictures, and what checks read in a picture).
- Motion figures: what the numbers of an animated property say (`packages/core/src/motion.ts`), sampled from the same evaluation the render uses — how far it travels, peak speed and when, evenness of the speed (1 is the linear tell), direction changes, how far it overshoots its end value, and when it settles. The `motion` tool answers with the figures of the span's biggest travels beside its strip of frames, so the assistant judges a movement with its numbers, not only the spacing. New checks that read them: `linear-travel` (a position or scale at constant speed for 0.3 s or more: ease it; a spring, a wiggle or any turn stays silent), `spring-settle` (a spring still moving when its layer leaves: more damping or more time; or overshooting its mark by more than 30%: one bounce is lively, more is nervous) and `twin-motion` (two layers whose positions follow the same series: offset, stagger or vary one). Motion roadmap: `docs/motion-roadmap.md`.
- Motion taste: the craft's rules, distilled from the public references of the field (the Animator's Survival Kit, Disney's twelve principles, the Material, Carbon and Apple motion systems, kinetic typography) and encoded where the engine acts on them. A "Motion" section in the assistant's guide: space before time (an even speed is the missing ease), entrances of 200 to 400 ms eased out and exits faster, one moving subject at a time with an uneven stagger, anticipation, arcs on the long travels, settles instead of hard stops, springs for what lands and curves for what intends, the reading time of text, and curves defined once as ease tokens (out, in, standard, emphasized, also named in `docs/document.md`). Three checks that read the figures: `abrupt-entrance` (the first move after a layer appears runs at full speed: ease it in), `straight-travel` (a big diagonal travel that keeps to its straight line: bend the move) and `uniform-stagger` (a group entering with even offsets: vary the gaps). The `/polish` workflow runs the whole loop on a composition: check and motion tools, the fixes the guide asks for, check again. The `bar-chart` recipe's fades now ease with the kit's curve. Taste roadmap and sources: `docs/taste-roadmap.md`.
- Motion sense everywhere the model looks: the notes per node family carry what each thing's movement should be (text moves as a block or word by word, a counter rolls with an ease out, a bar draws along its x, a path draws itself over 0.4 to 0.8 s, a callout follows without lag, captions pop on the spoken word, a group staggers its children, footage drifts or zooms slowly and never both); the style kits expose the four curves as tokens, `standard` and `emphasized` beside `enter` and `exit`, flavored per kit; and the `motion` tool reads the pixels of its frames (optical flow by block matching between two stills): it says when the whole frame moves and how fast in px/s, and points at the blocks that move against the rest — a background that should hold, something crossing the move.
- Themes: the interface colours become a list of themes, one palette chosen in the settings and kept in the browser: Studio (the former look), Obsidian (near-black, the chrome recedes into the room), Carbon (pure graphite, no blue in it), Dusk (a warm dark for the long sessions), Paper (the former light grey), and System (follows the computer). The meaning of colours stays across themes (selection, keyframes, expressions, links); the picker shows three swatches per theme, and an old preference migrates.
- Display modes: the same interface, laid out differently (top bar's expand button, or the settings). The editor stays the default; Cinema gives the film the whole window — the panels become floating glass cards summoned from the edges (layers, properties, the transport and the timeline as a bottom drawer); Conversation makes the assistant thread the main column, with the film beside it and the layers one edge away. A display change re-measures the stage.
- The `shorts` tool (assistant and `/shorts`): a long video as shorts, in two calls. First the candidates: the transcript grouped on pauses and sentence ends into passages that stand alone (15 to 45 s by default), each with its times and what is said. Then a plan of passages built into one composition per short: the video filling the asked format (vertical 1080×1920, square, horizontal) and starting at the passage's `start`, the transcript remapped to the short, saved as its own asset and captioned (the `captions` template), the title with its bar (the `title` template). Each short is an ordinary composition: editable, checked and exported like any other. The frame follows the speaker: `focus` on the video layer (the point of the picture kept at the centre of the frame, as the image layer had; animated, it follows the subject in a cropped frame), which the build animates across each short from the subjects analysis of the video when there is one — the biggest person of each analysed frame, held when nobody is found, drifts under 4 % of the picture ignored. The `/shorts` workflow, and the assistant's guide for shorts (a short stands alone, hooks in its first sentence, ends on a point). `transcriptIdOf` moved to `@tramme/core` with the rest of the transcript domain. Shorts roadmap: `docs/shorts-roadmap.md`.
- Sound layers: volume animatable (fades, ducking), `fadeIn`, `fadeOut`, `lowCut`, `highCut`, `reverb`, and `rate` (speed and pitch) on audio layers; the same but `rate` on the sound of videos.
- The `check` tool reads the mix: clipping, a mix far too loud or quiet, two sounds starting together.
- Sound settings (Settings, Sound): the preview's volume and mute (the exports keep the mix), the level of effects and music beds the tools place, how much a music drops under a voice, varying repeated sounds, asking before a paid sound (a dialog; nothing is sent to the provider without a yes), the provider and voice for voice-overs, and your sound library (listen, delete).
- Guided tour "Give the video its sound" (help menu): the library, asking the assistant, the `/` sound tools, sound layers and their properties, checking the mix, exporting with the sound.
- Assistant effort levels, chosen for each model next to the model menu and in the settings: Claude Opus and Sonnet (low to max, `high` by default, where Opus 5.5 alone would run at `medium`), and the reasoning models of the other providers (OpenAI o-series and GPT-5, Gemini 2.5 and later, OpenRouter models that reason, gpt-oss on a local server: low, medium, high, or the model's own default). A model that refuses its level runs at its own.
- The assistant tells you when it is done (Settings, Assistant): a notification from the system when the editor is in the background, a message in the editor after a long task.
- Automatic application of the assistant's changes (Settings, Assistant), turned on after a confirmation: a proposal is applied as soon as the turn is over, still checked first, shown in the conversation and undone with Ctrl+Z.
- Event lists: a JSON asset of timed events (`{ id, t, label, detail?, values, set? }`) that keep running totals: changes that add up (money in any currency, laughs, points, kilometres) or values an event sets (a weight, a temperature). Written by the `events` tool (assistant and `/events`) from lines such as `3.1 Petrol cash -18 | full tank` or `9 Weigh-in weight =72.5`, and totals written as they should look: `Cash: £23.67`, `0,00 €`, `Days: 0 day|0 days`, `Time: 0:00`. Expressions read it with `events()` (`.total()`, `.text()`, `.since()`, `.pulse()`, `.last()`…). `event-counter` puts the running totals in a corner, counters that roll at each change; `event-tags` a tag at each event (`PETROL −£18.00`, or the total it leaves; new `events.tag` node); `event-receipt` every event on a receipt typed line by line, then its totals (new `events.receipt` node). Every one of these layers reads the list as it renders: save the list again and they all follow. Example project "Road trip".
- Counters: `direction`, `down` rolls the digits back, for a value that goes down.
- Tracked callouts: the `track` tool (assistant and `/track`) follows something filmed through a video, framed by a rectangle drawn over it, a region of the picture or its name (person, car, dog… found by the detector), and saves where it is over time (`track-<video>-<name>`); a cut ends the track. The `callout` tool puts brackets and a label on it (new `callout` node) that stay on it, even when the video layer is moved or retimed. Expressions read where it is with `track(layer, name?)`.

### Changed

- The project format (still `tramme-project/1`) admits PDF documents under `assets/`. Every project of 0.1.0 opens as before; a project holding a PDF (made from sources, or with a document attached to the assistant) does not open in 0.1.0.
- Tool contexts gain `files()` and `fileUrl(path)`: plugin tools may use them; a host that builds tool contexts itself must provide them.
- Switched project license from MIT to Apache-2.0.
- Provider keys are connected in the editor, under Settings, Providers: Connect, Change key, Disconnect for Anthropic, OpenAI, Gemini, OpenRouter, Z.AI and ElevenLabs. The Worker keeps them in R2 and never sends them back; Cloudflare secrets still work, a key connected in the settings comes first.
- Custom providers: any service of the OpenAI chat format (DeepSeek, Groq, Mistral…) added by name, base URL and key; its models show in the model menu (`custom:<id>:model`).
- Settings in sections: a menu on the left (Editor: Appearance, Preview, Guided tours; Assistant: Model, Providers, Behavior, Connection) with a search that finds a setting whatever its section, the chosen section on the right; on a phone, the sections as tabs.
- The assistant's conversation with Claude is append-only: nothing already sent is rewritten, so the prompt cache stays warm and Claude's thinking stays valid. Old tool results are cleared by the API (context editing) once the conversation grows; the system prompt is cached for an hour.
- Lighter tool answers: `list_nodes` gives an index (properties as `name:type=default`, notes, tool inputs) and the full entries on demand (`types`), about 60% fewer tokens; `get_document` reads one part with `path`; `read_file` reads long files in parts (`offset`).
- Longer answers (64k tokens) on the server path; a request Claude declines goes to another model on the server (`fallbacks`), and the user is told when it is declined anyway.
- One mixer for the preview, the browser exports and the command line (`@tramme/render`): the command line mixes in its page and hands ffmpeg the finished track, instead of its own ffmpeg filter graphs.

### Fixed

- Expressions that read an analysis (`audio()`) or an event list (`events()`) now have their values in the inspector, the curves, the viewport's boxes and the assistant's `evaluate`, instead of neutral ones.
- On phones, the assistant's message box no longer slips under the tab bar when the conversation is long.
- Counters: separators and units (`,` `%` `€`) take their own width instead of a digit's.
- MP4 export: the H.264 configuration (avcC) is written from the stream itself. The one some encoders give (Media Foundation under Windows) was malformed, so Windows, QuickTime and phones refused the file ("format not supported") while Chrome and VLC played it.
- Assistant, server path: stopping during several tool calls no longer breaks the next message; a tool call whose input is invalid or cut off is no longer run with an empty input (the model is told and calls again); inputs are checked against each tool's schema on every path.
- Assistant, server path: a request part the API refuses (thinking display, context editing, effort…) is dropped on its own instead of turning off the thinking summary; retries wait as long as the server asks (`retry-after`).
- Assistant: a server that does not answer, or an answer whose stream breaks before anything was shown, is tried again by itself (twice) instead of ending the turn.
- 2.5D camera: a nested composition is drawn through its own camera (parallax and depth of field); it was ignored everywhere but in the root composition.
- Check `stillness`: a nested composition counts as playing, as a video does, instead of making its parent look frozen; its own still stretches are found when it is checked.
- Counters: digits share one cell again, as wide as the widest digit (the test looked for the letter "d", so each digit took its own width and the number shifted as it rolled); the `stat` and `bar-chart` recipes measure them the same way.
- `tramme pack` and `tramme unpack` check a project with its own plugins loaded, as the editor's import does; a project using plugin nodes (the night-sky example) was refused with "unknown node type".

## [0.1.0] - 2026-10-02

First public release.

### Engine

- JSON document as the source of truth: nested compositions, layers, groups, assets, design tokens, markers and sound. Format `tramme/1`, described in `docs/document.md`, with a JSON schema in `schema/tramme-1.schema.json`.
- Deterministic rendering: every frame is a pure function of time.
- Every property can be static, keyframed, an expression or a link, with an optional modifier stack (wiggle, loop, spring, offset, variation, smoothing).
- Open vocabulary: each layer type is a node that declares its property schema. The inspector and the validator are generated from it.
- Native nodes: shapes, path, image, text, counter, group, composition, particles, GLSL shader, code, sound, image sequence, video, captions.
- Layer effects: blur, shadow, glow, color, tint.
- Canvas2D layer renderer and WebGL2 compositor (motion blur, linear color, finishing).
- Project plugins: projects can add their own nodes, effects and modifiers as JS modules.

### Projects

- Project format `tramme-project/1` (manifest, allowed paths, checks), exchanged as `.tramme` archives. Projects created under the former names ("trame", "emotion") are still read.

### Editor

- Projects home: recent projects with thumbnails, new project (formats, frame rate, duration), project from a video, opening a `.tramme` file or a Lottie animation, examples.
- Viewport with zoom, pan, safe zones, grid, and direct manipulation (move, scale, rotate).
- Timeline (layer bars, keyframes, markers), Bézier curve editor, inspector generated from the schemas.
- Undo and redo for every change, autosave with conflict detection across tabs.
- Hand-drawn animation: image sequences held on twos or driven by an exposure sheet.
- Video layers decoded frame by frame with WebCodecs, speech transcription to timed captions.
- In-browser export: MP4 (H.264), WebM (VP9 with alpha), GIF, PNG sequence, Lottie, SVG still, WAV.
- Guided tours, settings (theme, preview quality), English and French interface.
- Mobile and touch support: tabbed panels under 760 px, a compact header with a "more" menu, pinch to zoom and two-finger pan in the viewport, larger touch targets, installable as a web app.

### Assistant

- AI assistant that edits the document through the same operations as the editor: proposals are previewed, then applied or rejected, and can be undone.
- Claude through a local companion (`tramme agent`, Claude Agent SDK) or through the server with an API key.
- Other providers: OpenAI, Gemini and OpenRouter through the server, local models (Ollama, LM Studio) from the browser.
- Image, sound and video attachments; video dressing (cuts, captions, templates).

### Command line

- `tramme` CLI: validate, still frames, offline rendering (MP4, MOV ProRes 4444, WebM with alpha, GIF, PNG, WAV) with headless Chrome and ffmpeg, Lottie and SVG export, Lottie import, pack and unpack, comparisons and benchmarks.

### Deployment

- Cloudflare Worker serving the editor and the API, projects stored in R2, access protected by Cloudflare Access.

[Unreleased]: ../../compare/v0.7.1...HEAD
[0.7.1]: ../../compare/v0.7.0...v0.7.1
[0.7.0]: ../../compare/v0.6.0...v0.7.0
[0.6.0]: ../../compare/v0.5.0...v0.6.0
[0.5.0]: ../../compare/v0.4.0...v0.5.0
[0.4.0]: ../../compare/v0.3.0...v0.4.0
[0.3.0]: ../../compare/v0.2.0...v0.3.0
[0.2.0]: ../../compare/v0.1.0...v0.2.0
[0.1.0]: ../../releases/tag/v0.1.0
