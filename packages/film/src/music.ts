// The film's sound, made here in plain JavaScript (the same bytes in the
// editor and on the command line, from the same description): a music bed in
// the film's tempo and mood whose sections follow its scenes (an intro that
// holds back, the beat dropping on the first reveal, a breath before the end
// card), and the effects its pictures call for (a whoosh into a fast pass, a
// hit on each reveal, a click on a button, a pop for a notification, a tick
// when a figure lands). The seed picks the chords and the figure the lead
// plays: another take, another song. Deterministic: a seeded noise, no clock.

const SR = 44100;

/** what the picture does at a moment, for the effects */
export type CueKind = 'whoosh' | 'impact' | 'click' | 'pop' | 'tick';
export interface Cue { t: number; kind: CueKind }

/** the film as the music hears it */
export interface Score {
  bpm: number;
  duration: number;
  /** scene boundaries (s) */
  cuts: number[];
  /** the starts of the scenes that reveal (a logo, the motif bursting): the beat drops on the first */
  heroes: number[];
  /** where the end card starts (the music breathes out there), or the duration */
  end: number;
  /** driving and minor, bright and major, or calm: no drums, a soft pulse, open chords */
  mood: 'drive' | 'bright' | 'calm';
  /** the moments the picture's effects land on: the bed makes room for each, more for a reveal (hero) */
  hits?: { t: number; hero: boolean }[];
}

// ── tools of the trade ───────────────────────────────────────
/** a seeded noise source, the same sequence every time */
function noise(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
}

/** a second-order filter (RBJ's cookbook) */
class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0; private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  set(type: 'lowpass' | 'highpass' | 'bandpass', freq: number, q = 0.707) {
    const w = (2 * Math.PI * Math.min(freq, SR * 0.45)) / SR, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
    let b0: number, b1: number, b2: number;
    if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; }
    else if (type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * cos) / a0; this.a2 = (1 - alpha) / a0;
    return this;
  }
  run(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** a stereo buffer the voices add into */
class Track {
  L: Float32Array; R: Float32Array;
  constructor(seconds: number) { const n = Math.ceil(seconds * SR); this.L = new Float32Array(n); this.R = new Float32Array(n); }
  get length() { return this.L.length; }
  add(i: number, l: number, r = l) { if (i >= 0 && i < this.L.length) { this.L[i] += l; this.R[i] += r; } }
  mix(other: Track, gain: number) { for (let i = 0; i < this.L.length && i < other.L.length; i++) { this.L[i] += other.L[i] * gain; this.R[i] += other.R[i] * gain; } }
}

// ── voices ───────────────────────────────────────────────────
function kick(out: Track, t0: number, gain: number, rnd: () => number) {
  const i0 = Math.round(t0 * SR), n = Math.round(0.45 * SR);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 44 + 120 * Math.exp(-t * 30);
    phase += (2 * Math.PI * f) / SR;
    const body = Math.sin(phase) * Math.exp(-t * 6.5) * Math.min(1, t * 900);
    const click = t < 0.004 ? rnd() * 0.35 * (1 - t / 0.004) : 0;
    const v = Math.tanh((body + click) * 1.6) * gain;
    out.add(i0 + i, v);
  }
}

function hat(out: Track, t0: number, gain: number, open: boolean, rnd: () => number, pan: number) {
  const i0 = Math.round(t0 * SR), decay = open ? 9 : 55, n = Math.round((open ? 0.35 : 0.07) * SR);
  const hp = new Biquad().set('highpass', 7500, 0.9), bp = new Biquad().set('bandpass', 10500, 1.2);
  for (let i = 0; i < n; i++) {
    const t = i / SR, x = rnd(), v = (hp.run(x) * 0.6 + bp.run(x) * 0.6) * Math.exp(-t * decay) * gain;
    out.add(i0 + i, v * (1 - pan), v * (1 + pan));
  }
}

function clap(out: Track, t0: number, gain: number, rnd: () => number) {
  const i0 = Math.round(t0 * SR), n = Math.round(0.4 * SR), bp = new Biquad().set('bandpass', 1350, 1.1);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // three quick hands, then the room
    const burst = [0, 0.011, 0.022].reduce((e, d) => e + (t >= d ? Math.exp(-(t - d) * 160) : 0), 0) + Math.exp(-t * 16) * 0.55;
    const v = bp.run(rnd()) * burst * gain;
    out.add(i0 + i, v * 0.95, v * 1.05);
  }
}

function bass(out: Track, t0: number, dur: number, freq: number, gain: number) {
  const i0 = Math.round(t0 * SR), n = Math.round((dur + 0.06) * SR), lp = new Biquad().set('lowpass', 320, 0.9);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, env = Math.min(1, t * 200) * (t > dur ? Math.exp(-(t - dur) * 60) : 1) * (0.75 + 0.25 * Math.exp(-t * 8));
    p1 += freq / SR; p2 += (freq * 2) / SR;
    const saw = 2 * (p2 % 1) - 1;
    const v = (Math.sin(2 * Math.PI * p1) * 0.65 + lp.run(saw) * 0.45) * env * gain;
    out.add(i0 + i, v);
  }
}

function pad(out: Track, t0: number, dur: number, notes: number[], gain: number, cutoff: number) {
  const i0 = Math.round(t0 * SR), rel = 1.1, n = Math.round((dur + rel) * SR);
  const voices = notes.flatMap((m, k) => [-1, 1].map((side) => ({ f: midi(m) * 2 ** ((side * (6 + 2 * k)) / 1200), side, p: (k * 0.37 + (side + 1) * 0.21) % 1 })));
  const lpL = new Biquad(), lpR = new Biquad();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (i % 64 === 0) { const c = cutoff * (1 + 0.35 * Math.sin(2 * Math.PI * 0.11 * (t0 + t))); lpL.set('lowpass', c, 0.8); lpR.set('lowpass', c * 1.04, 0.8); }
    const env = Math.min(1, t / 0.7) * (t > dur ? Math.exp(-(t - dur) * (3 / rel)) : 1);
    let l = 0, r = 0;
    for (const v of voices) {
      v.p = (v.p + v.f / SR) % 1;
      const s = 2 * v.p - 1;
      if (v.side < 0) l += s; else r += s;
    }
    out.add(i0 + i, lpL.run(l) * env * gain, lpR.run(r) * env * gain);
  }
}

function pluck(out: Track, t0: number, freq: number, gain: number, bright: boolean, pan: number) {
  const i0 = Math.round(t0 * SR), n = Math.round(0.5 * SR), lp = new Biquad();
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (i % 32 === 0) lp.set('lowpass', 500 + (bright ? 5200 : 3200) * Math.exp(-t * 22), 1.4);
    p = (p + freq / SR) % 1;
    const tone = bright ? Math.sin(2 * Math.PI * p) * 0.7 + Math.sin(4 * Math.PI * p) * 0.25 : 2 * p - 1;
    const v = lp.run(tone) * Math.exp(-t * (bright ? 9 : 12)) * Math.min(1, t * 400) * gain;
    out.add(i0 + i, v * (1 - pan), v * (1 + pan));
  }
}

function riser(out: Track, t0: number, dur: number, gain: number, rnd: () => number) {
  const i0 = Math.round(t0 * SR), n = Math.round(dur * SR), bp = new Biquad();
  for (let i = 0; i < n; i++) {
    const t = i / SR, k = t / dur;
    if (i % 32 === 0) bp.set('bandpass', 350 * 18 ** k, 2.2);
    const v = bp.run(rnd()) * k ** 2.2 * gain;
    out.add(i0 + i, v * (1 - k * 0.5), v * (0.5 + k * 0.5));
  }
}

function boom(out: Track, t0: number, gain: number, rnd: () => number) {
  const i0 = Math.round(t0 * SR), n = Math.round(2.2 * SR), lp = new Biquad().set('lowpass', 1800, 0.8);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 38 + 34 * Math.exp(-t * 6);
    p += (2 * Math.PI * f) / SR;
    const v = (Math.sin(p) * Math.exp(-t * 2.2) + lp.run(rnd()) * Math.exp(-t * 9) * 0.5) * Math.min(1, t * 600) * gain;
    out.add(i0 + i, Math.tanh(v * 1.4));
  }
}

/** a room: Freeverb's combs and all-passes, wet only */
function reverb(src: Track, size = 0.82, damp = 0.3): Track {
  const out = new Track(src.length / SR);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
  for (const [ch, spread] of [[0, 0], [1, 23]] as const) {
    const input = ch ? src.R : src.L, dest = ch ? out.R : out.L;
    // flat arrays and plain counters: this loop runs eight combs and four all-passes per sample
    const cb = combs.map((d) => new Float32Array(d + spread)), ci = new Int32Array(combs.length), cf = new Float64Array(combs.length);
    const ab = aps.map((d) => new Float32Array(d + spread)), ai = new Int32Array(aps.length);
    for (let n = 0; n < input.length; n++) {
      const x = input[n] * 0.015;
      let y = 0;
      for (let k = 0; k < cb.length; k++) {
        const b = cb[k], i = ci[k], o = b[i];
        cf[k] = o * (1 - damp) + cf[k] * damp;
        b[i] = x + cf[k] * size;
        ci[k] = i + 1 === b.length ? 0 : i + 1;
        y += o;
      }
      for (let k = 0; k < ab.length; k++) {
        const b = ab[k], i = ai[k], o = b[i];
        b[i] = y + o * 0.5;
        ai[k] = i + 1 === b.length ? 0 : i + 1;
        y = o - y;
      }
      dest[n] = y;
    }
  }
  return out;
}

/** the louder of both sides brought to `peak`, a soft knee over the top */
function master(t: Track, peak = 0.89) {
  let max = 1e-9;
  for (let i = 0; i < t.length; i++) max = Math.max(max, Math.abs(t.L[i]), Math.abs(t.R[i]));
  const k = 1.15 / max;
  for (let i = 0; i < t.length; i++) { t.L[i] = Math.tanh(t.L[i] * k) * peak; t.R[i] = Math.tanh(t.R[i] * k) * peak; }
}

/** 16-bit PCM WAV */
export function wav(t: Track): Uint8Array {
  const n = t.length, data = n * 4, buf = new ArrayBuffer(44 + data), v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + data, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, data, true);
  for (let i = 0, o = 44; i < n; i++, o += 4) {
    v.setInt16(o, Math.max(-1, Math.min(1, t.L[i])) * 32767, true);
    v.setInt16(o + 2, Math.max(-1, Math.min(1, t.R[i])) * 32767, true);
  }
  return new Uint8Array(buf);
}

// ── the bed ──────────────────────────────────────────────────
/** progressions of four chords of two bars each, and the bass under them, by mood: the seed picks one */
const HARMONY: Record<Score['mood'], { chords: number[][]; roots: number[] }[]> = {
  drive: [
    { chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]], roots: [33, 29, 36, 31] }, // Am7 Fmaj7 Cmaj7 G7
    { chords: [[52, 55, 59, 62], [48, 52, 55, 59], [55, 59, 62, 66], [50, 54, 57, 64]], roots: [28, 36, 31, 38] }, // Em7 Cmaj7 Gmaj7 Dadd9
    { chords: [[50, 53, 57, 60], [46, 50, 53, 57], [55, 58, 62, 65], [57, 62, 64, 67]], roots: [38, 34, 31, 33] }, // Dm7 Bbmaj7 Gm7 A7sus4
  ],
  bright: [
    { chords: [[60, 64, 67, 71], [55, 59, 62, 66], [57, 60, 64, 67], [53, 57, 60, 64]], roots: [36, 31, 33, 29] }, // Cmaj7 Gmaj7 Am7 Fmaj7
    { chords: [[50, 54, 57, 61], [57, 59, 61, 64], [59, 62, 66, 69], [55, 59, 62, 66]], roots: [38, 33, 35, 31] }, // Dmaj7 Aadd9 Bm7 Gmaj7
    { chords: [[53, 57, 60, 64], [48, 52, 55, 62], [50, 53, 57, 60], [46, 50, 53, 57]], roots: [29, 36, 38, 34] }, // Fmaj7 Cadd9 Dm7 Bbmaj7
  ],
  calm: [
    { chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], roots: [41, 40, 38, 36] }, // Fmaj7 Em7 Dm7 Cmaj7
    { chords: [[51, 55, 58, 62], [56, 60, 63, 67], [48, 51, 55, 58], [46, 51, 53, 58]], roots: [39, 44, 36, 34] }, // Ebmaj7 Abmaj7 Cm7 Bbsus4
  ],
};

/** the order the lead plays a chord's notes in: up, down, up and back, leaping */
const FIGURES = [[0, 1, 2, 3], [3, 2, 1, 0], [0, 2, 1, 3], [0, 3, 1, 2]];

/** the music under the film, as a stereo WAV */
export function musicBed(s: Score, seed = 1): Uint8Array {
  const rnd = noise(seed * 7919 + 17), beat = 60 / s.bpm, tail = 2.5;
  const total = s.duration + tail;
  const drums = new Track(total), bassT = new Track(total), padT = new Track(total), lead = new Track(total), fx = new Track(total);
  // the seed picks the progression, the figure of the lead and the key (from three semitones down to four up), each from its own bits
  const options = HARMONY[s.mood], picked = options[seed % options.length], figure = FIGURES[(seed >> 3) % FIGURES.length], key = ((seed >> 6) % 8) - 3;
  const h = { chords: picked.chords.map((c) => c.map((n) => n + key)), roots: picked.roots.map((r) => r + key) };
  const dark = s.mood === 'drive', calm = s.mood === 'calm';
  const drop = s.heroes.find((t) => t > beat * 2 && t < s.end - beat * 4) ?? s.cuts.find((t) => t >= s.duration * 0.15) ?? Math.min(s.duration * 0.25, s.end);
  const beats = Math.ceil(s.duration / beat);
  // the chords, two bars each, from the start to the very end (their release rings into the tail)
  for (let b = 0; b < beats; b += 8) {
    const k = (b / 8) % 4, t = b * beat, dur = Math.min(8 * beat, s.duration - t);
    const open = t >= drop && t < s.end;
    pad(padT, t, dur, h.chords[k], dark ? 0.07 : calm ? 0.065 : 0.055, open ? (dark ? 1500 : calm ? 1900 : 2600) : (dark ? 650 : calm ? 900 : 1100));
  }
  for (let b = 0; b < beats; b++) {
    const t = b * beat, k = Math.floor(b / 8) % 4, inBar = b % 4;
    const main = t >= drop && t < s.end, intro = t < drop, breath = main && t >= s.end - beat * 2;
    if (calm) {
      // a soft pulse on the bar, a long bass note, the lead in quarters ringing into the room
      if (main && !breath) {
        if (inBar === 0) { kick(drums, t, 0.3, rnd); bass(bassT, t, beat * 3.6, midi(h.roots[k]), 0.16); }
        if (b % 2 === 1) hat(drums, t + beat / 2, 0.035, false, rnd, 0.3);
        const notes = h.chords[k];
        pluck(lead, t, midi(notes[figure[b % 4]] + 12), 0.085, true, inBar % 2 ? 0.25 : -0.25);
      } else if (intro && t >= drop * 0.5 && b % 2 === 0) {
        pluck(lead, t, midi(h.chords[k][figure[(b / 2) % 4]] + 12), 0.05, true, 0);
      }
      continue;
    }
    if (main && !breath) {
      kick(drums, t, dark ? 0.82 : 0.62, rnd);
      if (inBar === 1 || inBar === 3) clap(drums, t, dark ? 0.32 : 0.26, rnd);
      hat(drums, t + beat / 2, dark ? 0.16 : 0.12, b % 8 === 7, rnd, 0.25);
      if (dark) hat(drums, t + beat * 0.75, 0.06, false, rnd, -0.3);
      // the bass in eighths, off the kick
      bass(bassT, t + beat / 2, beat * 0.42, midi(h.roots[k]), dark ? 0.3 : 0.22);
      if (!dark) bass(bassT, t, beat * 0.4, midi(h.roots[k]), 0.24);
      // an arpeggio over the second half of the main part
      if (t >= drop + (s.end - drop) * 0.4) {
        const notes = h.chords[k];
        for (let q = 0; q < 4; q++) pluck(lead, t + (q * beat) / 4, midi(notes[figure[(b * 4 + q) % 4]] + 12), dark ? 0.08 : 0.1, !dark, q % 2 ? 0.3 : -0.3);
      }
    } else if (intro && t >= drop * 0.45) {
      hat(drums, t + beat / 2, 0.07, false, rnd, 0.2);
    }
  }
  // a rise into the drop and into the end card (their hit is the picture's own effect)
  const lift = (at: number) => { const d = Math.min(beat * 8, at - 0.2); if (d > beat * 2) riser(fx, at - d, d, calm ? 0.14 : 0.32, rnd); };
  lift(drop);
  if (s.end < s.duration - beat) lift(s.end);
  // the kick ducks the bass and the pads: the beat breathes
  const duck = new Float32Array(drums.length);
  for (let b = 0; b < beats; b++) {
    const t = b * beat;
    if (!(t >= drop && t < s.end - beat * 2) || (calm && b % 4)) continue;
    const i0 = Math.round(t * SR), depth = calm ? 0.3 : 0.65;
    for (let i = 0; i < Math.round(beat * SR); i++) if (i0 + i < duck.length) duck[i0 + i] = Math.max(duck[i0 + i], depth * Math.exp(-(i / SR) * 11));
  }
  for (const tr of [bassT, padT]) for (let i = 0; i < tr.length; i++) { tr.L[i] *= 1 - duck[i]; tr.R[i] *= 1 - duck[i]; }
  const room = new Track(total);
  room.mix(padT, 0.6); room.mix(lead, calm ? 1.1 : 0.8); room.mix(fx, 0.5); room.mix(drums, 0.12);
  const out = new Track(total);
  out.mix(drums, 1); out.mix(bassT, 1); out.mix(padT, 1); out.mix(lead, 1); out.mix(fx, 1); out.mix(reverb(room), 1);
  // room for the picture's effects, as a mix engineer would make it: the bed dips under each hit (-6 dB, -9 under a reveal), in and out smoothly
  for (const h of s.hits ?? []) {
    const keep = h.hero ? 0.355 : 0.5, a = h.t - 0.08, full = h.t - 0.02, hold = h.t + 0.12, end = h.t + (h.hero ? 0.7 : 0.35);
    for (let i = Math.max(0, Math.round(a * SR)); i < Math.min(out.length, Math.round(end * SR)); i++) {
      const t = i / SR, x = t < full ? (t - a) / (full - a) : t < hold ? 1 : 1 - (t - hold) / (end - hold);
      const g = 1 - (1 - keep) * (0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x))));
      out.L[i] *= g; out.R[i] *= g;
    }
  }
  // the last seconds fade under the end card
  const fade0 = Math.round((s.duration - 1.2) * SR);
  for (let i = fade0; i < out.length; i++) { const g = Math.max(0, 1 - (i - fade0) / (SR * (1.2 + tail))); out.L[i] *= g; out.R[i] *= g; }
  master(out);
  return wav(out);
}

// ── the effects ──────────────────────────────────────────────
/** the moment of an effect's file that sits on its cue (s) */
export const PEAK: Record<CueKind, number> = { whoosh: 0.32, impact: 0.005, click: 0, pop: 0, tick: 0 };

/** one effect, as a stereo WAV */
export function effectSound(kind: CueKind, seed = 1): Uint8Array {
  const rnd = noise(seed * 104729 + kind.length * 31);
  if (kind === 'impact') { const t = new Track(2.4); boom(t, 0, 1, rnd); const r = reverb(t, 0.7); t.mix(r, 0.6); master(t, 0.9); return wav(t); }
  if (kind === 'whoosh') {
    const d = 0.62, t = new Track(d + 0.1), bp = new Biquad();
    for (let i = 0; i < Math.round(d * SR); i++) {
      const s = i / SR, k = s / d;
      if (i % 32 === 0) bp.set('bandpass', 260 + 2600 * Math.sin(Math.PI * Math.min(1, k * 1.05)), 1.3);
      const env = k < 0.52 ? (k / 0.52) ** 2 : Math.exp(-(k - 0.52) * 9);
      const v = bp.run(rnd()) * env;
      t.add(i, v * (1 - k * 0.8), v * (0.2 + k * 0.8));
    }
    master(t, 0.85);
    return wav(t);
  }
  const t = new Track(kind === 'pop' ? 0.45 : 0.12);
  if (kind === 'click') {
    const bp = new Biquad().set('bandpass', 2600, 2);
    for (let i = 0; i < Math.round(0.05 * SR); i++) { const s = i / SR, v = (Math.sin(2 * Math.PI * 1900 * s) * 0.5 + bp.run(rnd()) * 0.8) * Math.exp(-s * 140); t.add(i, v); }
  } else if (kind === 'pop') {
    let p = 0;
    for (let i = 0; i < Math.round(0.4 * SR); i++) {
      const s = i / SR, f = 520 + 520 * Math.exp(-s * 40);
      p += (2 * Math.PI * f) / SR;
      const chime = (Math.sin(2 * Math.PI * 1318.5 * s) + Math.sin(2 * Math.PI * 1975.5 * s) * 0.6) * Math.exp(-s * 9) * (s > 0.04 ? 0.25 : 0);
      t.add(i, Math.sin(p) * Math.exp(-s * 28) * 0.8 + chime);
    }
  } else {
    for (let i = 0; i < Math.round(0.08 * SR); i++) { const s = i / SR; t.add(i, Math.sin(2 * Math.PI * 1250 * s) * Math.exp(-s * 70) * 0.7); }
  }
  master(t, 0.8);
  return wav(t);
}
