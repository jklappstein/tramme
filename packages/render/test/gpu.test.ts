import { describe, expect, it } from 'vitest';
import { nodeContext, resizeNode } from '../src/gpu.ts';

describe('the nodes’ WebGL2 service', () => {
  it('names what is missing when there is no WebGL2 (a bare runtime), and keeps one context per node type', () => {
    expect(() => nodeContext('test.model')).toThrow(/WebGL2 unavailable/);
    // a lost or missing context is not kept: the next call makes it again
    expect(() => resizeNode(nodeContext('test.model'), 10, 10)).toThrow(/WebGL2 unavailable/);
  });
});
