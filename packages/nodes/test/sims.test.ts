import { describe, expect, it } from 'vitest';
import type { Host, NodeType } from '@tramme/core';
import { rope } from '../src/rope.ts';
import { cloth } from '../src/cloth.ts';
import { flock } from '../src/flock.ts';
import { follow } from '../src/follow.ts';

const host = (t: number): Host => ({ layerId: 'l', layerIn: 0, t, frame: Math.round(t * 30), fps: 30, width: 1920, height: 1080, duration: 10, layer: () => ({ props: {}, transform: { anchor: [0, 0], position: [960, 540], scale: [1, 1], rotation: 0, opacity: 1 }, in: 0, out: 10 }) }) as unknown as Host;

const defaults = (n: NodeType<any>) => Object.fromEntries(Object.entries(n.props).map(([k, d]) => [k, (d as { default: unknown }).default]));

describe('the simulated nodes', () => {
  it('step to finite states and hold them a function of time (the same frames, the same picture)', () => {
    for (const node of [follow, rope, cloth, flock]) {
      const sim = node.simulate!, p = defaults(node);
      const run = () => {
        let s = sim.init(p as never, host(0));
        for (let f = 1; f <= 45; f++) s = sim.step(s, p as never, 1 / 30, host(f / 30));
        return s;
      };
      const a = run(), b = run();
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(JSON.stringify(a)).not.toMatch(/NaN/);
    }
  });

  it('keep the rope tied to the origin and of its length, and the cloth pinned along its top', () => {
    const rp = { ...defaults(rope), length: 400 };
    let s = rope.simulate!.init(rp as never, host(0)) as { pts: number[][] };
    for (let f = 1; f <= 90; f++) s = rope.simulate!.step(s, rp as never, 1 / 30, host(f / 30)) as { pts: number[][] };
    expect(s.pts[0]).toEqual([0, 0]);
    let span = 0;
    for (let i = 1; i < s.pts.length; i++) span += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
    expect(span).toBeGreaterThan(300); // sagged, but still a rope of its length
    expect(s.pts.every(([x, y]: number[]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);

    const cp = { ...defaults(cloth) };
    const c = cloth.simulate!.init(cp as never, host(0)) as { pts: number[][]; cols: number; rows: number };
    for (let f = 1; f <= 60; f++) cloth.simulate!.step(c, cp as never, 1 / 30, host(f / 30));
    for (let i = 0; i < c.cols; i++) expect(c.pts[i][1]).toBe(-180); // the top row never moved
    expect(c.pts[(c.rows - 1) * c.cols][1]).toBeGreaterThan(-170); // the body fell
  });

  it('keep the flock at its pace inside the frame, and the seed holding the same flock', () => {
    const fp = { ...defaults(flock), count: 40 };
    let s = flock.simulate!.init(fp as never, host(0)) as { pos: number[][]; vel: number[][] };
    const start = JSON.stringify(s.pos);
    for (let f = 1; f <= 120; f++) s = flock.simulate!.step(s, fp as never, 1 / 30, host(f / 30)) as { pos: number[][]; vel: number[][] };
    expect(s.pos.every(([x, y]) => x > -200 && x < 2120 && y > -200 && y < 1280)).toBe(true);
    expect(s.vel.every(([vx, vy]) => Math.abs(Math.hypot(vx, vy) - 140) < 1)).toBe(true);
    expect(JSON.stringify((flock.simulate!.init(fp as never, host(0)) as { pos: number[][] }).pos)).toBe(start);
  });
});
