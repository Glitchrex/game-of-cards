'use client';
/**
 * Synthesized table sounds (WebAudio — no audio files are shipped).
 *
 * - The AudioContext is created lazily inside `unlockAudio()`, which must be
 *   called from a user gesture (AppEffects does this on the first pointer/key
 *   press; SoundToggle does it when the user unmutes).
 * - `playSound()` is a silent no-op on the server, in tests, while muted
 *   (settings store) or before audio was unlocked.
 * - Muting suspends the AudioContext (no idle audio thread draining the
 *   battery); unmuting from the sound toggle resumes it inside that gesture.
 */
import { useSettings } from '@/store/settings';

export type SoundName =
  'card' | 'flip' | 'shuffle' | 'deal' | 'coin' | 'win' | 'lose' | 'click' | 'error' | 'chip';

const IS_TEST = process.env.NODE_ENV === 'test';
const MASTER_GAIN = 0.32;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let unlocked = false;
const lastPlayed = new Map<SoundName, number>();

/** Minimum gap between two plays of the same sound (ms) so rapid events don't pile up. */
const MIN_GAP: Record<SoundName, number> = {
  card: 28,
  flip: 40,
  shuffle: 350,
  deal: 45,
  coin: 60,
  win: 900,
  lose: 900,
  click: 30,
  error: 150,
  chip: 40,
};

type AudioCtor = typeof AudioContext;

function audioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  if (typeof globalThis.AudioContext === 'function') return globalThis.AudioContext;
  return (window as Window & { webkitAudioContext?: AudioCtor }).webkitAudioContext ?? null;
}

/**
 * Create/resume the AudioContext. Call from a user gesture (click, key press).
 * Safe to call repeatedly.
 */
export function unlockAudio(): void {
  if (IS_TEST || typeof window === 'undefined') return;
  try {
    if (!ctx) {
      const Ctor = audioCtor();
      if (!Ctor) return;
      ctx = new Ctor({ latencyHint: 'interactive' });
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 10;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      master.connect(limiter).connect(ctx.destination);
      useSettings.subscribe((state, prev) => {
        if (!ctx || state.muted === prev.muted) return;
        if (state.muted && ctx.state === 'running') void ctx.suspend().catch(() => {});
      });
    }
    // 'suspended' — or Safari's 'interrupted' after a phone call.
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    // iOS Safari only "unlocks" after something is started inside the gesture.
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, 22050);
    blip.connect(ctx.destination);
    blip.start(0);
    unlocked = true;
  } catch {
    // Audio is a nice-to-have; never let it break the page.
    unlocked = false;
  }
}

/** Play a named sound if sound is on and audio has been unlocked. */
export function playSound(name: SoundName): void {
  if (IS_TEST || typeof window === 'undefined') return;
  if (!unlocked || !ctx || !master) return;
  if (useSettings.getState().muted) return;
  const nowMs = performance.now();
  if (nowMs - (lastPlayed.get(name) ?? -Infinity) < MIN_GAP[name]) return;
  lastPlayed.set(name, nowMs);
  try {
    // 'suspended' — or Safari's 'interrupted' after a phone call.
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    SYNTHS[name](ctx, master, ctx.currentTime + 0.01);
  } catch {
    // Ignore synthesis failures (e.g. context closed by the browser).
  }
}

/* ---------------------------------------------------------------------------
 * Synthesis building blocks
 * ------------------------------------------------------------------------- */

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const len = Math.floor(c.sampleRate);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noise = buf;
  return buf;
}

interface NoiseOpts {
  dur: number;
  freq: number;
  q?: number;
  type?: BiquadFilterType;
  gain?: number;
  attack?: number;
  sweepTo?: number;
}

/** Filtered white-noise burst: card flicks, riffles, chip clacks. */
function noiseBurst(c: AudioContext, out: AudioNode, t: number, o: NoiseOpts) {
  const { dur, freq, q = 1, type = 'bandpass', gain = 0.5, attack = 0.002, sweepTo } = o;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(out);
  src.start(t, Math.random() * 0.6, dur + 0.05);
}

interface ToneOpts {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  glideTo?: number;
  vibrato?: { rate: number; depth: number };
  /** Optional low-pass "wah": opens from `from` to `to` Hz over the note. */
  wah?: { from: number; to: number; q: number };
}

/** Enveloped oscillator note. */
function tone(c: AudioContext, out: AudioNode, t: number, o: ToneOpts) {
  const { freq, dur, type = 'sine', gain = 0.25, attack = 0.006, glideTo, vibrato, wah } = o;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let head: AudioNode = osc;
  if (wah) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = wah.q;
    lp.frequency.setValueAtTime(wah.from, t);
    lp.frequency.exponentialRampToValueAtTime(wah.to, t + dur * 0.45);
    lp.frequency.exponentialRampToValueAtTime(wah.from, t + dur);
    head.connect(lp);
    head = lp;
  }
  head.connect(env).connect(out);
  if (vibrato) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = vibrato.rate;
    depth.gain.value = vibrato.depth;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

type Synth = (c: AudioContext, out: AudioNode, t: number) => void;

const SYNTHS: Record<SoundName, Synth> = {
  /** A single card snapped onto felt. */
  card: (c, out, t) => {
    noiseBurst(c, out, t, { dur: 0.05, freq: 3200, q: 0.9, gain: 0.55 });
    noiseBurst(c, out, t + 0.004, { dur: 0.035, freq: 850, q: 1.3, gain: 0.22 });
  },
  /** Card turned over: two quick flicks. */
  flip: (c, out, t) => {
    noiseBurst(c, out, t, { dur: 0.035, freq: 2200, q: 1.4, gain: 0.38 });
    noiseBurst(c, out, t + 0.055, { dur: 0.045, freq: 3800, q: 1, gain: 0.48 });
  },
  /** Riffle shuffle: a fast run of tiny flicks, then the deck squared up. */
  shuffle: (c, out, t) => {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const at = t + i * 0.026 + Math.random() * 0.008;
      noiseBurst(c, out, at, {
        dur: 0.022,
        freq: 2400 + Math.random() * 1800,
        q: 1.2,
        gain: 0.14 + Math.random() * 0.12,
      });
    }
    noiseBurst(c, out, t + n * 0.026 + 0.05, { dur: 0.06, freq: 1100, q: 0.9, gain: 0.32 });
  },
  /** Dealt card sliding across the table. */
  deal: (c, out, t) => {
    noiseBurst(c, out, t, {
      dur: 0.11,
      freq: 1200,
      sweepTo: 4800,
      q: 0.7,
      gain: 0.3,
      attack: 0.02,
    });
    noiseBurst(c, out, t + 0.1, { dur: 0.035, freq: 1800, q: 1.1, gain: 0.32 });
  },
  /** Coin chime: two bright partials with a metallic tick. */
  coin: (c, out, t) => {
    noiseBurst(c, out, t, { dur: 0.015, freq: 7000, type: 'highpass', q: 0.7, gain: 0.12 });
    tone(c, out, t, { freq: 1567.98, dur: 0.32, gain: 0.2, attack: 0.002 });
    tone(c, out, t, { freq: 4186, dur: 0.08, gain: 0.04, attack: 0.002 });
    tone(c, out, t + 0.065, { freq: 2093, dur: 0.55, gain: 0.19, attack: 0.002 });
    tone(c, out, t + 0.065, { freq: 2637, dur: 0.18, gain: 0.05, attack: 0.002 });
  },
  /** Gentle UI tick. */
  click: (c, out, t) => {
    tone(c, out, t, { freq: 1320, dur: 0.04, gain: 0.14, attack: 0.002 });
    noiseBurst(c, out, t, { dur: 0.012, freq: 5200, type: 'highpass', gain: 0.08 });
  },
  /** Soft "nope" — two low, muted notes. */
  error: (c, out, t) => {
    tone(c, out, t, {
      freq: 233.08,
      dur: 0.13,
      type: 'square',
      gain: 0.07,
      wah: { from: 900, to: 1400, q: 1 },
    });
    tone(c, out, t + 0.15, {
      freq: 174.61,
      dur: 0.22,
      type: 'square',
      gain: 0.07,
      wah: { from: 800, to: 1100, q: 1 },
    });
  },
  /** Poker chips clacking onto the pile. */
  chip: (c, out, t) => {
    noiseBurst(c, out, t, { dur: 0.022, freq: 4200, q: 3, gain: 0.45 });
    tone(c, out, t, { freq: 2650, dur: 0.045, type: 'triangle', gain: 0.1, attack: 0.001 });
    noiseBurst(c, out, t + 0.055, { dur: 0.02, freq: 3700, q: 3, gain: 0.32 });
    tone(c, out, t + 0.055, { freq: 2380, dur: 0.04, type: 'triangle', gain: 0.07, attack: 0.001 });
  },
  /** Short brassy fanfare: C–E–G–C with a held, shimmering top note. */
  win: (c, out, t) => {
    const notes: Array<[number, number, number]> = [
      [523.25, 0, 0.14],
      [659.25, 0.11, 0.14],
      [783.99, 0.22, 0.16],
      [1046.5, 0.34, 0.62],
    ];
    for (const [freq, at, dur] of notes) {
      const last = at > 0.3;
      tone(c, out, t + at, {
        freq,
        dur,
        type: 'triangle',
        gain: last ? 0.24 : 0.2,
        attack: 0.01,
        vibrato: last ? { rate: 5.5, depth: 5 } : undefined,
      });
      tone(c, out, t + at, {
        freq: freq * 2,
        dur: dur * 0.8,
        type: 'square',
        gain: 0.025,
        attack: 0.01,
      });
    }
    tone(c, out, t + 0.42, { freq: 2093, dur: 0.3, gain: 0.06, attack: 0.002 });
    tone(c, out, t + 0.5, { freq: 2637, dur: 0.35, gain: 0.05, attack: 0.002 });
  },
  /** Deflating "wah-wah" trombone — gentle, never harsh. */
  lose: (c, out, t) => {
    const notes: Array<[number, number, number]> = [
      [392.0, 0, 0.28],
      [369.99, 0.3, 0.28],
      [349.23, 0.6, 0.28],
    ];
    for (const [freq, at, dur] of notes) {
      tone(c, out, t + at, {
        freq,
        dur,
        type: 'sawtooth',
        gain: 0.1,
        attack: 0.03,
        wah: { from: 380, to: 1500, q: 5 },
      });
    }
    tone(c, out, t + 0.9, {
      freq: 329.63,
      glideTo: 300,
      dur: 0.75,
      type: 'sawtooth',
      gain: 0.1,
      attack: 0.03,
      vibrato: { rate: 6, depth: 7 },
      wah: { from: 360, to: 1300, q: 5 },
    });
  },
};
