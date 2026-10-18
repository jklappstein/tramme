// Ready-made layers of the add menu: a node with props, effects and motion
// already tuned. Effect stacks, below, apply several effects at once to the
// selected layers. Plugins add theirs (`presets` export) the same way.

import type { PresetType } from '@tramme/core';
import { m } from './i18n/index.ts';

export const EDITOR_PRESETS: PresetType[] = [
  {
    name: 'neon-title', title: 'Neon title', description: 'bright type with a cyan glow that flickers a little',
    layer: {
      type: 'text', transform: { opacity: { $v: 1, $mod: [{ type: 'wiggle', freq: 6, amp: 0.06, seed: 3 }] } },
      props: { text: 'NEON', size: 150, weight: 800, align: 'center', baseline: 'middle', color: '#F2FBFF', tracking: 0.04 },
      effects: [{ id: 'glow', type: 'fx.glow', props: { color: '#22D3EE', radius: 22, strength: 2 } }],
    },
  },
  {
    name: 'frosted-card', title: 'Frosted card', description: 'a translucent rounded card with a soft shadow, to set text on',
    layer: {
      type: 'shape.rect',
      props: { size: [720, 420], radius: 36, fill: 'rgba(255,255,255,0.08)', stroke: 'rgba(255,255,255,0.22)', strokeWidth: 2 },
      effects: [{ id: 'shadow', type: 'fx.shadow', props: { color: 'rgba(0,0,0,0.4)', blur: 40, offset: [0, 18] } }],
    },
  },
  {
    name: 'light-leak', title: 'Light leak', description: 'a warm glow that drifts slowly over the picture (add blending)',
    layer: {
      type: 'shape.ellipse', blend: 'add',
      transform: { opacity: 0.55, position: { $v: [540, 400], $mod: [{ type: 'wiggle', freq: 0.25, amp: 120, seed: 7 }] } },
      props: { size: [1400, 900], fill: { type: 'radial', center: [0, 0], radius: 700, stops: [[0, 'rgba(255,170,90,0.9)'], [0.5, 'rgba(255,90,60,0.35)'], [1, 'rgba(255,60,60,0)']] } },
    },
  },
  {
    name: 'spotlight', title: 'Spotlight', description: 'a soft circle of light that draws the eye (overlay blending)',
    layer: {
      type: 'shape.ellipse', blend: 'overlay',
      props: { size: [900, 900], fill: { type: 'radial', center: [0, 0], radius: 450, stops: [[0, 'rgba(255,255,255,0.75)'], [1, 'rgba(255,255,255,0)']] } },
    },
  },
  // effect stacks: pushed onto the selected layers at once
  {
    name: 'cinematic-tone', title: 'Cinematic tone', description: 'a filmic grade: a touch more contrast, colours held back, teal in the shadows', category: m('panel.effectStacks'),
    effects: [
      { type: 'fx.color', props: { contrast: 1.1, saturation: 0.92 } },
      { type: 'fx.tint', props: { color: '#0E3A4A', amount: 0.16 } },
    ],
  },
  {
    name: 'dreamy-glow', title: 'Dreamy glow', description: 'a soft white bloom that lifts the picture, a little brighter', category: m('panel.effectStacks'),
    effects: [
      { type: 'fx.glow', props: { color: '#FFFFFF', radius: 34, strength: 0.5 } },
      { type: 'fx.color', props: { brightness: 1.06 } },
    ],
  },
  {
    name: 'vhs', title: 'VHS', description: 'a worn tape look: loud colours, softened edges, a magenta drift', category: m('panel.effectStacks'),
    effects: [
      { type: 'fx.color', props: { saturation: 1.18, contrast: 0.96 } },
      { type: 'fx.blur', props: { radius: 1.6 } },
      { type: 'fx.tint', props: { color: '#FF3EF2', amount: 0.1 } },
    ],
  },
  {
    name: 'readable-title', title: 'Readable over anything', description: 'a soft dark shadow and a dark halo, so type holds over busy footage', category: m('panel.effectStacks'),
    effects: [
      { type: 'fx.shadow', props: { color: 'rgba(0,0,0,0.55)', blur: 18, offset: [0, 4] } },
      { type: 'fx.glow', props: { color: '#000000', radius: 12, strength: 0.35 } },
    ],
  },
];
