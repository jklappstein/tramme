import { describe, expect, it } from 'vitest';
import { addLayer, applyOps, validate } from '@tramme/core';
import { newProject } from '@tramme/project';
import { editorRegistry } from '../src/vocabulary.ts';

describe('presets', () => {
  const reg = editorRegistry();

  it('each one is a valid layer of a composition', () => {
    let { doc } = newProject({ name: 'Presets', width: 1080, height: 1080, fps: 30, duration: 4 });
    for (const { preset } of reg.listPresets().filter(({ preset }) => preset.layer)) {
      doc = applyOps(doc, addLayer(doc, 'main', preset.name, { ...preset.layer!, transform: { position: [540, 540], ...preset.layer!.transform } })).doc;
    }
    expect(Object.keys(doc.compositions.main.layers)).toEqual(['neon-title', 'frosted-card', 'light-leak', 'spotlight']);
    expect(validate(doc, reg)).toEqual([]);
  });

  it('come from plugins too, and a malformed one is refused', () => {
    const more = reg.clone().use({ presets: [{ name: 'dot', layer: { type: 'shape.ellipse' } }] }, 'mine');
    expect(more.listPresets().at(-1)).toMatchObject({ from: 'mine', preset: { name: 'dot' } });
    expect(() => reg.clone().use({ presets: [{ name: 'bad', layer: {} as never }] }, 'mine')).toThrow(/malformed preset/);
    expect(() => reg.clone().use({ presets: [{ name: 'bad' }] }, 'mine')).toThrow(/malformed preset/);
    expect(() => reg.clone().use({ presets: [{ name: 'bad', effects: [{ props: {} }] as never }] }, 'mine')).toThrow(/malformed preset/);
  });

  it('stack effects on the selected layers at once', () => {
    let { doc } = newProject({ name: 'Presets', width: 1080, height: 1080, fps: 30, duration: 4 });
    doc = applyOps(doc, addLayer(doc, 'main', 'text', { type: 'text', props: { text: 'Hi', size: 80 } })).doc;
    doc = applyOps(doc, addLayer(doc, 'main', 'rect', { type: 'shape.rect', props: { size: [400, 300] } })).doc;
    const [textId, rectId] = Object.keys(doc.compositions.main.layers);
    const stack = reg.listPresets().find(({ preset }) => preset.name === 'readable-title')!.preset;
    const ops = [textId, rectId].flatMap((id) => {
      const base = `/compositions/main/layers/${id}`;
      return [{ op: 'add' as const, path: `${base}/effects`, value: stack.effects!.map((e, i) => ({ id: `${e.type.split('.').pop()}-${i + 1}`, type: e.type, ...(e.props ? { props: e.props } : {}) })) }];
    });
    doc = applyOps(doc, ops).doc;
    expect(doc.compositions.main.layers[textId].effects).toHaveLength(2);
    expect(doc.compositions.main.layers[rectId].effects).toHaveLength(2);
    expect(doc.compositions.main.layers[textId].effects![0]).toMatchObject({ type: 'fx.shadow', props: { blur: 18 } });
    expect(validate(doc, reg)).toEqual([]);
    // the four built-in stacks only use effects the registry knows, with props it takes
    for (const { preset } of reg.listPresets().filter(({ preset }) => preset.effects)) {
      expect(preset.effects!.length).toBeGreaterThan(0);
      for (const e of preset.effects!) expect(reg.hasEffect(e.type)).toBe(true);
    }
  });

  it('give the rectangle a corner radius handle on its top edge', () => {
    const rect = reg.node('shape.rect');
    expect(rect.handles!({ size: [200, 100], radius: 20 })).toEqual([{ prop: 'radius', kind: 'distance', at: [80, -50], from: [100, -50] }]);
  });
});
