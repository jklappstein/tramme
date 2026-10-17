# Films from a description (`@tramme/film`)

A whole video — a launch, an announcement, an ad, an explainer, a teaser — is
directed as a page of JSON and built by tramme: an idea, an art direction, and
scenes composed of elements in layouts. Every scene becomes a composition (its
ground, its elements entering in turn, its camera), played in order on the
music's beats, passing to the next the way it asks, with the direction's finish
over the whole film and its sound under it.

The craft lives in the package once: palettes derived from a brand, a catalogue
of typefaces with their voices, layouts that measure what they hold, text
treatments, cameras, passes between scenes, grounds, a finish, music and
effects. The assistant only directs — the concept, the structure, the art
direction, the words — so a 30 s film costs it a page of JSON rather than
hundreds of document operations, and a change is a line changed.

It is a method, not a template: nothing in the package is a fixed film. The
guide the model reads (`film-guide`) teaches how to direct (a concept of its
own, a structure among several, an art direction decided from the subject,
principles, clichés to avoid) and deals a **starting hand** drawn at random — a
structure, a mode, a voice of type, a motion, a pass, a motif, a ground — which
the model takes unless it fights the brief. The same brief asked twice starts
from two directions; the principles keep both good.

## Where it runs

- **Assistant**: `use_tool film-guide` (the method and the vocabulary,
  generated from the code), `use_tool film` with the description, then
  `use_tool film-review`, the check of a film: a contact sheet (a frame of
  each scene once it has settled, or the moments asked), the review's notes on
  the description, and the quality checks of the picture (inside the scenes)
  and of the sound, the small type of interface mockups counted rather than
  listed. A film is fixed through its description, never by editing the
  layers of its scenes: the next build replaces them. The
  description is kept in the project (`assets/film/film.json`, asset `film`);
  changing the film is changing it and running `film` again, which rebuilds the
  scenes it made. The `/film` workflow of the chat does the whole path from a
  brief.
- **Command line**: `tramme film film.json --out folder [--seed n]` writes a
  project folder (document, fonts, sound, the description) and prints the
  summary with the review's notes, ready for `tramme still` and
  `tramme render`.

The film is built into the root composition when it is empty or was made by
`film`; otherwise into a new composition `film`, which becomes the root. Its
scenes are the compositions `<film>-01`, `<film>-02`, … The same description and
seed always give the same document; another `seed` gives another take of it
(positions, angles, the grounds' shapes, the chords, key and figure of the
music). A description without a seed takes one from its title and concept: two
films differ, and a film whose scenes change keeps its little choices.

## The description

```json
{
  "title": "tramme · launch",
  "concept": "A prompt is typed, and a whole film answers it: the cursor is the director.",
  "format": "16:9",
  "seed": 8,
  "brand": { "name": "tramme", "colors": ["#2DD4BF", "#A3E635"], "url": "tramme.app" },
  "style": { "mode": "dark", "display": "Space Grotesk", "motion": "snappy", "background": "floor", "transition": "whip", "motif": "square", "texture": "film" },
  "music": { "bpm": 124, "mood": "drive" },
  "scenes": [
    { "beats": 8, "camera": "still", "elements": [{ "type": "text", "text": "make a launch film for halo", "treatment": "type", "size": "m" }] },
    { "layout": "poster", "beats": 4, "transition": "flash", "elements": [{ "type": "text", "text": "No timeline.", "treatment": "split" }] },
    { "layout": "poster", "flip": true, "beats": 4, "elements": [{ "type": "text", "text": "No keyframes.", "treatment": "split" }] },
    { "layout": "right", "beats": 10, "elements": [
      { "type": "text", "text": "Every frame stays editable", "emphasis": ["editable"], "treatment": "underline" },
      { "type": "list", "style": "checks", "items": ["Layers you can move", "Tokens for the brand", "Exports to MP4"] }
    ] },
    { "beats": 8, "elements": [{ "type": "logo", "tagline": "Describe the film. Get the film." }] }
  ]
}
```

| Key | Meaning |
|---|---|
| `concept` | the idea of the film in one sentence, its own; the review asks for it |
| `format` | `16:9` (1920×1080), `9:16` (1080×1920), `1:1`, `4:5`, or `[width, height]`; the composition's size by default |
| `seed` | another take of the same description |
| `brand` | `name`, `logo` (an image asset of the project), `colors` (#RRGGBB, the accent first), `font` and `textFont` (font assets), `url` |
| `style` | the art direction (below) |
| `music` | `bpm` (the scenes' beats are counted in it, 116 by default), `mood` (`drive`, `bright`, `calm`; from the style by default), `asset` (a sound of the project played under the film), `bed` (`false`: no music made), `effects` (`false`: no whooshes, hits, clicks) |
| `scenes` | in order; each `{ layout?, flip?, beats or seconds, camera?, bg?, transition?, elements: [...] }` |

A problem in the description is named with its place (`scenes[2].elements[0].value:
a string`, `style.motion "bouncy": one of …`), all of them at once, so the model
fixes its description in one go.

## The art direction

`style` is resolved by `style.ts` into the document's tokens (`plate`, `plate2`,
`ink`, `ink2`, `ink3`, `line`, `card`, `cardLine`, `accent`, `accent2`, `glow`,
`good`, `bad`, the curves `enter`, `exit`, `standard`, `emphasized`, `pop`, and
`pace`, `stagger` — the names the recipes read too) and everything the scenes
draw with. Every key is optional; a `preset` is a starting point under the
model's own choices.

| Key | Options |
|---|---|
| `mode` | `dark`, `light` |
| `palette` | any of `bg`, `surface`, `ink`, `muted`, `accent`, `accent2`; the rest is derived from the accent's hue, and the accents are darkened or lightened until they read on the ground |
| `scheme` | how the second accent comes from the first: `mono`, `analogous`, `duotone`, `complement`, `vivid` |
| `display`, `text` | faces of the catalogue (`fonts.ts`, SIL OFL; Inter and JetBrains Mono shipped in `fonts/`, the others fetched from google/fonts the first time a film uses them and copied into the project): Inter, Space Grotesk, Sora, Manrope, Bricolage Grotesque, Syne, Anton, Fraunces, Playfair Display, DM Serif Display, Instrument Serif (and JetBrains Mono for code) |
| `upper`, `scale` | headlines in capitals; `quiet`, `balanced`, `dramatic` |
| `motion` | `snappy`, `smooth`, `elastic`, `mechanical`, `dreamy`: curves, pace, stagger, blur, the default entrances and cameras |
| `texture` | `none`, `grain`, `paper`, `film` |
| `background` | the scenes' grounds (`backgrounds.ts`): `flat`, `light`, `glow`, `gradient`, `mesh`, `grid`, `dots`, `lines`, `shapes`, `floor`, `paper` |
| `corners` | `sharp`, `soft`, `round` |
| `transition` | the pass between scenes (below) |
| `motif` | the shape that comes back: `bars`, `circle`, `square`, `line`, `dot`, `frame`, `plus`, `logo` |
| `glow` | light that blooms (bloom, flares at the cuts) or a flat, graphic picture |

Presets: `midnight`, `daylight`, `paper`, `poster`, `studio`, `terminal`,
`soft`, `luxe`. They are offered as style kits in the editor too.

## Scenes and elements

A scene is one idea: up to six elements, entering in the order written, laid out
by `layouts.ts`, which measures each one, shrinks what is shown before the words
when room runs short, and keeps everything inside the frame through the
camera's move.

| Layout | |
|---|---|
| `center` | one column, words over what is shown |
| `left`, `right` | the words on one side, what is shown across (`flip` mirrors) |
| `split` | two halves |
| `poster` | a huge headline across the frame (a short one grows to fill it), a visual small in a corner |
| `grid` | a title above, several visuals in cells |
| `full` | the visual takes the frame, a small title over it |
| `corner` | the visual large, the words low in a corner |

Cameras (`scenes.ts`): `still`, `push`, `pull`, `drift`, `pan`, `rise`, `punch` —
chosen from the layout and the motion when the scene does not say.

Elements (`elements.ts`, fields in `spec.ts`): `text` (a headline, a kicker, a
body line, a caption, entering by a treatment: `mask`, `blur`, `fade`, `type`,
`letters`, `scale`, `swap` — the last word gives way to the `swap` words in
turn, like the drum of a slot machine, the last one staying — `highlight`,
`underline`, `split`), `figure`,
`chart` (`line`, `bars`, `candles`), `ui` (an interface from a description:
`row`, `stats`, `chart`, `input`, `button`, `toast`, `tabs`, `progress`, `chat`,
`text`), `device` (`phone`, `browser`, `window`), `code`, `logo`, `list`
(`steps`, `checks`, `numbers`, `bullets`), `cards`, `quote`, `button`, `image`,
`motif` (`burst`, `frames`, `orbit`, `trail`, `field`). Icons: the set in
`icons.ts`. No text a film sets to be read is smaller than 3.1 % of the
frame's short side (`MIN_TYPE` in `text.ts`), the size the readability check
asks for on a phone; interfaces are drawn larger than life for the same reason.

## Passes

How a scene passes to the next (`compile.ts`), on the comp layers of the film:
`cut` (on the beat), `push` (forward through a blur), `slide`, `whip`, `zoom`
(through the scene into the next), `dissolve` and `iris` (both scenes play
together: a scene's composition runs a little longer than its place), `wipe` (a
band of the accents covers the cut), `motif` (the motif, large, sweeps across),
`flash` (a hard cut with a flash of light). The fast ones get motion blur and a
whoosh; layers a pass adds are named `pass-…`.

## Sound

A film comes with its sound, made in plain JavaScript by `music.ts` (the same
bytes in the editor and on the command line):

- **a music bed** in the film's tempo and mood, unless the description names a
  sound of the project (`music.asset`): an intro that holds back, a rise into
  the first reveal (a logo, the motif bursting) where the beat drops, a breath
  before the end card, the chords alone fading out. `drive` is minor with a
  full kit, `bright` major and open, `calm` without drums (a soft pulse, long
  bass notes, a lead ringing in the room). The seed picks the progression and
  the figure the lead plays. `assets/film/music.wav`, asset `film-music`.
- **effects** placed as layers of the film, one small file each
  (`assets/film/sfx-*.wav`): a whoosh under every fast pass, a hit on every
  reveal, a click when a button is pressed, a pop when a notification drops in,
  a tick when a figure lands. Each is then moved onto the moment of the picture
  the sound checks find (core's `soundCues`, which reads inside the scenes: a
  cut, an appearance, a landing) when one is a few frames away, so the film is
  in sync by construction; the bed is made after them and dips under each hit
  (-6 dB, -9 under a reveal). Each placement is a layer the user can move,
  mute or swap for a recording of the library.

The composition's mix brings the master to its loudness (-14 LUFS by default).
The music is generated, not composed: it is listened to by a human before the
film goes out, and replaced by a real track (`music.asset`) when it matters.

## The review

`review.ts` reads the description the way an art director would and names what
good films avoid, with its place and what to do instead: no concept, three
scenes in a row with the same layout or camera, every headline entering the same
way, every scene the same length, more words than the scene leaves time to read
(about three words a second, plus a beat), a scene holding too long on too
little, a crowded scene, an overlong headline, too many words in the accent, a
palette that does not read, an expressive face for the text, an ending without
the brand. The build adds what it had to give up (a visual drawn smaller to fit,
a headline set smaller, more than the frame holds). The notes close the film
tool's summary; `film-review` shows them with the contact sheet.

## Adding to it

- **An element**: its fields in `ELEMENTS` (`spec.ts`, checked by `readFilm`,
  documented to the model by `film-guide`), and in `ELEMENT_RENDER`
  (`elements.ts`) how it is drawn into a box and how tall it wants to be for a
  width, with the helpers of `build.ts` (keyframes on the style's curve
  tokens), `text.ts`, `ui.ts` and `icons.ts`.
- **A layout, a camera, a pass, a ground, a treatment**: an entry of its list
  (`LAYOUTS`, `CAMERAS` in `spec.ts`; `TRANSITIONS`, `BACKGROUNDS` in
  `style.ts`; `TREATMENTS`), its code, and its line in the guide (`index.ts`,
  where each list has its documentation, checked complete by the compiler).
- **A face**: its entry in `FAMILIES` (`fonts.ts`) with its voice and its
  path in google/fonts (`remote`, at the pinned commit), then its advances measured by
  `node scripts/font-metrics.ts` (the layout measures text without a canvas).
- **A preset**: an entry of `PRESETS` in `style.ts`.

`packages/film/test/film.test.ts` builds every element, layout, treatment,
camera, pass and ground from every preset in every format and validates the
document.
