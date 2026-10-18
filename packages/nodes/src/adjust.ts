// The adjustment layer: it draws nothing of its own — what is under it in the
// stack is run once more through its effects (a colour grade over a whole
// scene, one blur for a set of layers). The effects are the usual ones; the
// compositing happens in the canvas backend (canvas2d.ts), only when a
// composition holds such a layer.

import type { NodeType } from '@tramme/core';

export const adjust: NodeType = {
  type: 'adjust', title: 'Adjustment', category: 'Structure',
  description: 'applies its effects to everything under it in the stack',
  ai: { when: 'a correction or an effect that must reach every layer under it at once (a grade over a scene, one blur for a set)' },
  props: {},
  render: {},
};
