// The components' tools (docs/components-roadmap.md, step 4): what exists
// made a component (its layers moved into a composition that exposes
// parameters, one instance in their place), instances placed one by one or
// N at once by a layout and rules, an instance detached into plain layers.
// The assistant reaches them through use_tool, the user through the / menu.

import { defineComponentPlan, detachPlan, Evaluator, pointer, sampleComposition, type Distribution, type Layout, type Op, type ToolContext, type ToolType, type Vec2 } from '@tramme/core';
import { freshId, slug } from './model.ts';
import { t } from './i18n/index.ts';

/** an object argument, or the same written as JSON (the / menu's text field) */
function objectArg<T>(v: unknown, what: string): T | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { throw new Error(`${what}: JSON expected`); }
  }
  return v as T;
}

/** where layers are drawn over the composition's whole length (their children included), padded: the component's frame */
function drawnBox(ctx: ToolContext, ids: string[]): { x: number; y: number; w: number; h: number } | undefined {
  const c = ctx.doc.compositions[ctx.compId], inside = new Set<string>();
  const take = (id: string) => { inside.add(id); for (const ch of c.layers[id]?.children ?? []) take(ch); };
  ids.forEach(take);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const step = Math.max(1 / c.fps, Math.min(0.25, c.duration / 40));
  for (const s of sampleComposition(new Evaluator(ctx.doc, ctx.registry), ctx.compId, step)) {
    for (const p of s.layers) {
      if (!inside.has(p.id) || !p.box) continue;
      x0 = Math.min(x0, p.box.x); y0 = Math.min(y0, p.box.y); x1 = Math.max(x1, p.box.x + p.box.w); y1 = Math.max(y1, p.box.y + p.box.h);
    }
  }
  if (!(x1 > x0 && y1 > y0)) return undefined;
  const pad = 4;
  return { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + 2 * pad), h: Math.ceil(y1 - y0 + 2 * pad) };
}

interface ParamArg { name: string; targets: string[]; type?: string; default?: unknown; label?: string }

const defineComponent: ToolType<{ name: string; layers?: string[]; params?: ParamArg[] | string }> = {
  name: 'define_component', title: 'Make a component', description: 'turns layers (the selection by default, siblings, with their children) into a component: a composition of their own with the parameters given, and one instance of it in their place, drawn the same. Place more with instantiate',
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      layers: { type: 'array', items: { type: 'string' }, title: 'Layers', description: 'their ids; the selection by default' },
      params: {
        type: ['array', 'string'], title: 'Parameters', description: 'what varies from one instance to the next: a name and the properties it lands on, by their address (title.text, plate.fill, card.transform.scale); its type is the first target\'s',
        items: { type: 'object', properties: { name: { type: 'string' }, targets: { type: 'array', items: { type: 'string' } }, type: { type: 'string' }, default: {}, label: { type: 'string' } }, required: ['name', 'targets'] },
      },
    },
    required: ['name'],
  },
  ai: {
    when: 'anything written, or about to be written, more than once: a card, a bar of a chart, a word treatment, a badge, a lower third. Build one, make it a component with what varies as parameters (its text, its colour, its value), then place the others with instantiate',
    avoid: 'parameters for what never varies; a component of one plain layer with nothing exposed',
    example: { name: 'card', params: [{ name: 'title', targets: ['title.text'] }, { name: 'color', targets: ['plate.fill'] }] },
  },
  run(a, ctx) {
    if (!a.name?.trim()) throw new Error('define_component: a name is expected');
    const ids = a.layers?.length ? a.layers : ctx.selection;
    if (!ids.length) throw new Error('define_component: select layers or pass their ids');
    const id = freshId(ctx.doc.compositions, slug(a.name) || 'component');
    const params = Object.fromEntries((objectArg<ParamArg[]>(a.params, 'params') ?? []).map((p) => [p.name, { targets: p.targets, type: p.type, default: p.default, label: p.label }]));
    const plan = defineComponentPlan(ctx.doc, ctx.registry, ctx.compId, ids, { id, name: a.name.trim(), box: drawnBox(ctx, ids), params });
    if ('error' in plan) throw new Error(`define_component: ${plan.error}`);
    const names = Object.keys(params);
    return {
      ops: plan.ops, label: t('components.defined', { name: a.name.trim() }),
      notice: t('components.definedNotice', { name: a.name.trim() }),
      text: `Component "${id}" made of ${ids.join(', ')}${names.length ? `, parameters ${names.join(', ')}` : ', no parameter yet'}; the layer "${plan.instance}" is its first instance, in their place. Place more with use_tool "instantiate" (component "${id}"), one by one or many with a layout; change the component (compositions/${id}) to change them all.`,
    };
  },
};

interface InstantiateArgs {
  component: string;
  position?: Vec2;
  at?: number;
  params?: Record<string, unknown> | string;
  overrides?: Record<string, unknown> | string;
  count?: number;
  layout?: 'grid' | 'list' | 'circle' | Layout | string;
  spacing?: number;
  rules?: Record<string, unknown> | string;
  rows?: string;
  time?: Distribution['time'] | string;
  name?: string;
}

const instantiate: ToolType<InstantiateArgs> = {
  name: 'instantiate', title: 'Place a component', description: 'places a component: one instance with its parameter values, or many at once (count, or one per row of data) laid out on a grid, a line, a circle, a path or another layer\'s points, each parameter given by a rule, optionally played as a wave by a time field',
  input: {
    type: 'object',
    properties: {
      component: { type: 'string', title: 'Component', description: 'its composition id' },
      position: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, title: 'Position', description: 'the centre of the instance (or of the layout), in pixels; the frame\'s centre by default' },
      at: { type: 'number', minimum: 0, title: 'From (s)', description: 'when it starts; the component plays from its own 0 there' },
      params: { type: ['object', 'string'], title: 'Values', description: 'a value per parameter, for every instance' },
      overrides: { type: ['object', 'string'], title: 'Overrides', description: 'any property of the component set for these instances only, by its address in it' },
      count: { type: 'integer', minimum: 1, maximum: 10000, title: 'How many' },
      layout: { title: 'Layout', description: "'grid', 'list', 'circle', or a layout object: { type: 'grid', columns, spacing: [x, y] }, { type: 'list', direction, spacing }, { type: 'circle', radius, start, sweep, rotate }, { type: 'path', path, rotate }, { type: 'points', layer }" },
      spacing: { type: 'number', title: 'Spacing (px)', description: "with a layout by name: the step between instances (the circle's radius)" },
      rules: { type: ['object', 'string'], title: 'Rules', description: 'per parameter, for many: a value, { $expr } reading index, count, row (random(index), noise(index * 0.3)), or { $palette: "order" | "random" }' },
      rows: { type: 'string', format: 'asset', assetType: 'json', title: 'Data', description: 'one instance per row of this JSON asset (an array), read as row' },
      time: { type: ['object', 'string'], title: 'Time field', description: "each instance later: { mode: 'rank' | 'angle' | 'distance' | 'noise', amount (s), angle, center, scale, speed, seed, loop }" },
      name: { type: 'string', title: 'Name' },
    },
    required: ['component'],
  },
  ai: {
    when: 'the second and every later use of a component: one instance with its values, or a whole set as one distribution (forty cards on a grid in the palette, entering as a wave from the centre: count 40, layout grid, rules color { $palette: "order" }, time { mode: "distance", amount: 0.8 })',
    avoid: 'many instances written one by one when a layout and rules say it; a time field longer than the animation itself',
    example: { component: 'card', count: 12, layout: { type: 'grid', columns: 4, spacing: [300, 220] }, rules: { title: { $expr: "'Item ' + (index + 1)" }, color: { $palette: 'order' } }, time: { mode: 'angle', amount: 0.6 } },
  },
  run(a, ctx) {
    const c = ctx.doc.compositions[ctx.compId], inner = ctx.doc.compositions[a.component];
    if (!inner || a.component === ctx.compId) throw new Error(`instantiate: no component "${a.component}" (${Object.keys(ctx.doc.compositions).filter((id) => id !== ctx.compId).join(', ') || 'none'})`);
    const params = objectArg<Record<string, unknown>>(a.params, 'params'), overrides = objectArg<Record<string, unknown>>(a.overrides, 'overrides');
    const rules = objectArg<Record<string, unknown>>(a.rules, 'rules'), time = objectArg<Distribution['time']>(a.time, 'time');
    let layout = objectArg<Layout | string>(typeof a.layout === 'string' && !a.layout.trim().startsWith('{') ? JSON.stringify(a.layout) : a.layout, 'layout');
    const many = (a.count ?? 1) > 1 || !!a.rows || !!rules || !!time || layout !== undefined;
    if (typeof layout === 'string') {
      const s = a.spacing;
      layout = layout === 'circle' ? { type: 'circle', ...(s ? { radius: s } : {}) }
        : layout === 'list' ? { type: 'list', ...(s ? { spacing: s } : { spacing: Math.round(inner.width * 1.1) }) }
        : { type: 'grid', spacing: s ? [s, s] : [Math.round(inner.width * 1.1), Math.round(inner.height * 1.1)] };
    }
    if (many && !layout) layout = { type: 'grid', spacing: [Math.round(inner.width * 1.1), Math.round(inner.height * 1.1)] };
    const unknown = Object.keys({ ...params, ...rules }).filter((p) => !inner.params?.[p]);
    if (unknown.length) throw new Error(`instantiate: "${a.component}" has no parameter ${unknown.join(', ')} (it has ${Object.keys(inner.params ?? {}).join(', ') || 'none'})`);
    const id = freshId(c.layers, slug(a.name ?? a.component) || 'instance');
    const layer = {
      type: 'comp', name: a.name ?? inner.name,
      ...(a.at !== undefined ? { in: a.at } : {}),
      transform: { position: a.position ?? [c.width / 2, c.height / 2] },
      props: { comp: a.component, ...(a.at ? { start: 0 } : {}) },
      ...(params && Object.keys(params).length ? { params } : {}),
      ...(overrides && Object.keys(overrides).length ? { overrides } : {}),
      ...(many ? { distribute: { ...(a.count ? { count: a.count } : {}), ...(a.rows ? { rows: a.rows } : {}), layout: layout as Layout, ...(rules ? { params: rules } : {}), ...(time ? { time } : {}) } } : {}),
    };
    const ops: Op[] = [
      { op: 'add', path: pointer('compositions', ctx.compId, 'layers', id), value: layer },
      { op: 'replace', path: pointer('compositions', ctx.compId, 'order'), value: [...c.order, id] },
    ];
    const n = a.count ?? (a.rows ? 'one per row' : many ? 'one per point' : 1);
    return {
      ops, label: t('components.placed', { name: inner.name }),
      notice: t('components.placedNotice', { name: inner.name }),
      text: `"${id}": ${n} instance${n === 1 ? '' : 's'} of "${a.component}"${many ? ` laid out (${(layout as Layout).type})` : ''}${time ? `, played as a time field (${time.mode})` : ''}. Look at it (render_still or the check) before going on.`,
    };
  },
};

const detach: ToolType<{ layer?: string }> = {
  name: 'detach', title: 'Detach an instance', description: 'turns an instance of a component into plain layers drawn the same (its parameters and overrides written into them), to retouch it alone',
  input: { type: 'object', properties: { layer: { type: 'string', format: 'layer', layerType: 'comp', title: 'Instance' } } },
  ai: { when: 'one instance must differ in a way no parameter or override gives (its structure, a layer more)', avoid: 'detaching to change a value: an override does it and keeps the link to the component' },
  run(a, ctx) {
    const id = a.layer ?? ctx.selection.find((s) => ctx.doc.compositions[ctx.compId].layers[s]?.type === 'comp');
    if (!id) throw new Error('detach: select an instance or pass its id');
    const plan = detachPlan(ctx.doc, ctx.registry, ctx.compId, id);
    if ('error' in plan) {
      const why: Record<string, string> = {
        'not-instance': 'it is not a comp layer holding a composition',
        distributed: 'it is a distribution: its instances are read from its rules at each instant',
        timing: 'its time does not run one to one (a speed, a loop or a remap)',
        time: 'an expression or a modifier inside reads the time or the composition, and would read another one once moved',
        camera: 'the component has a camera',
        finish: 'the component has finishing effects',
        rect: 'no rectangle node to draw its frame',
      };
      throw new Error(`detach: ${id} cannot be detached: ${why[plan.error]}`);
    }
    return {
      ops: plan.ops, label: t('components.detached'), notice: t('components.detached'),
      text: `${id} detached: a group of ${plan.ids.length} plain layer(s) (${plan.ids.join(', ')}), no longer following its component.`,
    };
  },
};

export const COMPONENT_TOOLS: ToolType[] = [defineComponent, instantiate, detach];
