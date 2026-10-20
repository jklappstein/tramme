import { describe, expect, it } from 'vitest';
import { applyOps, detachPlan, Evaluator, validate, type Instance, type NodeType, type TrammeDoc } from '../src/index.ts';
import { registry as baseRegistry } from './fixtures.ts';

const compNode: NodeType = {
  type: 'comp', title: 'Composition', category: 'test',
  props: {
    comp: { type: 'comp', default: null, nullable: true, animatable: false },
    start: { type: 'number', default: 0 }, speed: { type: 'number', default: 1 },
    loop: { type: 'bool', default: false }, remap: { type: 'number', default: null, nullable: true },
  },
  render: { canvas2d() {} },
};
const registry = () => baseRegistry().register(compNode);

/** a card component (colour and title exposed) and a scene holding two instances of it */
function doc(): TrammeDoc {
  return {
    schema: 'tramme/1', meta: { title: 'components' }, tokens: { brand: { type: 'color', value: '#FF0000' } }, assets: {}, root: 'main',
    styles: {
      pop: { props: { 'transform.scale': { $k: [{ t: 0, v: [0, 0] }, { t: 1, v: [1, 1] }] } } },
      ink: { props: { fill: '#111111', radius: 8 } },
    },
    compositions: {
      card: {
        name: 'Card', width: 200, height: 100, fps: 30, duration: 5,
        params: {
          color: { type: 'color', targets: ['bg.fill'], default: '#FFFFFF' },
          title: { type: 'string', targets: ['label.label'] },
          size: { type: 'vec2', targets: ['bg.size', 'label.size'] },
        },
        layers: {
          bg: { type: 'box', props: { size: [200, 100], fill: '#000000', radius: 4 } },
          label: { type: 'box', props: { label: 'Card', radius: { $link: 'bg.radius' } } },
        },
        order: ['bg', 'label'],
      },
      main: {
        name: 'Main', width: 1000, height: 1000, fps: 30, duration: 5,
        layers: {
          one: { type: 'comp', props: { comp: 'card' }, params: { color: '@brand', title: 'One' } },
          two: { type: 'comp', props: { comp: 'card' }, params: { title: { $k: [{ t: 0, v: 'A' }, { t: 1, v: 'B', ease: 'hold' }] } }, overrides: { 'bg.radius': 20 } },
          plain: { type: 'comp', props: { comp: 'card' } },
        },
        order: ['one', 'two', 'plain'],
      },
    },
  };
}

const instanceOf = (ev: Evaluator, id: string, t: number) => ev.layerAt(id, t, 'main').props.$instance as Instance;

describe('parametric components', () => {
  it('an instance reads the component through its parameters, the default where it gives none', () => {
    const ev = new Evaluator(doc(), registry());
    const one = ev.frame(0, 'card', instanceOf(ev, 'one', 0));
    expect(one.layers[0].props.fill).toBe('#FF0000');
    expect(one.layers[1].props.label).toBe('One');
    // size has neither value nor default: the component's own
    expect(one.layers[0].props.size).toEqual([200, 100]);
    const plain = ev.frame(0, 'card', instanceOf(ev, 'plain', 0));
    expect(plain.layers[0].props.fill).toBe('#FFFFFF');
    expect(plain.layers[1].props.label).toBe('Card');
    // the component itself, read alone, is unchanged by the instances read before
    expect(ev.frame(0, 'card').layers[0].props.fill).toBe('#000000');
  });

  it('parameters animate in the holding composition; overrides reach any property, links follow them', () => {
    const ev = new Evaluator(doc(), registry());
    expect(ev.frame(0, 'card', instanceOf(ev, 'two', 0)).layers[1].props.label).toBe('A');
    const later = ev.frame(0, 'card', instanceOf(ev, 'two', 2));
    expect(later.layers[1].props.label).toBe('B');
    expect(later.layers[0].props.radius).toBe(20);
    // label.radius links bg.radius: it reads the override too
    expect(later.layers[1].props.radius).toBe(20);
    expect(ev.frame(0, 'card', instanceOf(ev, 'one', 0)).layers[1].props.radius).toBe(4);
  });

  it('a value given to a vec2 parameter lands on every target', () => {
    const d = doc();
    d.compositions.main.layers.one.params!.size = [50, 60];
    const ev = new Evaluator(d, registry());
    const f = ev.frame(0, 'card', instanceOf(ev, 'one', 0));
    expect(f.layers.map((l) => l.props.size)).toEqual([[50, 60], [50, 60]]);
  });

  it('validation: unknown parameter, wrong type, missing target, a component holding itself', () => {
    expect(validate(doc(), registry())).toEqual([]);
    const d = doc();
    d.compositions.main.layers.one.params!.colour = '#000';
    d.compositions.main.layers.two.params!.title = 3;
    d.compositions.main.layers.two.overrides!['bg.nope'] = 1;
    d.compositions.card.params!.ghost = { type: 'number', targets: ['missing.radius'] };
    d.compositions.card.params!.wrong = { type: 'number', targets: ['bg.fill'] };
    d.compositions.card.params!.odd = { type: 'shape', targets: ['bg.radius'] };
    d.compositions.main.layers.bg = { type: 'box', params: { x: 1 } };
    d.compositions.main.order.push('bg');
    const paths = validate(d, registry()).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining([
      '/compositions/main/layers/one/params/colour',
      '/compositions/main/layers/two/params/title',
      '/compositions/main/layers/two/overrides/bg.nope',
      '/compositions/card/params/ghost/targets/0',
      '/compositions/card/params/wrong/targets/0',
      '/compositions/card/params/odd/type',
      '/compositions/main/layers/bg/type',
    ]));
    const loop = doc();
    loop.compositions.card.layers.self = { type: 'comp', props: { comp: 'card' } };
    loop.compositions.card.order.push('self');
    expect(validate(loop, registry()).some((i) => /loop/.test(i.message))).toBe(true);
  });

  it('a link reads an instance parameter by its address', () => {
    const d = doc();
    d.compositions.main.layers.tag = { type: 'box', props: { label: { $link: 'one.params.title' } } };
    d.compositions.main.order.push('tag');
    expect(validate(d, registry())).toEqual([]);
    expect(new Evaluator(d, registry()).layerAt('tag', 0, 'main').props.label).toBe('One');
  });
});

describe('styles and animations', () => {
  const styled = () => {
    const d = doc();
    d.compositions.main.layers.dot = { type: 'box', props: { fill: '#FFFFFF', radius: 2 }, styles: [{ style: 'ink' }, { style: 'pop', at: 2 }] };
    d.compositions.main.order.push('dot');
    return d;
  };

  it('a style sets its properties over the layer\'s own, an animation moved to where it is used', () => {
    const ev = new Evaluator(styled(), registry());
    const at = (t: number) => ev.layerAt('dot', t, 'main');
    expect(at(0).props.fill).toBe('#111111');
    expect(at(0).props.radius).toBe(8);
    expect(at(2).transform.scale).toEqual([0, 0]);
    expect(at(2.5).transform.scale).toEqual([0.5, 0.5]);
    expect(at(4).transform.scale).toEqual([1, 1]);
  });

  it('a style applied to another property by its map; validation of styles', () => {
    const d = styled();
    d.compositions.main.layers.dot.styles = [{ style: 'pop', map: { 'transform.scale': 'size' } }];
    const ev = new Evaluator(d, registry());
    expect(ev.layerAt('dot', 0.5, 'main').props.size).toEqual([0.5, 0.5]);
    expect(validate(d, registry())).toEqual([]);
    d.compositions.main.layers.dot.styles = [{ style: 'nope' }, { style: 'ink', map: { stroke: 'fill' } }];
    d.styles!.ink.props.radius = 'round';
    d.compositions.main.layers.grp = { type: 'group', children: [], styles: [{ style: 'ink' }] };
    d.compositions.main.order.push('grp');
    const paths = validate(d, registry()).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining([
      '/compositions/main/layers/dot/styles/0/style',
      '/compositions/main/layers/dot/styles/1/map/stroke',
      '/styles/ink/props/radius',
      '/compositions/main/layers/grp/styles/0',
    ]));
  });
});


describe('detach', () => {
  const rect: NodeType = { type: 'shape.rect', title: 'Rect', category: 'test', props: { size: { type: 'vec2', default: [1, 1] }, fill: { type: 'paint', default: '#FFFFFF', nullable: true } }, path: () => null, render: { canvas2d() {} } };
  const reg = () => registry().register(rect);

  it('turns an instance into plain layers with its parameters and overrides written in, in the composition\'s time', () => {
    const d = doc();
    d.compositions.main.layers.two.in = 1;
    d.compositions.card.layers.bg.transform = { position: { $k: [{ t: 0, v: [0, 0] }, { t: 1, v: [10, 0] }] } };
    const plan = detachPlan(d, reg(), 'main', 'two');
    if ('error' in plan) throw new Error(plan.error);
    const out = applyOps(d, plan.ops).doc, main = out.compositions.main;
    expect(validate(out, reg())).toEqual([]);
    const g = main.layers.two;
    expect(g.type).toBe('group');
    expect(g.in).toBe(1);
    // the component's ids kept where free; the frame that crops it, then the content
    expect(main.layers.bg.props!.radius).toBe(20);
    expect(main.layers.label.props!.label).toEqual({ $k: [{ t: 0, v: 'A' }, { t: 1, v: 'B', ease: 'hold' }] });
    expect(main.layers.bg.props!.fill).toEqual({ $v: '#FFFFFF' });
    expect(main.layers.bg.transform!.position).toEqual({ $k: [{ t: 1, v: [0, 0] }, { t: 2, v: [10, 0] }] });
    expect([main.layers.bg.in, main.layers.bg.out]).toEqual([1, 6]);
    // a second instance: the ids taken, its own
    const again = detachPlan(out, reg(), 'main', 'one');
    if ('error' in again) throw new Error(again.error);
    const both = applyOps(out, again.ops).doc;
    expect(validate(both, reg())).toEqual([]);
    expect(both.compositions.main.layers['one-label'].props!.label).toBe('One');
    // the link to the plate renamed with it
    expect(both.compositions.main.layers['one-label'].props!.radius).toEqual({ $link: 'one-bg.radius' });
  });

  it('refuses what would not draw the same', () => {
    const d = doc();
    expect(detachPlan(d, reg(), 'main', 'missing')).toEqual({ error: 'not-instance' });
    d.compositions.main.layers.one.props!.speed = 2;
    expect(detachPlan(d, reg(), 'main', 'one')).toEqual({ error: 'timing' });
    d.compositions.main.layers.two.in = 1;
    d.compositions.card.layers.bg.props!.radius = { $expr: 't * 2' };
    expect(detachPlan(d, reg(), 'main', 'two')).toEqual({ error: 'time' });
    expect(detachPlan(d, reg(), 'main', 'plain')).not.toHaveProperty('error');
    d.compositions.card.layers.bg.props!.radius = { $expr: 'comp.width / 10' };
    expect(detachPlan(d, reg(), 'main', 'plain')).toEqual({ error: 'time' });
  });
});
