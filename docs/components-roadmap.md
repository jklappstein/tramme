# Components roadmap

How anything in a document is defined once and used many times with parameters: a layer of any type, a group, a whole composition, an animation alone or a style. Today the assistant writes every element in full through JSON Patch — twenty cards are twenty complete subtrees, a hundred dots a hundred layers — so the cost of a film follows the number of things on screen. After this it follows the number of different ideas in the film.

Status: step 1 done (parameters, instances and overrides read by the Evaluator, detach, styles and animations), step 2 done (distributions: layouts, rules, a rank per instance; a distribution is not detached yet), step 3 done (the time field, on any property and over a distribution). Tick the boxes as steps land, and keep this file as the reference instead of re-deciding the plan.

## Why

Most films repeat: cards of a list, bars of a chart, words of a title, particles of a scatter, the same entrance on every element, the same lower third in every scene. A model rewriting each copy spends tokens on what it already wrote, drifts between copies (one card a few pixels off, one colour not quite the palette), and leaves a document that is costly to change: editing the look means editing every copy.

What exists goes partway. `stagger` and `noise` vary a value by the layer's rank among its siblings, but each sibling must still be written. The `comp` node reuses a composition, without parameters. `apply_template` makes four fixed dressings in one call. The three are cases of one mechanism that is missing.

## Principles

- **Anything can be a component.** A layer of any node type, a group, a subtree, a composition, an animation without content (keyframes and modifiers to put on any property), a style (a set of values). Nothing in the mechanism knows about squares, cards or text.
- **Parameters are exposed properties.** A component lists what can vary and where it lands (`color` → `background.fill`, `title` → `label.text`, `in` → the entrance's start). Any animatable property of the schema can be exposed: values, keyframes, modifiers, media sources, timing.
- **An instance is a reference plus values.** Changing the component changes every instance, except what an instance overrides. An instance can be detached into plain layers when it must be retouched by hand.
- **Distribution makes N instances at once.** A layout (grid, circle, path, list, the points of another layer, the rows of a data file) and a rule giving each instance its parameters: an expression with `index` and `count`, deterministic noise, the project palette, a data row. Rendering stays a pure function of time: instances are expanded by the Evaluator, the same for the editor, the render and the checks.
- **Time is a parameter like the others.** Each instance can read its animation at its own instant (the time field below): a wave, a ripple, a liquid time are distributions of time.
- **The assistant never rewrites what exists.** Anything that appears or resembles more than once is defined and instanced, whatever its nature.

## Steps

### Step 1. Parametric components

- [x] The document format: a component is any subtree or composition with a list of exposed parameters (name, type from the schema, target paths, default). The `comp` node grows parameters instead of a new node type.
- [x] Instances: a reference, parameter values, overrides; the Evaluator expands them at evaluation time. Validation in `packages/core/src/validate.ts` (unknown parameter, wrong type, a component that contains itself).
- [x] Detach: an instance becomes plain layers, its parameters resolved.
- [x] Animations and styles as components: a set of keyframes and modifiers, or a set of values, applied to any compatible property.

### Step 2. Distribution

- [x] Layouts: grid, circle, along a path, list, the points of another layer, the rows of a data asset.
- [x] Rules per parameter: a constant, an expression (`index`, `count`, `row`, `random(seed)`), noise, the palette in order or at random.
- [x] A sibling rank and count for every instance, so the existing modifiers (`stagger`, `noise`, `near`) keep working on distributed instances.

### Step 3. The time field

- [x] `timeField` in `packages/core/src/modifiers.ts`: the property read at `base(t − amount · d)`, with `d` from the rank, a position along an angle, the distance to a point or a layer, or noise (`fbm`, scale 0 for a fixed random offset per element, `speed` for a field that drifts).
- [x] Bounds: a local time outside the span holds the first or last pose; a `loop` before it repeats.
- [x] Continuity: `d` continuous in space and time (gradient noise), an animated seed or amount interpolated, never switched.
- [x] `stagger` becomes the `rank` case of `timeField`, still read in existing projects.
- [x] A distribution can take a time field, so a wave over a hundred instances is one rule.

### Step 4. The assistant

- [ ] Tools: `define_component` (from an existing element or a new one, with its parameters), `instantiate` (one or N instances, a layout, a rule), `detach`.
- [ ] The guide: anything that repeats or resembles more than once is defined then instanced; when to use a distribution, a time field (wave, ripple, liquid time, desynchronisation); amounts that break the reading.
- [ ] A check in `packages/core/src/checks.ts` that finds near-identical subtrees of any type and proposes to factor them, so existing projects benefit too.
- [ ] `apply_template` becomes instancing of library components instead of four hard-coded dressings.

### Step 5. The editor

- [ ] A component's parameters in the property panel, generated from its exposed list like a node's schema.
- [ ] Instances shown as such (overrides marked, detach, go to the component).
- [ ] A library of the project's components, reusable across projects.
- [ ] Later: a volume view of a layer's timeline (its value over time and across instances) where the cut of a time field is seen and its angle set directly.

### Step 6. The cut per pixel (separate, later)

- [ ] A render node keeping a ring of frames as a 3D texture and reading `(uv, t + d(uv))`: slit-scan and time displacement on video or a whole frame. Costly in memory, isolated from the rest.

Done when: asked for a grid of forty product cards in the palette entering as a wave from the centre, the assistant writes one card, one distribution and one time field; the bench shows the tokens written for such briefs fall, and the films score the same or better. Checked: an instance and its detached copy render identically; `timeField` in `rank` mode matches the old `stagger`; no jump between two frames when a seed or amount is animated.
