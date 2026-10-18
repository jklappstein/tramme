import { describe, expect, it } from 'vitest';
import { applyOps, runChecks, validate, type ToolContext, type TrammeDoc } from '@tramme/core';
import { newProject } from '@tramme/project';
import { parseData, parseEvents, parseStops } from '../src/recipes.ts';
import { editorRegistry } from '../src/vocabulary.ts';

const reg = editorRegistry();
const project = (w = 1080, h = 1920) => newProject({ name: 'Recipes', width: w, height: h, fps: 30, duration: 12 }).doc;
const ctxOf = (doc: TrammeDoc, time = 1): ToolContext => ({ doc, compId: doc.root, time, selection: [], registry: reg } as unknown as ToolContext);
/** run a tool of the vocabulary and apply its operations */
function use(doc: TrammeDoc, name: string, input: Record<string, unknown>, time = 1): TrammeDoc {
  const out = reg.tool(name).tool.run(input, ctxOf(doc, time)) as { ops: never[] };
  return applyOps(doc, out.ops).doc;
}

describe('recipes', () => {
  it('read data written by hand', () => {
    expect(parseData('2022: 12, 2023: 30,5; 2024 = 45')).toEqual([{ label: '2022', value: 12 }, { label: '2023', value: 30 }, { label: '3', value: 5 }, { label: '2024', value: 45 }]);
    expect(parseData('3, 7')).toEqual([{ label: '1', value: 3 }, { label: '2', value: 7 }]);
    expect(parseData('Paris: 2.5\nLyon: 1.2')).toEqual([{ label: 'Paris', value: 2.5 }, { label: 'Lyon', value: 1.2 }]);
    expect(parseEvents('2020: Launch, 2022: Series B\n2024: Scale-up')).toEqual([{ label: '2020', text: 'Launch' }, { label: '2022', text: 'Series B' }, { label: '2024', text: 'Scale-up' }]);
    expect(parseStops('0.18,0.32 0.5,0.62 0.82,0.38')).toEqual([[0.18, 0.32], [0.5, 0.62], [0.82, 0.38]]);
  });

  for (const [w, h] of [[1080, 1920], [1920, 1080]]) {
    it(`lay out valid pieces that pass the checks (${w}×${h})`, async () => {
      let doc = project(w, h);
      doc = use(doc, 'kit', { kit: 'punchy' });
      doc = use(doc, 'kinetic-title', { text: 'Make every second count', style: 'pop', emphasis: 3, at: 0.5, duration: 3 });
      doc = use(doc, 'transition', { at: 4, style: 'bars' });
      doc = use(doc, 'bar-chart', { data: '2022: 12, 2023: 30, 2024: 45', title: 'Growth', unit: '%', at: 4.4, duration: 4 });
      doc = use(doc, 'stat', { value: '1,250', label: 'new members', at: 8.6, duration: 3 });
      expect(validate(doc, reg)).toEqual([]);
      const warnings = (await runChecks(doc, reg)).filter((i) => i.severity === 'warning');
      expect(warnings.map((i) => i.message)).toEqual([]);
    });
  }

  it('lay out the newer recipes one after another', async () => {
    let doc = newProject({ name: 'Recipes', width: 1920, height: 1080, fps: 30, duration: 24 }).doc;
    doc = { ...doc, assets: { ...doc.assets, pic1: { type: 'image', src: 'assets/pic1.png' }, pic2: { type: 'image', src: 'assets/pic2.png' } } };
    doc = use(doc, 'kit', { kit: 'punchy' });
    doc = use(doc, 'split-screen', { assets: ['pic1', 'pic2'], at: 0, duration: 2.5 });
    doc = use(doc, 'logo-reveal', { logo: 'pic1', name: 'Tramme', style: 'iris', at: 2.7, duration: 2 });
    doc = use(doc, 'kinetic-title', { text: 'Make every second count', style: 'pop', emphasis: 3, at: 4.9, duration: 3 });
    doc = use(doc, 'quote', { text: 'The best way to predict the future is to invent it', author: 'Alan Kay', emphasis: 7, at: 8, duration: 3 });
    doc = use(doc, 'list', { items: 'Plan, Build, Measure', title: 'How we work', marker: 'number', at: 11.2, duration: 3 });
    doc = use(doc, 'timeline', { data: '2020: Launch, 2022: Series B', title: 'The road', at: 14.4, duration: 3.5 });
    doc = use(doc, 'map-journey', { stops: '0.2,0.3 0.5,0.6 0.8,0.4', names: 'Paris, Lyon, Marseille', at: 18, duration: 4 });
    expect(validate(doc, reg)).toEqual([]);
    const warnings = (await runChecks(doc, reg)).filter((i) => i.severity === 'warning');
    expect(warnings.map((i) => i.message)).toEqual([]);
  });

  it('follow the style kit', () => {
    const doc = use(use(project(), 'kit', { kit: 'editorial' }), 'kinetic-title', { text: 'Hello world', emphasis: 2 });
    expect(doc.tokens.accent.value).toBe('#C2410C');
    expect(doc.compositions.main.background).toBe('@plate');
    const words = Object.values(doc.compositions.main.layers).filter((l) => l.type === 'text');
    expect(words.map((l) => l.props?.color)).toEqual(['@ink', '@accent']);
  });

  it('place a kinetic title as a group of words that leaves together', () => {
    const doc = use(project(), 'kinetic-title', { text: 'one two three four five six seven eight', at: 2 });
    const c = doc.compositions.main, group = Object.values(c.layers).find((l) => l.type === 'group')!;
    expect(group.children).toHaveLength(8);
    expect(group.in).toBe(2);
    // the words are children, not in the root stack
    expect(c.order).toHaveLength(1);
  });

  it('place a quote as its words, a mark and an author line', () => {
    const doc = use(use(project(), 'kit', { kit: 'editorial' }), 'quote', { text: 'one two three', author: 'Someone', emphasis: 2 });
    const c = doc.compositions.main, group = Object.values(c.layers).find((l) => l.type === 'group')!;
    expect(group.children).toHaveLength(5); // the mark, three words, the author
    const words = group.children!.map((id) => c.layers[id]);
    expect(words[1].props?.color).toBe('@ink');
    expect(words[2].props?.color).toBe('@accent');
  });

  it('tick a list in as one group of rows', () => {
    const doc = use(project(), 'list', { items: 'Plan, Build, Measure' });
    const c = doc.compositions.main, group = Object.values(c.layers).find((l) => l.type === 'group')!;
    expect(group.children).toHaveLength(6); // a tick and a text per row
    expect(group.children!.some((id) => c.layers[id].type === 'shape.path')).toBe(true);
  });

  it('draw a map journey with a revealed line and a dot riding it', () => {
    const doc = use(project(), 'map-journey', { stops: '0.2,0.3 0.5,0.6 0.8,0.4', names: 'Paris, Lyon, Marseille' });
    const c = doc.compositions.main;
    const path = Object.values(c.layers).find((l) => l.type === 'shape.path' && l.name?.includes('route'))!;
    expect(path.effects?.[0]?.props).toMatchObject({ source: 'journey-reveal', mode: 'alpha' });
    expect((path.props!.path as { v: unknown[][] }).v).toHaveLength(3);
    const dot = c.layers['journey-dot'];
    expect((dot.transform!.position as { $k: unknown[] }).$k).toHaveLength(3);
    expect(c.layers['journey-reveal'].visible).toBe(false);
  });

  it('split the frame into sliding panels', () => {
    let doc = project();
    doc = { ...doc, assets: { ...doc.assets, pic1: { type: 'image', src: 'assets/pic1.png' }, pic2: { type: 'image', src: 'assets/pic2.png' }, clip1: { type: 'video', src: 'assets/clip1.mp4' } } };
    doc = use(doc, 'split-screen', { assets: ['clip1', 'pic2'], at: 1, duration: 3 });
    const panels = Object.values(doc.compositions.main.layers).filter((l) => l.type === 'video' || l.type === 'image');
    expect(panels).toHaveLength(2);
    expect(panels[0].props?.muted).toBe(false);
    expect(panels[1].props?.muted).toBeUndefined();
  });

  it('refuse what they cannot lay out', () => {
    expect(() => use(project(), 'bar-chart', { data: 'nothing here' })).toThrow(/no value/);
    expect(() => use(project(), 'stat', { value: 'many' })).toThrow(/digits/);
    expect(() => use(project(), 'kit', { kit: 'nope' })).toThrow(/unknown kit/);
    expect(() => use(project(), 'map-journey', { stops: '0.5,0.5' })).toThrow(/two stops/);
    expect(() => use(project(), 'timeline', { data: 'nothing' })).toThrow(/two events/);
    expect(() => use(project(), 'list', { items: 'a,b,c,d,e,f,g,h,i' })).toThrow(/at most/);
    expect(() => use(project(), 'quote', { text: '   ' })).toThrow(/empty/);
  });
});
