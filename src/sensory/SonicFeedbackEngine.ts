/**
 * MARSHGO Sensory 6.0 — SonicFeedbackEngine (ТЗ §14, §21).
 *
 * A small Web Audio synthesiser: every texture is generated from oscillators and
 * one cached noise buffer, so there are no audio files, no streaming and no heavy
 * library. The context is created lazily and only resumed after a permitted user
 * gesture. Playback is fire-and-forget: if audio is unavailable or still locked,
 * the call is a silent no-op and the app keeps working.
 */
import { MAX_CONCURRENT_VOICES, type ResolvedSound } from './sensoryPolicy';
import type { SoundId, TransportTimbreGroup } from './sensoryEvents';

interface Voice {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  timer: number;
}

/** Timbre families subtly colour the shared selection click (ТЗ §13). */
const TIMBRE: Record<TransportTimbreGroup, { freq: number; dur: number }> = {
  auto: { freq: 0.82, dur: 1.1 },
  rail: { freq: 1.12, dur: 0.95 },
  'urban-electric': { freq: 1, dur: 1 },
  individual: { freq: 1.2, dur: 0.8 },
};

export class SonicFeedbackEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Set<Voice>();
  private unlocked = false;
  private attached = false;
  private gestureHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private readonly blurHandler = () => this.stopAll();

  get activeVoices(): number {
    return this.voices.size;
  }

  get isUnlocked(): boolean {
    return this.unlocked && this.ctx?.state === 'running';
  }

  /** Attach the one-time gesture unlock and the background stop guard. */
  attach(): void {
    if (this.attached || typeof window === 'undefined') return;
    this.attached = true;
    this.gestureHandler = () => {
      if (navigator.userActivation?.isActive) this.unlock();
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchend'];
    events.forEach((name) => window.addEventListener(name, this.gestureHandler!, { once: false, passive: true }));
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') this.stopAll();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('blur', this.blurHandler);
  }

  detach(): void {
    if (typeof window === 'undefined') return;
    if (this.gestureHandler) {
      (['pointerdown', 'keydown', 'touchend'] as Array<keyof WindowEventMap>)
        .forEach((name) => window.removeEventListener(name, this.gestureHandler!));
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      window.removeEventListener('blur', this.blurHandler);
    }
    this.stopAll();
    this.attached = false;
  }

  /** Create/resume the context. Must be called from within a user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext
          ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
        this.noise = this.createNoiseBuffer(this.ctx);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.unlocked = this.ctx.state === 'running';
    } catch {
      this.unlocked = false;
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Soft pink-ish noise: white noise smoothed one pole, so transients are matte not harsh.
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  /** Play one resolved sound. Returns true when a voice actually started. */
  play(sound: ResolvedSound): boolean {
    if (typeof window === 'undefined') return false;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== 'running') return false;
    if (this.voices.size >= MAX_CONCURRENT_VOICES) return false;
    if (sound.gain <= 0.0001) return false;
    try {
      const when = ctx.currentTime + 0.001;
      const voice = this.renderTexture(ctx, master, sound, when);
      this.voices.add(voice);
      voice.timer = window.setTimeout(() => this.release(voice), sound.id === 'marshgo.domino.detent' ? 80 : 1200);
      return true;
    } catch {
      return false;
    }
  }

  stopAll(): void {
    this.voices.forEach((voice) => this.release(voice));
    this.voices.clear();
  }

  private release(voice: Voice): void {
    window.clearTimeout(voice.timer);
    voice.sources.forEach((source) => { try { source.stop(); } catch { /* already stopped */ } });
    voice.nodes.forEach((node) => { try { node.disconnect(); } catch { /* detached */ } });
    voice.sources.length = 0;
    voice.nodes.length = 0;
    this.voices.delete(voice);
  }

  // ---- synthesis helpers ----

  private tone(
    ctx: AudioContext, dest: AudioNode, voice: Voice,
    opts: { freq: number; freqEnd?: number; type?: OscillatorType; start: number; dur: number; attack?: number; gain: number; filter?: { type: BiquadFilterType; freq: number; q?: number } },
  ): void {
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    const start = opts.start;
    const dur = Math.max(0.01, opts.dur);
    osc.frequency.setValueAtTime(Math.max(20, opts.freq), start);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), start + dur);
    const amp = ctx.createGain();
    const attack = opts.attack ?? 0.001;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(opts.gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    let head: AudioNode = osc;
    if (opts.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = opts.filter.type;
      filter.frequency.value = opts.filter.freq;
      if (opts.filter.q !== undefined) filter.Q.value = opts.filter.q;
      osc.connect(filter);
      head = filter;
      voice.nodes.push(filter);
    }
    head.connect(amp);
    amp.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.02);
    voice.sources.push(osc);
    voice.nodes.push(amp);
  }

  private noiseBurst(
    ctx: AudioContext, dest: AudioNode, voice: Voice,
    opts: { start: number; dur: number; gain: number; filter: { type: BiquadFilterType; freq: number; freqEnd?: number; q?: number } },
  ): void {
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const start = opts.start;
    const dur = Math.max(0.01, opts.dur);
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter.type;
    filter.frequency.setValueAtTime(opts.filter.freq, start);
    if (opts.filter.freqEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.filter.freqEnd), start + dur);
    if (opts.filter.q !== undefined) filter.Q.value = opts.filter.q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(opts.gain, start + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(dest);
    src.start(start);
    src.stop(start + dur + 0.02);
    voice.sources.push(src);
    voice.nodes.push(filter, amp);
  }

  private renderTexture(ctx: AudioContext, master: GainNode, sound: ResolvedSound, when: number): Voice {
    const voice: Voice = { sources: [], nodes: [], timer: 0 };
    const bus = ctx.createGain();
    bus.gain.value = sound.gain;
    bus.connect(master);
    voice.nodes.push(bus);
    const g = (value: number) => value; // texture gains are relative; bus carries the resolved loudness
    const id: SoundId = sound.id;
    const timbre = sound.timbre ? TIMBRE[sound.timbre] : { freq: 1, dur: 1 };
    const f = (base: number) => base * timbre.freq;
    const d = (base: number) => base * timbre.dur;

    switch (id) {
      case 'marshgo.domino.detent':
        this.tone(ctx, bus, voice, { freq: 1080, freqEnd: 680, type: 'triangle', start: when, dur: 0.026, attack: 0.001, gain: 0.62, filter: { type: 'lowpass', freq: 2400 } });
        this.noiseBurst(ctx, bus, voice, { start: when, dur: 0.014, gain: 0.2, filter: { type: 'bandpass', freq: 1450, q: 0.7 } });
        break;
      case 'click.precision':
        this.tone(ctx, bus, voice, { freq: f(1700), freqEnd: f(850), type: 'triangle', start: when, dur: d(0.045), gain: g(0.9), filter: { type: 'lowpass', freq: 5000 } });
        this.noiseBurst(ctx, bus, voice, { start: when, dur: 0.012, gain: g(0.22), filter: { type: 'bandpass', freq: 3000, q: 1 } });
        break;
      case 'click.detent':
        this.tone(ctx, bus, voice, { freq: f(1250), freqEnd: f(700), type: 'triangle', start: when, dur: d(0.035), attack: 0.0008, gain: g(0.85), filter: { type: 'bandpass', freq: 1800, q: 1.2 } });
        this.noiseBurst(ctx, bus, voice, { start: when, dur: 0.01, gain: g(0.28), filter: { type: 'highpass', freq: 2000 } });
        break;
      case 'click.deep':
        this.tone(ctx, bus, voice, { freq: 300, freqEnd: 170, start: when, dur: 0.1, attack: 0.002, gain: g(0.9), filter: { type: 'lowpass', freq: 1000 } });
        this.tone(ctx, bus, voice, { freq: 150, start: when, dur: 0.09, gain: g(0.4), filter: { type: 'lowpass', freq: 700 } });
        this.noiseBurst(ctx, bus, voice, { start: when, dur: 0.03, gain: g(0.18), filter: { type: 'lowpass', freq: 600 } });
        break;
      case 'switch.on':
        this.tone(ctx, bus, voice, { freq: 1500, type: 'triangle', start: when, dur: 0.03, gain: g(0.7), filter: { type: 'lowpass', freq: 4200 } });
        this.tone(ctx, bus, voice, { freq: 2000, type: 'triangle', start: when + 0.045, dur: 0.035, gain: g(0.8), filter: { type: 'lowpass', freq: 4600 } });
        break;
      case 'switch.off':
        this.tone(ctx, bus, voice, { freq: 950, freqEnd: 600, type: 'triangle', start: when, dur: 0.05, gain: g(0.6), filter: { type: 'lowpass', freq: 3000 } });
        break;
      case 'sheet.settle':
        this.tone(ctx, bus, voice, { freq: 250, freqEnd: 180, start: when, dur: 0.12, attack: 0.003, gain: g(0.8), filter: { type: 'lowpass', freq: 800 } });
        this.noiseBurst(ctx, bus, voice, { start: when, dur: 0.05, gain: g(0.22), filter: { type: 'lowpass', freq: 500 } });
        break;
      case 'panel.unfold':
        this.noiseBurst(ctx, bus, voice, { start: when, dur: 0.16, gain: g(0.3), filter: { type: 'bandpass', freq: 500, freqEnd: 1600, q: 0.9 } });
        this.tone(ctx, bus, voice, { freq: 520, freqEnd: 700, start: when, dur: 0.14, gain: g(0.24), filter: { type: 'lowpass', freq: 2000 } });
        break;
      case 'panel.fold':
        this.noiseBurst(ctx, bus, voice, { start: when, dur: 0.11, gain: g(0.26), filter: { type: 'bandpass', freq: 1400, freqEnd: 500, q: 0.9 } });
        this.tone(ctx, bus, voice, { freq: 600, freqEnd: 420, start: when, dur: 0.1, gain: g(0.2), filter: { type: 'lowpass', freq: 1800 } });
        break;
      case 'map.glide':
        this.noiseBurst(ctx, bus, voice, { start: when, dur: 0.34, gain: g(0.22), filter: { type: 'bandpass', freq: 380, freqEnd: 1100, q: 0.8 } });
        break;
      case 'map.arrival':
        this.tone(ctx, bus, voice, { freq: 1500, freqEnd: 1100, type: 'triangle', start: when, dur: 0.06, gain: g(0.7), filter: { type: 'lowpass', freq: 4500 } });
        this.tone(ctx, bus, voice, { freq: 880, start: when + 0.01, dur: 0.09, gain: g(0.18), filter: { type: 'lowpass', freq: 2600 } });
        break;
      case 'route.select':
        this.tone(ctx, bus, voice, { freq: 2000, freqEnd: 1500, type: 'triangle', start: when, dur: 0.035, gain: g(0.65), filter: { type: 'bandpass', freq: 2400, q: 1 } });
        break;
      case 'booking.success':
        this.tone(ctx, bus, voice, { freq: 620, start: when, dur: 0.12, attack: 0.004, gain: g(0.5), filter: { type: 'lowpass', freq: 3000 } });
        this.tone(ctx, bus, voice, { freq: 880, start: when + 0.1, dur: 0.16, attack: 0.004, gain: g(0.5), filter: { type: 'lowpass', freq: 3200 } });
        break;
      case 'offer.received':
        this.tone(ctx, bus, voice, { freq: 1100, type: 'triangle', start: when, dur: 0.05, gain: g(0.5), filter: { type: 'lowpass', freq: 3600 } });
        this.tone(ctx, bus, voice, { freq: 1400, type: 'triangle', start: when + 0.07, dur: 0.06, gain: g(0.5), filter: { type: 'lowpass', freq: 3800 } });
        break;
      case 'price.counteroffer':
        this.tone(ctx, bus, voice, { freq: 900, start: when, dur: 0.06, gain: g(0.45), filter: { type: 'lowpass', freq: 3000 } });
        this.tone(ctx, bus, voice, { freq: 1200, start: when + 0.075, dur: 0.07, gain: g(0.45), filter: { type: 'lowpass', freq: 3200 } });
        break;
      case 'error.soft':
        this.tone(ctx, bus, voice, { freq: 320, freqEnd: 230, start: when, dur: 0.16, attack: 0.004, gain: g(0.5), filter: { type: 'lowpass', freq: 900 } });
        break;
      case 'pass.reveal':
        this.tone(ctx, bus, voice, { freq: 1300, freqEnd: 1700, type: 'triangle', start: when, dur: 0.07, gain: g(0.5), filter: { type: 'lowpass', freq: 4200 } });
        this.noiseBurst(ctx, bus, voice, { start: when, dur: 0.06, gain: g(0.1), filter: { type: 'highpass', freq: 4000 } });
        break;
    }
    return voice;
  }
}

export const sonicEngine = new SonicFeedbackEngine();