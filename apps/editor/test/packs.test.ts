// The shipped plugin packs: each module registers cleanly, every node
// validates with its default props, the simulations are deterministic, and
// the pure helpers (scales, layouts, contrast, retiming) answer as documented.

import { describe, expect, it } from 'vitest';
import { Registry, validate, type TrammeDoc, type ToolContext } from '@tramme/core';
import { builtinRegistry } from '@tramme/nodes';
import { newProject } from '@tramme/project';
import { niceMax, barSlots, linePoints, donutArcs, seriesOf } from '../../../plugins/charts.js';
import { charState, bounce, lineStart } from '../../../plugins/kinetic.js';
import { parseColor, lum, contrast, flashRate } from '../../../plugins/a11y.js';
import { sentencesOf, retimed } from '../../../plugins/localize.js';
import * as charts from '../../../plugins/charts.js';
import * as kinetic from '../../../plugins/kinetic.js';
import * as a11y from '../../../plugins/a11y.js';
import * as physics from '../../../plugins/physics.js';
import * as walkthrough from '../../../plugins/walkthrough.js';
import * as localize from '../../../plugins/localize.js';

// the packs are JavaScript on purpose: their shape is checked at runtime by Registry.use, which these tests run
const PACKS = [charts, kinetic, a11y, physics, walkthrough, localize] as unknown as import('@tramme/core').PluginModule[];

describe('the packs register', () => {
  it('each module registers into a registry without error', () => {
    for (const mod of PACKS) {
      const reg = new Registry().use(mod, mod.meta?.name ?? 'x');
      expect(reg.hasNode('chart.bar')).toBe(mod === charts);
      expect(reg.listChecks().length).toBeGreaterThanOrEqual((mod.checks ?? []).length);
    }
  });

  it('every node validates with its default props', () => {
    for (const mod of PACKS) {
      const reg = builtinRegistry().clone().use(mod, mod.meta?.name ?? 'x');
      for (const node of mod.nodes ?? []) {
        const { doc } = newProject({ name: 'T', width: 1000, height: 600, fps: 30, duration: 3 });
        const props = Object.fromEntries(Object.entries(node.props).map(([k, d]) => [k, d.default]));
        doc.compositions[doc.root].layers.a = { type: node.type, props } as never;
        doc.compositions[doc.root].order = ['a'];
        const issues = validate(doc, reg);
        expect(issues, `${node.type}: ${JSON.stringify(issues)}`).toEqual([]);
      }
    }
  });

  it('every tool and check is well formed and named', () => {
    for (const mod of PACKS) {
      for (const tool of mod.tools ?? []) expect(tool.description.length).toBeGreaterThan(10);
      for (const check of mod.checks ?? []) expect(check.description.length).toBeGreaterThan(10);
    }
  });
});

describe('charts', () => {
  it('the scale rounds up to a readable grid', () => {
    expect(niceMax(370)).toBe(400);
    expect(niceMax(0)).toBe(1);
    expect(niceMax(1200)).toBe(1500);
    expect(niceMax(-5)).toBe(1);
  });

  it('the bars sit centred in their slots', () => {
    const { slot, barW, x } = barSlots(400, 4);
    expect(slot).toBe(100);
    expect(barW).toBeCloseTo(62);
    expect(x(0)).toBeCloseTo(19);
    expect(x(3)).toBeCloseTo(319);
  });

  it('the line spans the plot, top at max', () => {
    const pts = linePoints(300, 100, [0, 50, 100], 100);
    expect(pts[0]).toEqual([0, 100]);
    expect(pts[2]).toEqual([300, 0]);
    expect(linePoints(300, 100, [], 1)).toEqual([]);
  });

  it('the donut slices sum to a full turn', () => {
    const arcs = donutArcs([1, 1, 2]);
    expect(arcs[0].share).toBeCloseTo(0.25);
    expect(arcs[2].a1 - arcs[0].a0).toBeCloseTo(Math.PI * 2);
    expect(arcs[0].a0).toBeCloseTo(-Math.PI / 2);
  });

  it('the data comes from the values, normalised', () => {
    expect(seriesOf({ values: [{ label: 'A', value: 1 }, { label: 'B', value: 'x' }] }, {} as never)).toEqual([{ label: 'A', value: 1 }]);
    expect(seriesOf({ values: null, data: 'd' }, { asset: () => ({ series: [{ label: 'X', value: 3 }] }) } as never)).toEqual([{ label: 'X', value: 3 }]);
  });
});

describe('kinetic type', () => {
  it('the characters land in their order and hold', () => {
    expect(charState('typewriter', 0, 0, 0).a).toBe(0);
    expect(charState('typewriter', 0.5, 0, 0).a).toBe(1);
    expect(charState('typewriter', 1, 0, 0).a).toBe(1);
    // the wave keeps breathing after it lands: it moves with the clock
    expect(charState('wave', 1, 0, 0).dy).not.toBe(charState('wave', 1, 0, 1.2).dy);
  });

  it('the scatter starts from a place and settles at rest, the same every time', () => {
    const a = charState('scatter', 0, 3, 0), b = charState('scatter', 0, 3, 0);
    expect(a).toEqual(b);
    expect(charState('scatter', 1, 3, 0)).toEqual({ a: 1, dx: 0, dy: 0, rot: 0 });
  });

  it('the drop bounces and settles at the baseline', () => {
    expect(bounce(0)).toBe(0);
    expect(bounce(1)).toBeCloseTo(1);
    const mid = charState('drop', 0.4, 0, 0);
    expect(mid.dy).toBeLessThan(0);
    expect(charState('drop', 1, 0, 0).dy).toBeCloseTo(0);
  });

  it('the lines start where their align says', () => {
    const widths = [10, 10, 10];
    expect(lineStart(widths, 0, 'left', 100)).toBe(0);
    expect(lineStart(widths, 0, 'center', 100)).toBe(35);
    expect(lineStart(widths, 0, 'right', 100)).toBe(70);
  });
});

describe('accessibility checks', () => {
  it('reads the colours it knows, refuses the ones it does not', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('#FF8800')).toEqual([255, 136, 0]);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30]);
    expect(parseColor('@ink')).toBeNull();
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBe(1);
    expect(contrast('#FFFFFF', '@ink')).toBeNull();
    expect(lum('#000000')).toBe(0);
  });

  it('counts the flashes of a series per second', () => {
    // on-off-on-off at 4 samples a second: 2 appearances a second
    const series = [0, 1, 0, 1, 0, 1, 0, 1, 0];
    expect(flashRate(series, 0.25)).toBeCloseTo(2);
    expect(flashRate([1, 1, 1], 0.25)).toBe(0);
  });
});

describe('localize', () => {
  const transcript = {
    version: 1 as const, duration: 4, language: 'en',
    words: [
      { w: 'One', s: 0, e: 0.5 }, { w: 'two.', s: 0.5, e: 1 },
      { w: 'Three,', s: 2, e: 2.5 }, { w: 'four!', s: 2.5, e: 3 },
    ],
  };

  it('cuts the transcript into sentences', () => {
    const lines = sentencesOf(transcript);
    expect(lines).toEqual([
      { s: 0, e: 1, text: 'One two.' },
      { s: 2, e: 3, text: 'Three, four!' },
    ]);
  });

  it('spreads the translation over the line it translates', () => {
    const out = retimed(sentencesOf(transcript), ['Un deux trois', 'Quatre !']);
    expect(out.words.map((w) => w.w)).toEqual(['Un', 'deux', 'trois', 'Quatre', '!']);
    expect(out.words[0].s).toBe(0);
    expect(out.words[2].e).toBeLessThanOrEqual(1);
    expect(out.words[3].s).toBeCloseTo(2);
    expect(out.duration).toBeGreaterThanOrEqual(3);
    // an empty translation still holds its slot
    const held = retimed(sentencesOf(transcript), ['', 'Quatre !']);
    expect(held.words[0].w).toBe('·');
  });

  it('the apply tool writes the asset and duplicates the captioning compositions', async () => {
    const mod = localize as { tools: { name: string; run: (i: never, c: ToolContext) => Promise<{ ops: unknown[]; text: string }> }[] };
    const apply = mod.tools.find((t) => t.name === 'localize-apply')!;
    const { doc } = newProject({ name: 'T', width: 1000, height: 600, fps: 30, duration: 4 });
    doc.assets.talk = { type: 'video', src: 'assets/video/talk.mp4' };
    doc.assets['transcription-talk'] = { type: 'json', src: 'assets/transcripts/talk.json' };
    doc.compositions.main.layers.cap = { type: 'captions', props: { transcript: 'transcription-talk' } } as never;
    doc.compositions.main.order = ['cap'];
    const written = new Map<string, string>();
    const ctx = {
      doc, compId: 'main', registry: builtinRegistry(), time: 0, selection: [],
      transcript: async () => transcript,
      writeFile: async (p: string, d: string | Blob) => { written.set(p, typeof d === 'string' ? d : ''); return p; },
      assetUrl: () => '', fileUrl: () => '', readText: async () => null, files: async () => [], signal: new AbortController().signal,
    } as unknown as ToolContext;
    const out = await apply.run({ transcript: 'transcription-talk', lang: 'fr', lines: ['Un deux.', 'Trois, quatre !'] } as never, ctx);
    const next = JSON.parse(JSON.stringify(doc)) as TrammeDoc;
    for (const op of out.ops as never[]) applyOp(next, op);
    expect(next.assets['transcription-talk-fr']).toBeDefined();
    expect(next.compositions['main-fr']?.name).toContain('fr');
    expect(next.compositions['main-fr']?.layers.cap?.props?.transcript).toBe('transcription-talk-fr');
    expect(written.has('assets/transcripts/transcription-talk-fr.json')).toBe(true);
  });
});

// the few patch operations the tests need, applied in place (add and replace both set)
function applyOp(doc: TrammeDoc, op: { op: string; path: string; value?: unknown }) {
  const parts = op.path.split('/').filter(Boolean);
  let container = doc as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) container = container[parts[i]] as Record<string, unknown>;
  container[parts[parts.length - 1]] = op.value;
}
