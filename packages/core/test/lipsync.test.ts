import { describe, expect, it } from 'vitest';
import { mouthKeys, phonemes } from '../src/lipsync.ts';

describe('the mouth shapes of a word', () => {
  it('read the letters into the nine shapes', () => {
    expect(phonemes('boom')).toEqual(['mbp', 'u', 'mbp']);
    expect(phonemes('hello')[0]).toBe('d');
    expect(phonemes('flag')).toEqual(['fv', 'l', 'ai', 'd']);
    expect(phonemes('chat')).toEqual(['d', 'ai', 'd']);
    expect(phonemes('...')).toEqual(['closed']);
  });

  it('keep a French final e silent', () => {
    expect(phonemes('table', 'fr').at(-1)).toBe('l');
    expect(phonemes('table', 'en').at(-1)).toBe('e');
  });
});

describe('the mouth keys of a transcript', () => {
  const words = [
    { w: 'map', s: 1, e: 1.4 },
    { w: 'on', s: 1.7, e: 2 },
  ];

  it('share the word’s time over its shapes, close between the words and after the last one', () => {
    const keys = mouthKeys(words);
    expect(keys[0]).toEqual({ t: 1, v: 'mbp', ease: 'hold' });
    expect(keys[keys.length - 1]).toEqual({ t: 2.03, v: 'closed', ease: 'hold' });
    const closed = keys.filter((k) => k.v === 'closed');
    expect(closed).toHaveLength(2);
    expect(closed[0].t).toBeGreaterThan(1.4);
    expect(closed[0].t).toBeLessThan(1.7);
    expect(keys.map((k) => k.t)).toEqual([...keys.map((k) => k.t)].sort((a, b) => a - b));
    for (const k of keys) expect(k.ease).toBe('hold');
  });

  it('keeps a short word readable and closes after it', () => {
    const keys = mouthKeys([{ w: 'a', s: 5, e: 5.01 }]);
    expect(keys[0]).toEqual({ t: 5, v: 'ai', ease: 'hold' });
    expect(keys.at(-1)!.v).toBe('closed');
  });

  it('reads a language for the silent letters', () => {
    const keys = mouthKeys([{ w: 'table', s: 1, e: 1.5 }], { language: 'fr' });
    expect(keys.some((k) => k.v === 'e')).toBe(false);
  });
});
