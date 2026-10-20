// Components (docs/components-roadmap.md, step 1). A composition that
// exposes parameters is a component; a comp layer that holds it is an
// instance: a value per parameter, and overrides of any property by its
// address in the component. The Evaluator reads the component through the
// instance (instanceProps below): every address a parameter targets, and
// every override, answers with the instance's value instead of its own. A
// style is a set of properties defined once and applied to any layer that
// has them; keyframed, it is an animation, moved in time where it is used.

import { pointer, type Op } from './ops.ts';
import { asKeyframed, propKind, staticValue } from './props.ts';
import { CAMERA_SCHEMA, MASK_SCHEMA, MOTION_BLUR_SCHEMA, SOUND_MIX_SCHEMA, TRANSFORM_SCHEMA, type PropDef, type PropType, type Registry } from './registry.ts';
import type { ComponentParam, Composition, Layer, Prop, TrammeDoc } from './types.ts';

/** a component's parameters as read by one instance: the property each address takes instead of its own */
export interface Instance {
  /** the same for two instances that read the component the same way (the Evaluator's caches) */
  key: string;
  props: Map<string, Prop>;
}

/** the types a parameter can take: those of the schema's properties */
export const PARAM_TYPES: readonly PropType[] = ['number', 'vec2', 'bool', 'color', 'paint', 'enum', 'string', 'text', 'ease', 'path', 'asset', 'assets', 'comp', 'layer', 'json'];

/** a value of type `from` can land on a property of type `to` (a colour on a paint, a line on a text) */
export function paramFits(from: string, to: PropType): boolean {
  return from === to || (from === 'color' && to === 'paint') || ((from === 'string' || from === 'text') && (to === 'string' || to === 'text'));
}

/** the property definition of a parameter: its type, its default, its options */
export function paramDef(p: ComponentParam): PropDef {
  return { type: p.type as PropType, default: p.default ?? null, nullable: true, label: p.label, description: p.description, ...(p.options ? { options: p.options } : {}) };
}

/**
 * What a property address of a composition holds, without evaluating it:
 * a layer's property ('card.fill'), its transform, an effect's or a mask's
 * property, an instance's parameter ('card.params.color'), or a setting of
 * the composition ('$comp.background'). Null when there is nothing there.
 */
export function addressDef(doc: TrammeDoc, registry: Registry, comp: Composition, address: string): PropDef | null {
  const [lid, a, b, c, ...rest] = address.split('.');
  if (lid === '$comp') {
    if (a === 'background' && b === undefined) return { type: 'color', default: null, nullable: true };
    if (a === 'motionBlur' && c === undefined) return MOTION_BLUR_SCHEMA[b] ?? null;
    if (a === 'camera' && c === undefined) return CAMERA_SCHEMA[b] ?? null;
    if (a === 'sound' && c === undefined) return SOUND_MIX_SCHEMA[b] ?? null;
    if (a === 'effects' && !rest.length) {
      const fx = (comp.effects || []).find((e) => e.id === b);
      return fx && registry.hasEffect(fx.type) ? registry.effect(fx.type).props[c] ?? null : null;
    }
    return null;
  }
  const layer = comp.layers[lid];
  if (!layer || a === undefined || rest.length) return null;
  if (a === 'transform') return c === undefined ? TRANSFORM_SCHEMA[b] ?? null : null;
  if (a === 'effects') {
    const fx = (layer.effects || []).find((e) => e.id === b);
    return fx && registry.hasEffect(fx.type) ? registry.effect(fx.type).props[c] ?? null : null;
  }
  if (a === 'masks') return (layer.masks || []).some((m) => m.id === b) ? MASK_SCHEMA[c] ?? null : null;
  if (a === 'params') {
    const p = c === undefined ? componentOf(doc, layer)?.params?.[b] : undefined;
    return p ? paramDef(p) : null;
  }
  if (b !== undefined || !registry.hasNode(layer.type)) return null;
  return registry.node(layer.type).props[a] ?? null;
}

/** the composition a comp layer holds, when it names one */
export function componentOf(doc: TrammeDoc, layer: Layer): Composition | null {
  if (layer.type !== 'comp') return null;
  const id = staticValue(layer.props?.comp);
  return typeof id === 'string' ? doc.compositions[id] ?? null : null;
}

/**
 * The properties an instance sets in its component: each parameter's value
 * (`values`, already evaluated in the composition holding the instance) on
 * every one of its targets, then the overrides, which win. A parameter with
 * neither a value nor a default leaves its targets as they are.
 */
export function instanceProps(comp: Composition, values: Record<string, unknown>, overrides?: Record<string, Prop>): Map<string, Prop> {
  const out = new Map<string, Prop>();
  for (const [name, p] of Object.entries(comp.params || {})) {
    const v = name in values ? values[name] : p.default;
    if (v === undefined) continue;
    // always wrapped: an object value is never read as keyframes or a link
    for (const target of p.targets) out.set(target, { $v: v });
  }
  for (const [address, prop] of Object.entries(overrides || {})) out.set(address, prop);
  return out;
}

/** a property moved `at` seconds later: its keyframes (the rest holds no time) */
export function shiftProp(prop: Prop, at: number): Prop {
  if (!at || propKind(prop) !== 'keyframes') return prop;
  const kp = asKeyframed(prop);
  return { ...kp, $k: kp.$k.map((k) => ({ ...k, t: Math.round((k.t + at) * 1e6) / 1e6 })) };
}

/**
 * The properties a layer's styles set, by their name on the layer
 * ('fill', 'transform.opacity'): each style's in order, the later over the
 * earlier, renamed by its `map`, its keyframes moved by its `at`. Null when
 * the layer has none.
 */
export function styleProps(doc: TrammeDoc, layer: Layer): Map<string, Prop> | null {
  if (!layer.styles?.length) return null;
  const out = new Map<string, Prop>();
  for (const use of layer.styles) {
    const style = doc.styles?.[use.style];
    if (!style) continue;
    for (const [name, prop] of Object.entries(style.props)) out.set(use.map?.[name] ?? name, shiftProp(prop, use.at ?? 0));
  }
  return out;
}

export type DetachError = 'not-instance' | 'timing' | 'time' | 'camera' | 'finish' | 'rect';
export interface DetachPlan { ops: Op[]; ids: string[] }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** does any value of x (deeply) carry one of these keys */
const carries = (x: unknown, keys: string[]): boolean =>
  Array.isArray(x) ? x.some((y) => carries(y, keys)) : isObj(x) ? Object.entries(x).some(([k, v]) => keys.includes(k) || carries(v, keys)) : false;
/** does any expression in x read the composition holding it (its size, its markers) */
const readsComp = (x: unknown): boolean =>
  Array.isArray(x) ? x.some(readsComp) : isObj(x) ? Object.entries(x).some(([k, v]) => (k === '$expr' && typeof v === 'string' && /\bcomp\.|marker\(/.test(v)) || (k === '$link' && typeof v === 'string' && v.startsWith('$comp')) || readsComp(v)) : false;

/**
 * Detach (docs/components-roadmap.md, step 1): the operations that turn the
 * instance `layerId` into plain layers of the composition holding it, which
 * draw the same. The comp layer becomes a group (same id, transform,
 * effects, masks and timing) holding the composition's background, the clip
 * of its frame when it crops, and its layers under new ids, moved to the
 * holding composition's time, with every parameter and override written
 * into them (parameters as the instance gives them, keyframes and all).
 * Refused when the copy could not draw the same: a time that does not run
 * one to one, or an expression or modifier that reads the time while the
 * copy is moved; an expression reading the composition itself; a camera or
 * finishing effects on the component. The layers keep their ids where the
 * composition has none of them: a modifier's noise, seeded by its address,
 * then draws the same too.
 */
export function detachPlan(doc: TrammeDoc, registry: Registry, compId: string, layerId: string): DetachPlan | { error: DetachError } {
  const host = doc.compositions[compId], L = host?.layers[layerId], inner = L && componentOf(doc, L);
  if (!L || !inner) return { error: 'not-instance' };
  const innerId = String(staticValue(L.props?.comp));
  const P = L.props || {};
  const timed = (k: string) => P[k] !== undefined && propKind(P[k]) !== 'static';
  if (timed('start') || timed('speed') || timed('loop') || timed('remap') || staticValue(P.loop) === true || (staticValue(P.remap) ?? null) !== null || (Number(staticValue(P.speed) ?? 1) !== 1)) return { error: 'timing' };
  if (inner.camera) return { error: 'camera' };
  if (inner.effects?.some((e) => e.enabled !== false)) return { error: 'finish' };
  // composition time = the component's + dt
  const dt = Math.round(((L.in ?? 0) - (Number(staticValue(P.start)) || 0)) * 1e6) / 1e6;
  const own = { layers: inner.layers, overrides: L.overrides, styles: Object.values(inner.layers).map((l) => (l.styles || []).map((u) => doc.styles?.[u.style])) };
  if (readsComp(own)) return { error: 'time' };
  if (dt !== 0 && carries(own, ['$expr', '$mod'])) return { error: 'time' };
  const crop = staticValue(P.crop) !== false;
  if ((crop || (inner.background ?? null) !== null) && !registry.hasNode('shape.rect')) return { error: 'rect' };

  // the component's ids where they are free (a modifier's noise is seeded by its address), else the instance's id before them
  const taken = new Set(Object.keys(host.layers)), rename = new Map<string, string>();
  const fresh = (base: string) => { let id = base, n = 2; while (taken.has(id)) id = `${base}-${n++}`; taken.add(id); return id; };
  for (const id of Object.keys(inner.layers)) rename.set(id, taken.has(id) ? fresh(`${layerId}-${id}`) : fresh(id));
  const renamed = (s: string) => rename.get(s) ?? s;
  // a property of the component in the holding composition: its keyframes moved, the layers it names renamed
  const move = (prop: Prop, def: PropDef | null): Prop => {
    let p = shiftProp(prop, dt);
    if (isObj(p) && typeof p.$link === 'string' && !p.$link.startsWith('@')) {
      const [first, ...rest] = (p.$link as string).split('.');
      p = { ...p, $link: [renamed(first), ...rest].join('.') };
    }
    if (isObj(p) && typeof p.$expr === 'string') {
      p = { ...p, $expr: (p.$expr as string).replace(/(['"`])([A-Za-z0-9_-]+)(?=[.'"`])/g, (m, q: string, id: string) => (rename.has(id) ? q + rename.get(id) : m)) };
    }
    if (def?.type === 'layer' && propKind(p) === 'static') {
      const v = staticValue(p);
      if (typeof v === 'string') p = isObj(p) && '$v' in p ? { ...p, $v: renamed(v) } : renamed(v);
    }
    return p;
  };
  const moveAll = (props: Record<string, Prop> | undefined, defs: Record<string, PropDef>) =>
    props && Object.fromEntries(Object.entries(props).map(([k, v]) => [k, move(v, defs[k] ?? null)]));
  const effectDefs = (type: string) => (registry.hasEffect(type) ? registry.effect(type).props : {});

  const layers: Record<string, Layer> = {};
  for (const [id, l] of Object.entries(inner.layers)) {
    const nodeDefs = registry.hasNode(l.type) ? registry.node(l.type).props : {};
    const c: Layer = { ...structuredClone(l), in: Math.round(((l.in ?? 0) + dt) * 1e6) / 1e6, out: Math.round(((l.out ?? inner.duration) + dt) * 1e6) / 1e6 };
    if (l.props) c.props = moveAll(l.props, nodeDefs);
    if (l.transform) c.transform = moveAll(l.transform as Record<string, Prop>, TRANSFORM_SCHEMA);
    if (l.effects) c.effects = l.effects.map((e) => ({ ...e, ...(e.props ? { props: moveAll(e.props, effectDefs(e.type)) } : {}) }));
    if (l.masks) c.masks = l.masks.map((m) => ({ ...m, ...(m.props ? { props: moveAll(m.props, MASK_SCHEMA) } : {}) }));
    if (l.overrides) c.overrides = Object.fromEntries(Object.entries(l.overrides).map(([k, v]) => [k, shiftProp(v, dt)]));
    if (l.params) c.params = moveAll(l.params, {});
    if (l.styles) c.styles = l.styles.map((u) => ({ ...u, at: Math.round(((u.at ?? 0) + dt) * 1e6) / 1e6 }));
    if (l.clip) c.clip = renamed(l.clip);
    if (l.children) c.children = l.children.map(renamed);
    layers[rename.get(id)!] = c;
  }
  // the parameters as the instance gives them (in this composition's time already), then the overrides
  let background: Prop | null | undefined = inner.background === undefined ? undefined : inner.background === null ? null : move(inner.background, null);
  const put = (address: string, prop: Prop) => {
    const [lid, a, b, c] = address.split('.');
    if (lid === '$comp') { if (a === 'background') background = prop; return; }
    const l = layers[renamed(lid)];
    if (!l) return;
    if (a === 'transform') l.transform = { ...l.transform, [b]: prop };
    else if (a === 'effects') l.effects = l.effects?.map((e) => (e.id === b ? { ...e, props: { ...e.props, [c]: prop } } : e));
    else if (a === 'masks') l.masks = l.masks?.map((m) => (m.id === b ? { ...m, props: { ...m.props, [c]: prop } } : m));
    else if (a === 'params') l.params = { ...l.params, [b]: prop };
    else l.props = { ...l.props, [a]: prop };
  };
  for (const [name, p] of Object.entries(inner.params || {})) {
    const v = L.params?.[name] ?? (p.default === undefined ? undefined : { $v: p.default });
    if (v !== undefined) for (const target of p.targets) put(target, v);
  }
  for (const [address, prop] of Object.entries(L.overrides || {})) put(address, move(prop, addressDef(doc, registry, inner, address)));

  // the group in the instance's place: its frame centred on the instance's origin, as the comp node draws it
  const { width: w, height: h } = inner, children: string[] = [];
  const extra: Record<string, Layer> = {};
  const frame = crop ? fresh(`${layerId}-frame`) : undefined;
  if (frame) {
    extra[frame] = { type: 'shape.rect', name: 'Frame', visible: false, props: { size: [w, h] } };
    children.push(frame);
  }
  if (background !== undefined && background !== null) {
    // cut by the frame as well: its edges drawn as the nested composition's are
    const id = fresh(`${layerId}-background`);
    extra[id] = { type: 'shape.rect', name: 'Background', ...(frame ? { clip: frame } : {}), props: { size: [w, h], fill: background } };
    children.push(id);
  }
  const content = fresh(`${layerId}-content`);
  extra[content] = { type: 'group', name: inner.name, transform: { anchor: [w / 2, h / 2] }, ...(frame ? { clip: frame } : {}), children: inner.order.map(renamed) };
  children.push(content);
  const group: Layer = {
    type: 'group', name: L.name ?? inner.name,
    ...Object.fromEntries((['in', 'out', 'visible', 'locked', 'clip', 'blend', 'transform', 'effects', 'masks', 'styles'] as const).filter((k) => L[k] !== undefined).map((k) => [k, L[k]])),
    children,
  };
  const at = (id: string) => pointer('compositions', compId, 'layers', id);
  const ops: Op[] = [
    ...Object.entries({ ...layers, ...extra }).map(([id, l]): Op => ({ op: 'add', path: at(id), value: l })),
    { op: 'replace', path: at(layerId), value: group },
  ];
  return { ops, ids: [...Object.keys(extra), ...Object.keys(layers)] };
}
