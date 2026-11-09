/**
 * Sound for Deckfall.
 *
 * The dungeon's ambience is built from real recordings made by NASA spacecraft (see
 * CREDITS.md): Saturn's radio emissions as the drone under everything, wind on Mars as
 * the air in the halls, and the Perseverance rover's metal creaks as things moving
 * somewhere you cannot see. Everything is slowed down, which is most of what makes it
 * sound like a place far underground.
 *
 * Short effects (blows, doors, the heartbeat, a legendary drop) are synthesised here,
 * so they cost no download.
 *
 * Browsers only allow sound after a tap, so nothing plays until `start()` is called from one.
 */

const LOOPS = {
  saturn: { file: 'ambience-saturn.mp3', rate: 0.72, gain: 0.5 },
  wind: { file: 'ambience-wind.mp3', rate: 0.8, gain: 0.22 },
  deep: { file: 'ambience-deep.mp3', rate: 0.9, gain: 0 },
} as const;

const STINGS = [
  'sting-metal-1.mp3',
  'sting-metal-2.mp3',
  'sting-metal-3.mp3',
  'sting-metal-4.mp3',
  'sting-metal-5.mp3',
  'sting-signal-1.mp3',
  'sting-signal-2.mp3',
  'sting-signal-3.mp3',
] as const;

export type Effect =
  | 'door'
  | 'hit'
  | 'crit'
  | 'hurt'
  | 'pickup'
  | 'talent'
  | 'whisper'
  | 'death'
  | 'potion'
  | 'craft'
  | 'smite'
  | 'drop';

export interface Mood {
  /** Current depth. Deeper is louder, lower and busier. */
  deck: number;
  /** Badly hurt: the heartbeat starts. */
  low: boolean;
  dead: boolean;
  /** In a sanctum: the drone drops away and nothing calls from down the hall. */
  safe: boolean;
}

type LoopName = keyof typeof LOOPS;

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private loops = new Map<LoopName, { source: AudioBufferSourceNode; gain: GainNode }>();
  private buffers = new Map<string, AudioBuffer>();
  private noise: AudioBuffer | null = null;
  private enabled = true;
  private mood: Mood = { deck: 1, low: false, dead: false, safe: false };
  private beatTimer: number | undefined;

  /** Call from a tap. Safe to call repeatedly. */
  start(): void {
    if (!this.enabled) return;
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 4);

    // One second of white noise, reused by every synthesised effect.
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    for (const name of Object.keys(LOOPS) as LoopName[]) void this.startLoop(name);
    for (const file of STINGS) void this.load(file);
    this.scheduleSting();
    this.applyMood();

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (this.enabled) void this.ctx.resume();
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!this.ctx) return;
    if (enabled) void this.ctx.resume();
    else void this.ctx.suspend();
  }

  setMood(mood: Mood): void {
    this.mood = mood;
    this.applyMood();
  }

  play(effect: Effect): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    switch (effect) {
      case 'door':
        this.hiss(t, 0.45, 2400, 300, 0.16);
        this.thump(t + 0.32, 70, 0.3, 0.3);
        break;
      case 'hit':
        this.hiss(t, 0.07, 1800, 900, 0.22);
        this.thump(t, 110, 0.12, 0.28);
        break;
      case 'crit':
        this.hiss(t, 0.1, 3200, 800, 0.3);
        this.thump(t, 90, 0.2, 0.4);
        this.tone(t + 0.02, 1320, 0.35, 0.07);
        break;
      case 'hurt':
        this.thump(t, 55, 0.3, 0.55);
        this.hiss(t, 0.18, 500, 120, 0.3);
        break;
      case 'potion':
        this.hiss(t, 0.25, 5000, 2500, 0.08);
        this.tone(t + 0.1, 220, 0.7, 0.06);
        break;
      case 'pickup':
        this.tone(t, 440, 0.25, 0.07);
        this.tone(t + 0.09, 466.16, 0.4, 0.06);
        break;
      case 'talent':
        // A minor second, slowly opening. Power, with something off about it.
        this.tone(t, 196, 1.4, 0.08);
        this.tone(t + 0.15, 207.65, 1.4, 0.07);
        this.tone(t + 0.5, 392, 1.1, 0.04);
        break;
      case 'craft':
        // Hammer on anvil: the blow, then the ring.
        this.thump(t, 160, 0.09, 0.4);
        this.hiss(t, 0.05, 4200, 2600, 0.25);
        this.tone(t + 0.01, 1480, 0.9, 0.07);
        this.tone(t + 0.01, 2210, 0.6, 0.03);
        break;
      case 'smite':
        // Everything at once, and low.
        this.thump(t, 70, 0.45, 0.7);
        this.hiss(t, 0.22, 2600, 300, 0.35);
        this.tone(t + 0.03, 196, 0.8, 0.09);
        break;
      case 'drop':
        // The sound a player will learn to want: a bright rising chime, long in the tail.
        this.tone(t, 880, 1.6, 0.09);
        this.tone(t + 0.09, 1318.5, 1.6, 0.08);
        this.tone(t + 0.18, 1760, 2.0, 0.07);
        this.tone(t + 0.18, 2637, 1.4, 0.03);
        break;
      case 'whisper':
        this.breath(t);
        this.sting(0.5);
        break;
      case 'death':
        this.thump(t, 48, 2.2, 0.7);
        this.hiss(t, 2.4, 900, 60, 0.2);
        break;
    }
  }

  // ---------- Ambience ----------

  private async load(file: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return null;
    const cached = this.buffers.get(file);
    if (cached) return cached;
    try {
      const response = await fetch(`./audio/${file}`);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(file, buffer);
      return buffer;
    } catch {
      return null; // a missing sound should never break the game
    }
  }

  private async startLoop(name: LoopName): Promise<void> {
    const ctx = this.ctx;
    const buffer = await this.load(LOOPS[name].file);
    if (!ctx || !this.master || !buffer || this.loops.has(name)) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = LOOPS[name].rate;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.master);
    source.start();
    this.loops.set(name, { source, gain });
    this.applyMood();
  }

  private applyMood(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const { deck, low, dead, safe } = this.mood;
    const depth = Math.min(1, (deck - 1) / 9);
    const t = ctx.currentTime;
    const set = (name: LoopName, gain: number, rate: number) => {
      const loop = this.loops.get(name);
      if (!loop) return;
      loop.gain.gain.setTargetAtTime(dead || safe ? gain * 0.25 : gain, t, 1.5);
      loop.source.playbackRate.setTargetAtTime(rate, t, 3);
    };
    // The deeper you go, the lower the drone drops and the more the rumble comes up under it.
    set('saturn', LOOPS.saturn.gain, LOOPS.saturn.rate - 0.22 * depth);
    set('wind', LOOPS.wind.gain * (1 - 0.5 * depth), LOOPS.wind.rate);
    set('deep', 0.1 + 0.5 * depth, LOOPS.deep.rate - 0.3 * depth);

    const beating = low && !dead && this.enabled;
    if (beating && this.beatTimer === undefined) this.heartbeat();
    if (!beating && this.beatTimer !== undefined) {
      window.clearTimeout(this.beatTimer);
      this.beatTimer = undefined;
    }
  }

  private scheduleSting(): void {
    const depth = Math.min(1, (this.mood.deck - 1) / 9);
    const wait = (22 - 12 * depth + Math.random() * (30 - 14 * depth)) * 1000;
    window.setTimeout(() => {
      if (!this.mood.dead && !this.mood.safe) this.sting(0.6 + 0.4 * depth);
      this.scheduleSting();
    }, wait);
  }

  /** A distant sound from somewhere else in the dungeon: quiet, slowed, off to one side. */
  private sting(level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const file = STINGS[Math.floor(Math.random() * STINGS.length)] as string;
    const buffer = this.buffers.get(file);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 0.45 + Math.random() * 0.4;
    const gain = ctx.createGain();
    gain.gain.value = (0.12 + Math.random() * 0.16) * level;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    source.connect(gain).connect(pan).connect(this.master);
    source.start();
  }

  private heartbeat(): void {
    const ctx = this.ctx;
    if (ctx && ctx.state === 'running') {
      this.thump(ctx.currentTime, 52, 0.16, 0.5);
      this.thump(ctx.currentTime + 0.24, 46, 0.2, 0.38);
    }
    this.beatTimer = window.setTimeout(() => this.heartbeat(), 820);
  }

  // ---------- Synthesised effects ----------

  /** A low sine hit that drops in pitch: impacts, the heartbeat, a door closing. */
  private thump(at: number, hz: number, seconds: number, level: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(hz * 1.8, at);
    osc.frequency.exponentialRampToValueAtTime(hz, at + 0.05);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    osc.connect(gain).connect(this.master!);
    osc.start(at);
    osc.stop(at + seconds + 0.05);
  }

  /** Filtered noise sweeping from one frequency to another: steel, blows, breath. */
  private hiss(at: number, seconds: number, fromHz: number, toHz: number, level: number): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(fromHz, at);
    filter.frequency.exponentialRampToValueAtTime(toHz, at + seconds);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    source.connect(filter).connect(gain).connect(this.master!);
    source.start(at);
    source.stop(at + seconds + 0.05);
  }

  private tone(at: number, hz: number, seconds: number, level: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    osc.connect(gain).connect(this.master!);
    osc.start(at);
    osc.stop(at + seconds + 0.05);
  }

  /** Something exhaling close to the microphone. */
  private breath(at: number): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.09, at + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() < 0.5 ? -0.7 : 0.7;
    source.connect(filter).connect(gain).connect(pan).connect(this.master!);
    source.start(at);
    source.stop(at + 1.7);
  }
}

export const sound = new Sound();
