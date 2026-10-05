// @vitest-environment jsdom
import { useSettings } from '@/store/settings';
import { type SoundName } from './sound';

const ALL: SoundName[] = [
  'card',
  'flip',
  'shuffle',
  'deal',
  'coin',
  'win',
  'lose',
  'click',
  'error',
  'chip',
];

/* ------------------------------------------------------------------------
 * A tiny fake of the WebAudio graph: enough surface for the synths, and it
 * records every source node that gets started.
 * ---------------------------------------------------------------------- */

class FakeParam {
  value = 0;
  events: Array<[string, number, number]> = [];
  setValueAtTime(v: number, t: number) {
    this.events.push(['set', v, t]);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (v <= 0) throw new RangeError('exponential ramps need a positive target');
    this.events.push(['exp', v, t]);
    return this;
  }
}

class FakeNode {
  connections: unknown[] = [];
  connect<T>(target: T): T {
    this.connections.push(target);
    return target;
  }
}

class FakeSource extends FakeNode {
  buffer: unknown = null;
  type = 'sine';
  frequency = new FakeParam();
  started: number[] = [];
  stopped: number[] = [];
  constructor(
    private readonly ctx: FakeAudioContext,
    readonly kind: 'buffer' | 'osc',
  ) {
    super();
  }
  start(t = 0) {
    this.started.push(t);
    this.ctx.started.push(this);
  }
  stop(t = 0) {
    this.stopped.push(t);
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: 'running' | 'suspended' | 'closed' = 'suspended';
  currentTime = 1;
  sampleRate = 8000;
  destination = new FakeNode();
  started: FakeSource[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    return Object.assign(new FakeNode(), { gain: new FakeParam() });
  }
  createDynamicsCompressor() {
    return Object.assign(new FakeNode(), {
      threshold: new FakeParam(),
      knee: new FakeParam(),
      ratio: new FakeParam(),
      attack: new FakeParam(),
      release: new FakeParam(),
    });
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), {
      type: 'lowpass',
      Q: new FakeParam(),
      frequency: new FakeParam(),
    });
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return { sampleRate, length, getChannelData: () => data };
  }
  createBufferSource() {
    return new FakeSource(this, 'buffer');
  }
  createOscillator() {
    return new FakeSource(this, 'osc');
  }
}

/** Load a fresh copy of the module with the test guard off (as in a browser). */
async function loadSound() {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubGlobal('AudioContext', FakeAudioContext);
  const sound = await import('./sound');
  const { useSettings: settings } = await import('@/store/settings');
  return { ...sound, settings };
}

let clock = 0;

beforeEach(() => {
  FakeAudioContext.instances = [];
  clock = 10_000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('sound (test environment guard)', () => {
  it('never creates an AudioContext under NODE_ENV=test, muted or not', async () => {
    const ctor = vi.fn();
    vi.stubGlobal('AudioContext', ctor);
    const { playSound, unlockAudio } = await import('./sound');
    useSettings.setState({ muted: false });
    unlockAudio();
    for (const name of ALL) expect(() => playSound(name)).not.toThrow();
    expect(ctor).not.toHaveBeenCalled();
  });
});

describe('sound (browser behaviour, fake WebAudio)', () => {
  it('stays silent and creates nothing before unlockAudio()', async () => {
    const { playSound, settings } = await loadSound();
    settings.setState({ muted: false });
    for (const name of ALL) playSound(name);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('creates one context on unlock (resumed inside the gesture) and reuses it', async () => {
    const { unlockAudio } = await loadSound();
    unlockAudio();
    unlockAudio();
    expect(FakeAudioContext.instances).toHaveLength(1);
    const ctx = FakeAudioContext.instances[0]!;
    expect(ctx.resume).toHaveBeenCalled();
    // The iOS unlock blip: a 1-sample buffer started straight away.
    expect(ctx.started.filter((s) => s.kind === 'buffer')).toHaveLength(2);
  });

  it('synthesizes every named sound when unmuted, and nothing while muted', async () => {
    const { playSound, unlockAudio, settings } = await loadSound();
    settings.setState({ muted: true });
    unlockAudio();
    const ctx = FakeAudioContext.instances[0]!;
    const afterUnlock = ctx.started.length;

    for (const name of ALL) playSound(name);
    expect(ctx.started.length).toBe(afterUnlock);

    settings.setState({ muted: false });
    for (const name of ALL) {
      const before = ctx.started.length;
      expect(() => playSound(name)).not.toThrow();
      expect(ctx.started.length, `${name} starts at least one source`).toBeGreaterThan(before);
    }
    // Everything is scheduled slightly ahead of "now" so the attack isn't clipped.
    for (const src of ctx.started.slice(afterUnlock)) {
      expect(src.started[0]).toBeGreaterThanOrEqual(ctx.currentTime);
    }
  });

  it('throttles rapid repeats of the same sound but not different sounds', async () => {
    const { playSound, unlockAudio, settings } = await loadSound();
    settings.setState({ muted: false });
    unlockAudio();
    const ctx = FakeAudioContext.instances[0]!;

    const count = () => ctx.started.length;
    playSound('win');
    const afterFirst = count();
    clock += 100;
    playSound('win');
    expect(count()).toBe(afterFirst);
    playSound('coin');
    expect(count()).toBeGreaterThan(afterFirst);
    clock += 1_000;
    const beforeThird = count();
    playSound('win');
    expect(count()).toBeGreaterThan(beforeThird);
  });

  it('suspends the context when muted and resumes it on the next unlock', async () => {
    const { unlockAudio, settings } = await loadSound();
    settings.setState({ muted: false });
    unlockAudio();
    const ctx = FakeAudioContext.instances[0]!;
    await Promise.resolve();
    expect(ctx.state).toBe('running');

    settings.setState({ muted: true });
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(ctx.state).toBe('suspended');

    ctx.resume.mockClear();
    settings.setState({ muted: false });
    unlockAudio();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('never throws when the browser refuses to build the graph', async () => {
    const { playSound, unlockAudio, settings } = await loadSound();
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('NotAllowedError');
        }
      },
    );
    settings.setState({ muted: false });
    expect(() => unlockAudio()).not.toThrow();
    expect(() => playSound('card')).not.toThrow();
  });
});
