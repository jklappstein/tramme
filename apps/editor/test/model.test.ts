import { describe, expect, it } from 'vitest';
import type { Composition, TrammeDoc } from '@tramme/core';
import { contentEnd, describeOp } from '../src/model.ts';
import { passes } from '../src/ai/server.ts';

const comp = (layers: Composition['layers']): Composition => ({ name: 'Main', width: 1920, height: 1080, fps: 30, duration: 60, layers, order: Object.keys(layers) });

describe('where the content of a composition ends', () => {
  it('is the out point of its last layer', () => {
    expect(contentEnd(comp({ a: { type: 'text', out: 12 }, b: { type: 'image', in: 10, out: 20 } }))).toBe(20);
  });
  it('is the whole composition when a layer runs to its end', () => {
    expect(contentEnd(comp({ a: { type: 'text', out: 12 }, bg: { type: 'shape.rect' } }))).toBe(60);
  });
});

describe('a proposal line', () => {
  const doc = { assets: { refkit: { type: 'module', src: 'plugins/refkit.js', name: 'Reference kit' } }, plugins: ['charts'] } as unknown as TrammeDoc;
  it('names a file instead of showing its JSON', () => {
    const line = describeOp(doc, { op: 'add', path: '/assets/kit2', value: { type: 'module', src: 'plugins/kit2.js', name: 'Kit 2' } });
    expect(line).toContain('Kit 2');
    expect(line).not.toContain('{');
    expect(describeOp(doc, { op: 'replace', path: '/assets/refkit/src', value: 'plugins/x.js' })).toContain('Reference kit');
  });
  it('tells the plugins in use once the change is made', () => {
    expect(describeOp(doc, { op: 'add', path: '/plugins/-', value: 'refkit' })).toContain('charts, Reference kit');
    expect(describeOp(doc, { op: 'replace', path: '/plugins', value: ['refkit'] })).toContain('Reference kit');
    expect(describeOp(doc, { op: 'remove', path: '/plugins/0' })).not.toContain('charts');
  });
});

describe('a failure worth a new attempt', () => {
  it('is the network or a busy server', () => {
    for (const m of ['Failed to fetch', 'companion: HTTP 503', 'Overloaded', 'read ECONNRESET', 'stream ended before the answer', 'rate_limit_error: rate limit, retry soon']) expect(passes(m), m).toBe(true);
  });
  it('is never a quota, a plan or a key', () => {
    for (const m of ['You exceeded your current quota, please check your plan and billing details', 'Claude AI usage limit reached|1760000000', 'invalid x-api-key', 'HTTP 401', 'Please run /login', 'a property is missing']) expect(passes(m), m).toBe(false);
  });
});
