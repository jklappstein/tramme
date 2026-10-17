# Guided tours

The editor shows how it works through guided tours (driver.js), in the theme's colors. The tour engine knows no tour by itself: each one is declared separately, and three sources can add them.

Code: [apps/editor/src/tours](../apps/editor/src/tours).

## A tour

```ts
registerTour({
  id: 'my-tool',               // unique and stable: remembers that the tour was seen
  title: 'My tool',            // in the help menu (?)
  summary: 'What it is for.',
  page: 'editor',              // 'home' or 'editor'
  auto: false,                 // true: offered by itself the first time the page opens
  version: 1,                  // raise it when the tour changes: it is offered again
  order: 50,                   // place in the menu (smaller first)
  available: () => true,       // the tour makes sense here and now (inStudio, inAtelier: one view's places)
  steps: [
    { title: 'Welcome', body: 'A message in the middle, with no target.' },
    {
      target: 'inspector',     // a data-tour marker, a CSS selector, or a function returning the element
      side: 'left', align: 'start',
      title: 'The inspector',
      body: 'Plain text; **bold** and line breaks are kept.',
      before: () => press('left-tab-layers'),   // prepares the screen (tab, selection); can be async
      when: () => true,        // step shown only when true (checked at the start)
    },
  ],
});
```

A step whose target is not on screen (a panel hidden on a phone, for example) is skipped. A project opens in one of two views, the studio (the film directed in notes) or the atelier (layers, timeline, inspector): a tour about one view's places sets `available: inStudio` or `available: inAtelier`, so the help menu offers it only there.

## Where to point

Tours point at `data-tour` markers, not CSS classes: the interface can change its layout without breaking the tours. Available markers:

| Page | Markers |
|---|---|
| Home | `home-new` (the direction box), `home-more`, `home-projects`, `home-examples`, `settings`, `help` |
| Editor, top | `project`, `view-switch`, `history`, `format`, `settings`, `help`, `export` |
| Studio | `stage`, `direct` (the direction bar), `pin`, `storyboard`, `notes`, `direction-tab`, `viewport` |
| Atelier, panels | `left-panel`, `left-tab-layers`, `left-tab-assets`, `left-tab-tokens`, `inspector` |
| Atelier, preview | `viewport`, `quality` |
| Atelier, bottom | `transport`, `timeline`, `bottom-tab-timeline`, `bottom-tab-graph` |
| Assistant | `assistant`, `assistant-model`, `assistant-access`, `assistant-history`, `assistant-composer` (the model and access markers are in the studio's notes too) |

`press(name)` clicks a marker the way the user would (to open a tab before talking about it). For a new area of the interface, give it a `data-tour` attribute.

## Three ways to add tours

1. **In the editor**: a module in `apps/editor/src/tours/` that calls `registerTour`, imported by `tours/index.ts`.
2. **In a project plugin**: the module exports `tours`, an array of tours (page `editor` by default). They join the help menu as long as the project uses the plugin, with the plugin's name beside them.

   ```js
   export const tours = [{ id: 'star', title: 'The Star node', steps: [{ target: 'inspector', title: 'Settings', body: 'Number of points, radius…' }] }];
   ```

3. **From a script**: `window.tramme.tours.register(tour)`, `window.tramme.tours.start(id)`, `window.tramme.tours.list('editor')`.

## What is remembered

Per browser: the tours seen (with their version) and whether to offer them when a page opens. Both are set in the help menu and in the settings (Guided tours).
