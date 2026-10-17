import { describe, expect, it } from 'vitest';
import { applyOps, validate, type TrammeDoc } from '@tramme/core';
import { newProject } from '@tramme/project';
import { builtinRegistry } from '@tramme/nodes';
import { CAMERAS, compileFilm, ELEMENTS, FAMILIES, filmGuide, filmOps, filmTarget, FORMATS, LAYOUTS, PRESETS, textWidth, TREATMENTS, wrap } from '../src/index.ts';
import { BACKGROUNDS, TRANSITIONS } from '../src/style.ts';

/** a film without its sound, where the sound is not what is tested */
const QUIET = { bed: false, effects: false };
const ASSETS = { shot: { type: 'image', src: 'assets/shot.png' }, logo: { type: 'image', src: 'assets/logo.png' }, brandfont: { type: 'font', src: 'assets/brand.ttf', family: 'Brand Sans' }, song: { type: 'audio', src: 'assets/song.wav' } };

/** every element, with the fields a model would write */
const EVERY_ELEMENT = [
  { type: 'figure', value: '10 ms', label: 'to fill an order', context: 'median, September' },
  { type: 'chart', kind: 'line', data: [3, 5, 4, 8, 12], title: 'Revenue', value: '$4.2M', delta: '+18%' },
  { type: 'chart', kind: 'bars', data: [12, 30, 45], labels: ['2022', '2023', '2024'] },
  { type: 'chart', kind: 'candles', data: [10, 11, 10.5, 12, 13, 12.4, 14] },
  { type: 'ui', ui: { title: 'BTC / USDT', subtitle: 'Live', items: [
    { kind: 'chart', label: 'Last price', value: '$67,420', delta: '+2.4%', data: [1, 3, 2, 5, 4, 6] },
    { kind: 'row', title: 'Bitcoin', sub: 'BTC', icon: 'coin', value: '$67,420', delta: '+2.4%', badge: 'Hot' },
    { kind: 'stats', items: [{ label: 'Volume', value: '$1.2B' }, { label: 'Trades', value: '48,210' }] },
    { kind: 'input', text: 'velo' }, { kind: 'tabs', items: ['1H', '1D', '1W'], active: 1 },
    { kind: 'progress', label: 'Syncing', value: 0.7 }, { kind: 'chat', text: 'Filled!', from: 'me' }, { kind: 'text', text: 'All markets, one screen.' },
    { kind: 'button', text: 'Buy', icon: 'bolt' }, { kind: 'toast', text: 'Order filled', value: '0.01s' },
  ] } },
  { type: 'device', device: 'phone', ui: { title: 'Wallet', items: [{ kind: 'row', title: 'Savings', value: '$2,400' }, { kind: 'button', text: 'Send' }] } },
  { type: 'device', device: 'browser', ui: { items: [{ kind: 'input', text: 'a launch film' }, { kind: 'toast', text: 'Ready' }] } },
  { type: 'device', device: 'window', image: 'shot' },
  { type: 'code', title: 'film.json', lines: ['{', '  "concept": "light first",', '  "seed": 3', '}'] },
  { type: 'logo', tagline: 'Trade at the speed of light' },
  { type: 'list', style: 'steps', items: [{ title: 'Connect', icon: 'link' }, { title: 'Set a rule', text: 'Once.' }, 'Get paid'] },
  { type: 'list', style: 'checks', items: ['Layers', 'Tokens', 'MP4'] },
  { type: 'list', style: 'numbers', items: ['One', 'Two'] },
  { type: 'list', style: 'bullets', items: ['One', 'Two'] },
  { type: 'cards', items: [{ icon: 'bolt', title: 'Fast', text: 'Very.' }, { icon: 'shield', title: 'Safe', text: 'Audited.' }, { icon: 'nope', title: 'Clear' }] },
  { type: 'quote', quote: 'It cut our delivery errors by 63%', name: 'Amara Diallo', role: 'Head of Ops, Kora Foods', emphasis: ['63%'] },
  { type: 'button', text: 'Start trading', icon: 'arrow-right' },
  { type: 'image', image: 'shot', fit: 'cover' },
  ...['burst', 'frames', 'orbit', 'trail', 'field'].map((pattern) => ({ type: 'motif', pattern })),
];

/** a scene for each element, and through them every layout, camera, pass, ground and treatment */
const EVERY_SCENE = EVERY_ELEMENT.map((el, i) => ({
  layout: LAYOUTS[i % LAYOUTS.length], flip: i % 3 === 0, camera: CAMERAS[i % CAMERAS.length], transition: TRANSITIONS[i % TRANSITIONS.length], bg: BACKGROUNDS[i % BACKGROUNDS.length], beats: 4 + (i % 3) * 2,
  elements: [
    ...(i % 4 === 0 ? [{ type: 'text', role: 'kicker', text: 'New' }] : []),
    { type: 'text', text: i % 5 === 0 ? 'Make a launch' : 'Every scene, its own idea', treatment: TREATMENTS[i % TREATMENTS.length], emphasis: ['idea'], ...(TREATMENTS[i % TREATMENTS.length] === 'swap' ? { swap: ['teaser', 'report'] } : {}) },
    el,
  ],
}));

type Built = Extract<ReturnType<typeof compileFilm>, { build: unknown }>;
function built(input: unknown, o: Partial<Parameters<typeof compileFilm>[1]> = {}): Built {
  const r = compileFilm(input, { comp: 'main', assets: ASSETS, ...o });
  if ('issues' in r) throw new Error(r.issues.join('\n'));
  return r;
}
const docOf = ({ build }: Built): TrammeDoc => ({ schema: 'tramme/1', meta: { title: 'Film' }, tokens: build.tokens, assets: { ...ASSETS, ...build.assets } as unknown as TrammeDoc['assets'], compositions: build.compositions, root: build.comp });

describe('film', () => {
  it('builds every element, layout, treatment, camera, pass and ground into a valid document, in every format and from every preset', () => {
    expect(new Set(['text', ...EVERY_ELEMENT.map((e) => e.type)])).toEqual(new Set(Object.keys(ELEMENTS)));
    const used = (k: 'layout' | 'camera' | 'transition' | 'bg') => new Set(EVERY_SCENE.map((s) => s[k]));
    expect([used('layout').size, used('camera').size, used('transition').size, used('bg').size]).toEqual([LAYOUTS.length, CAMERAS.length, TRANSITIONS.length, BACKGROUNDS.length]);
    expect(new Set(EVERY_SCENE.map((s) => (s.elements.find((e) => e.type === 'text' && 'treatment' in e) as { treatment: string }).treatment))).toEqual(new Set(TREATMENTS));
    for (const preset of Object.keys(PRESETS)) {
      for (const format of Object.keys(FORMATS)) {
        const r = built({ concept: 'every piece once', format, style: { preset }, brand: { name: 'Velo', url: 'velo.trade' }, music: QUIET, scenes: EVERY_SCENE });
        const issues = validate(docOf(r), builtinRegistry());
        expect(issues, `${preset} ${format}: ${issues.slice(0, 5).map((i) => `${i.path} ${i.message}`).join('; ')}`).toEqual([]);
      }
    }
  }, 60_000);

  it('cuts on the beat: the film lasts its beats at its tempo, each scene its own composition', () => {
    const r = built({ style: { transition: 'cut' }, music: { bpm: 120, ...QUIET }, scenes: [{ beats: 4, elements: [{ type: 'text', text: 'A' }] }, { beats: 6, elements: [{ type: 'figure', value: '9' }] }, { seconds: 2.5, elements: [{ type: 'logo' }] }] });
    expect(r.build.duration).toBe(7.5);
    const main = r.build.compositions.main;
    expect(main.markers?.map((m) => m.t)).toEqual([2, 5]);
    expect(Object.values(main.layers).filter((l) => l.type === 'comp').map((l) => [l.in, l.out, l.props?.comp])).toEqual([[0, 2, 'main-01'], [2, 5, 'main-02'], [5, 7.5, 'main-03']]);
    expect(r.build.scenes).toEqual([{ comp: 'main-01', at: 0, dur: 2 }, { comp: 'main-02', at: 2, dur: 3 }, { comp: 'main-03', at: 5, dur: 2.5 }]);
  });

  it('passes from scene to scene the way each asks: a dissolve plays both, an iris opens the next, a wipe covers the cut', () => {
    const scene = (transition: string) => ({ beats: 4, transition, elements: [{ type: 'text', text: transition }] });
    const r = built({ music: { bpm: 120, ...QUIET }, scenes: [scene('dissolve'), scene('iris'), scene('wipe'), scene('motif'), scene('cut')] });
    const main = r.build.compositions.main, comps = main.order.filter((id) => main.layers[id].type === 'comp').map((id) => main.layers[id]);
    expect(comps[0].out).toBe(2.5);
    expect(comps[1].out).toBe(4.6);
    expect(comps[2].clip).toMatch(/^pass-2-iris/);
    expect(main.order.filter((id) => id.startsWith('pass-')).length).toBeGreaterThanOrEqual(4);
    // the fast passes, and only them, get motion blur
    expect(main.motionBlur).toBeDefined();
    const still = built({ style: { transition: 'dissolve' }, music: QUIET, scenes: [scene('dissolve'), scene('cut')] });
    expect(still.build.compositions.main.motionBlur).toBeUndefined();
  });

  it('builds the same document from the same description, another take from another seed', () => {
    const film = { concept: 'x', style: { background: 'shapes', motif: 'circle' }, music: QUIET, scenes: EVERY_SCENE.slice(0, 6) };
    const a = built(film), b = built(film), c = built({ ...film, seed: 2 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(c.build.compositions)).not.toBe(JSON.stringify(a.build.compositions));
    expect(c.build.duration).toBe(a.build.duration);
  });

  it('derives the art direction: a palette from the brand, the faces it names, readable colours', () => {
    const dark = built({ brand: { colors: ['#FF6F59'] }, style: { mode: 'dark', scheme: 'complement', display: 'Anton', text: 'Manrope' }, music: QUIET, scenes: [{ elements: [{ type: 'text', text: 'Loud' }] }] });
    expect(String(dark.build.tokens.accent.value).toUpperCase()).toBe('#FF6F59');
    expect(dark.build.assets['font-anton']).toMatchObject({ type: 'font', family: 'Anton' });
    expect(dark.build.files.map((f) => f.path)).toEqual(expect.arrayContaining(['assets/fonts/Anton.ttf', 'assets/fonts/Manrope.ttf']));
    // capitals for a face set in capitals
    const words = Object.values(dark.build.compositions['main-01'].layers).filter((l) => l.type === 'text').map((l) => l.props?.text);
    expect(words).toContain('LOUD');
    // a pale accent on a light ground is darkened until it reads
    const light = built({ brand: { colors: ['#FFE066'] }, style: { mode: 'light' }, music: QUIET, scenes: [{ elements: [{ type: 'text', text: 'Sun' }] }] });
    expect(String(light.build.tokens.accent.value).toUpperCase()).not.toBe('#FFE066');
  });

  it('names every problem of a description so it can be fixed at once', () => {
    const r = compileFilm({ format: '3:2', mood: 'x', style: { motion: 'bouncy', display: 'Comic Sans' }, scenes: [{ layout: 'diagonal', elements: [{ type: 'slide', text: 'x' }] }, { elements: [{ type: 'text' }] }, { bg: 'stars', elements: [{ type: 'figure', value: 9, colour: 'red' }] }] }, { comp: 'main' });
    expect('issues' in r && r.issues).toEqual(expect.arrayContaining([
      expect.stringContaining('unknown key "mood"'),
      expect.stringContaining('format "3:2"'),
      expect.stringContaining('style.motion "bouncy"'),
      expect.stringContaining('style.display "Comic Sans"'),
      expect.stringContaining('scenes[0].layout "diagonal"'),
      expect.stringContaining('scenes[0].elements[0].type "slide"'),
      expect.stringContaining('scenes[1].elements[0] (text): "text" is required'),
      expect.stringContaining('scenes[2].bg "stars"'),
      expect.stringContaining('scenes[2].elements[0].value'),
      expect.stringContaining('unknown field "colour"'),
    ]));
  });

  it('takes the brand: its logo and its font as assets of the project', () => {
    const r = built({ brand: { name: 'Kora', colors: ['#FF6F59'], logo: 'logo', font: 'brandfont' }, music: QUIET, scenes: [{ elements: [{ type: 'text', text: 'Hi' }] }, { elements: [{ type: 'logo' }] }] });
    const layers = Object.values(r.build.compositions).flatMap((c) => Object.values(c.layers));
    expect(layers.some((l) => l.type === 'image' && l.props?.image === 'logo')).toBe(true);
    expect(layers.some((l) => l.type === 'text' && l.props?.font === 'brandfont')).toBe(true);
    const missing = compileFilm({ brand: { logo: 'nope' }, scenes: [{ elements: [{ type: 'logo' }] }] }, { comp: 'main', assets: ASSETS });
    expect('issues' in missing && missing.issues[0]).toContain('brand.logo');
  });

  it('sounds: a bed in the tempo and mood of the film, a whoosh under each fast pass, the moments of the scenes, every file a WAV', () => {
    const film = { style: { transition: 'push' }, music: { bpm: 120 }, scenes: [{ beats: 2, elements: [{ type: 'text', text: 'Hello' }] }, { beats: 2, transition: 'cut', elements: [{ type: 'logo', name: 'Velo' }] }, { beats: 6, elements: [{ type: 'button', text: 'Go' }] }] };
    const { build } = built(film);
    const { made, compositions, assets } = build;
    expect(made.map((f) => f.path).sort()).toEqual(['assets/film/music.wav', 'assets/film/sfx-click.wav', 'assets/film/sfx-impact.wav', 'assets/film/sfx-whoosh.wav']);
    for (const f of made) expect(new TextDecoder().decode(f.data.slice(0, 4)) + new TextDecoder().decode(f.data.slice(8, 12))).toBe('RIFFWAVE');
    // the bed lasts the film and its tail (44.1 kHz, stereo, 16 bits)
    const music = made.find((f) => f.path.endsWith('music.wav'))!;
    expect((music.data.length - 44) / 4 / 44100).toBeCloseTo(5 + 2.5, 1);
    const audio = Object.values(compositions.main.layers).filter((l) => l.type === 'audio');
    // a whoosh into the push, none into the cut
    expect(audio.filter((l) => l.props?.audio === 'film-sfx-whoosh').map((l) => l.in)).toEqual([0.68]);
    expect(audio.filter((l) => l.props?.audio === 'film-sfx-impact')).toHaveLength(1);
    expect(assets['film-music'].type).toBe('audio');
    // the same description, the same sound; another mood, another song
    expect(built(film).build.made[0].data).toEqual(made[0].data);
    const calm = built({ ...film, music: { bpm: 120, mood: 'calm', effects: false } });
    expect(calm.build.made[0].data).not.toEqual(made[0].data);
    // a film with its own music, and none made
    const own = built({ music: { asset: 'song', effects: false }, scenes: [{ elements: [{ type: 'text', text: 'A' }] }] });
    expect(own.build.made).toEqual([]);
  }, 60_000);

  it('builds again into the film it made, and beside the compositions of the user', () => {
    const { doc } = newProject({ name: 'T', width: 1920, height: 1080, fps: 30, duration: 10 });
    const where = filmTarget(doc);
    expect(where).toEqual({ comp: 'main', root: false });
    // its scenes, its passes, its effects: still the film's own composition
    const r = compileFilm({ style: { transition: 'wipe' }, music: { bed: false }, scenes: [{ beats: 2, elements: [{ type: 'text', text: 'A' }] }, { beats: 2, elements: [{ type: 'text', text: 'B' }] }] }, { comp: where.comp });
    if ('issues' in r) throw new Error(r.issues.join('\n'));
    const once = applyOps(doc, filmOps(doc, r.build, where)).doc;
    expect(Object.keys(once.compositions.main.layers).some((id) => id.startsWith('pass-'))).toBe(true);
    expect(filmTarget(once)).toEqual({ comp: 'main', root: false });
    expect(validate(once, builtinRegistry())).toEqual([]);
    // fewer scenes the second time: the one gone is removed
    const shorter = compileFilm({ music: QUIET, scenes: [{ elements: [{ type: 'text', text: 'A' }] }] }, { comp: 'main' });
    if ('issues' in shorter) throw new Error(shorter.issues.join('\n'));
    const twice = applyOps(once, filmOps(once, shorter.build, filmTarget(once))).doc;
    expect(Object.keys(twice.compositions).sort()).toEqual(['main', 'main-01']);
    // a composition the user filled: the film goes into one of its own, made the root
    const own = applyOps(doc, [{ op: 'add', path: '/compositions/main/layers/x', value: { type: 'shape.rect', props: {} } }, { op: 'add', path: '/compositions/main/order/-', value: 'x' }]).doc;
    expect(filmTarget(own)).toEqual({ comp: 'film', root: true });
  });

  it('reviews the film like an art director: what repeats, what cannot be read, what the build gave up', () => {
    const same = { layout: 'center', elements: [{ type: 'text', text: 'One idea' }] };
    const rough = built({ brand: { name: 'Kora' }, music: QUIET, scenes: [same, same, same, same, { beats: 2, elements: [{ type: 'text', text: 'Far too many words for a scene this short to be read by anyone at all' }] }] });
    const notes = rough.build.notes.join('\n');
    expect(notes).toContain('no concept');
    expect(notes).toContain('scenes 1 to 5 all use the layout center');
    expect(notes).toContain('every headline enters the same way');
    expect(notes).toContain('scene 5: 16 words in 1.0 s, too fast to read');
    expect(notes).toContain('a headline of 16 words');
    expect(notes).toContain('does not end on the brand');
    expect(rough.build.summary).toContain('To look at:');
    const clean = built({ concept: 'a figure that grows into the story', brand: { name: 'Kora' }, music: QUIET, scenes: [
      { layout: 'poster', beats: 4, elements: [{ type: 'text', text: 'Ten times faster', treatment: 'letters' }] },
      { layout: 'left', beats: 8, elements: [{ type: 'text', text: 'Orders fill in 10 ms' }, { type: 'figure', value: '10 ms', label: 'to fill an order' }] },
      { layout: 'full', beats: 12, elements: [{ type: 'text', text: 'Watch it', size: 's' }, { type: 'ui', ui: { items: [{ kind: 'row', title: 'BTC', value: '$67,420' }] } }] },
      { layout: 'center', beats: 8, elements: [{ type: 'logo', tagline: 'Trade faster' }] },
    ] });
    expect(clean.build.notes).toEqual([]);
  });

  it('measures text the way Chrome draws it, in every shipped face, and wraps it', () => {
    expect(textWidth('Introducing', 100, 500)).toBeGreaterThan(450);
    expect(textWidth('Introducing', 100, 800)).toBeGreaterThan(textWidth('Introducing', 100, 400));
    expect(wrap('A live order book, not a delayed one', 600, 70, 560)).toHaveLength(2);
    // a condensed face is narrower than a wide one
    expect(textWidth('Manifesto', 100, 400, 'Anton')).toBeLessThan(textWidth('Manifesto', 100, 700, 'Syne'));
    for (const f of FAMILIES) expect(textWidth('Hamburgefonts', 100, f.regular, f.name), f.name).toBeGreaterThan(300);
  });

  it('has a guide naming the whole vocabulary, with a starting hand drawn at random', () => {
    const g = filmGuide(1);
    for (const k of [...LAYOUTS, ...CAMERAS, ...TREATMENTS, ...TRANSITIONS, ...BACKGROUNDS, ...Object.keys(PRESETS), ...FAMILIES.map((f) => f.name)]) expect(g).toContain(k);
    for (const [type, e] of Object.entries(ELEMENTS)) { expect(g).toContain(`${type}:`); for (const f of Object.keys(e.fields)) expect(g).toContain(f); }
    const hands = new Set([1, 2, 3, 4, 5, 6].map((s) => filmGuide(s).split('\n').find((l) => l.includes('structure:'))));
    expect(hands.size).toBeGreaterThanOrEqual(4);
  });
});
