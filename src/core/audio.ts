import { config } from '../config.js';

export type SfxName =
  | 'whoosh'
  | 'thud'
  | 'boing'
  | 'chime'
  | 'shimmer'
  | 'rain'
  | 'wobble'
  | 'hop'
  | 'spin'
  | 'glow'
  | 'dart'
  | 'pause'
  /** Meta-keyboard-style key down (short mechanical click). */
  | 'click'
  /** Soft tick while a long-press fills. */
  | 'tick'
  /** Key/button release. */
  | 'clickUp';

interface Voice {
  stop: () => void;
  setPosition?: (x: number, y: number, z: number) => void;
  setGain?: (value: number) => void;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private listenerReady = false;
  private rain: Voice | null = null;
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = config.masterVolume;
    this.master.connect(this.ctx.destination);
    await this.ctx.resume();
    this.started = true;
    this.listenerReady = true;
  }

  setMasterVolume(value: number): void {
    if (this.master) this.master.gain.value = value;
  }

  setListener(x: number, y: number, z: number, fx: number, fy: number, fz: number): void {
    if (!this.ctx || !this.listenerReady) return;
    const listener = this.ctx.listener;
    if (listener.positionX) {
      listener.positionX.value = x;
      listener.positionY.value = y;
      listener.positionZ.value = z;
      listener.forwardX.value = fx;
      listener.forwardY.value = fy;
      listener.forwardZ.value = fz;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    }
  }

  play(name: SfxName, position?: { x: number; y: number; z: number }): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const panner = position ? this.panner(position.x, position.y, position.z) : null;
    const dest = panner ?? this.master;
    if (panner) panner.connect(this.master);

    switch (name) {
      case 'whoosh':
        this.noiseSweep(dest, now, 0.35, 800, 180, 0.12);
        break;
      case 'thud':
        this.tone(dest, now, 90, 0.18, 'sine', 0.2);
        break;
      case 'boing':
        this.tone(dest, now, 220, 0.22, 'sine', 0.16);
        this.tone(dest, now + 0.05, 330, 0.18, 'sine', 0.1);
        break;
      case 'chime':
        this.tone(dest, now, 880, 0.4, 'sine', 0.12);
        this.tone(dest, now + 0.08, 1320, 0.5, 'sine', 0.08);
        break;
      case 'shimmer':
        this.tone(dest, now, 1200, 0.3, 'triangle', 0.06);
        this.tone(dest, now + 0.1, 1600, 0.25, 'triangle', 0.04);
        break;
      case 'click':
        // Short band-limited burst — reads like a Quest keyboard key-down.
        this.noiseSweep(dest, now, 0.045, 2400, 900, 0.16);
        this.tone(dest, now, 1600, 0.04, 'square', 0.05);
        break;
      case 'clickUp':
        this.noiseSweep(dest, now, 0.03, 1800, 700, 0.08);
        break;
      case 'tick':
        this.tone(dest, now, 980, 0.05, 'triangle', 0.045);
        break;
      case 'wobble':
      case 'hop':
      case 'spin':
      case 'glow':
      case 'dart':
      case 'pause':
        this.tone(dest, now, name === 'hop' ? 520 : name === 'dart' ? 760 : 340, 0.2, 'sine', 0.08);
        break;
      default:
        break;
    }
  }

  setRain(on: boolean, position: { x: number; y: number; z: number }): void {
    if (!this.ctx || !this.master) return;
    if (!on) {
      this.rain?.stop();
      this.rain = null;
      return;
    }
    if (!this.rain) this.rain = this.startRain();
    this.rain.setPosition?.(position.x, position.y, position.z);
  }

  pause(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  private panner(x: number, y: number, z: number): PannerNode {
    const panner = this.ctx!.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 0.4;
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
    return panner;
  }

  private tone(
    dest: AudioNode,
    when: number,
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
  ): void {
    const osc = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + dur);
  }

  private noiseSweep(
    dest: AudioNode,
    when: number,
    dur: number,
    start: number,
    end: number,
    gain: number,
  ): void {
    const buffer = this.ctx!.createBuffer(1, this.ctx!.sampleRate * dur, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx!.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(start, when);
    filter.frequency.exponentialRampToValueAtTime(end, when + dur);
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(when);
  }

  private startRain(): Voice {
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;
    const g = ctx.createGain();
    g.gain.value = 0.04 * config.masterVolume;
    const panner = this.panner(0, 1.2, -0.6);
    noise.connect(filter);
    filter.connect(g);
    g.connect(panner);
    panner.connect(this.master!);
    noise.start();
    return {
      stop: () => noise.stop(),
      setPosition: (x, y, z) => {
        panner.positionX.value = x;
        panner.positionY.value = y;
        panner.positionZ.value = z;
      },
    };
  }
}
