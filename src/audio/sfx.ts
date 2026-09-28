/**
 * Todos los sonidos se sintetizan en tiempo real con Web Audio: sin archivos ni licencias,
 * pesan 0 KB y funcionan offline.
 */
type Wave = OscillatorType;

interface ToneOpts {
  type?: Wave;
  f: number;
  f2?: number;
  dur: number;
  vol?: number;
  attack?: number;
  at?: number;
  wet?: number;
  dist?: boolean;
  detune?: number;
}

interface NoiseOpts {
  dur: number;
  vol?: number;
  filter?: BiquadFilterType;
  f?: number;
  f2?: number;
  q?: number;
  at?: number;
  attack?: number;
  wet?: number;
}

class Sfx {
  enabled = true;
  private ctx?: AudioContext;
  private master!: GainNode;
  private verb!: ConvolverNode;
  private verbIn!: GainNode;
  private noiseBuf!: AudioBuffer;
  private shaper!: WaveShaperNode;
  private drone?: { stop: () => void };

  /** Debe llamarse dentro de un gesto del usuario (iOS/Android bloquean audio hasta entonces). */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);

      this.verb = ctx.createConvolver();
      this.verb.buffer = this.impulse(2.6, 2.2);
      this.verbIn = ctx.createGain();
      this.verbIn.gain.value = 0.9;
      this.verbIn.connect(this.verb).connect(this.master);

      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this.shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curve[i] = ((Math.PI + 40) * x) / (Math.PI + 40 * Math.abs(x));
      }
      this.shaper.curve = curve;
      this.shaper.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private get ok() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  private out(g: GainNode, wet = 0.2, dist = false) {
    g.connect(dist ? this.shaper : this.master);
    if (wet > 0) {
      const w = this.ctx!.createGain();
      w.gain.value = wet;
      g.connect(w).connect(this.verbIn);
    }
  }

  private tone({ type = 'sine', f, f2, dur, vol = 0.3, attack = 0.005, at = 0, wet = 0.2, dist = false, detune = 0 }: ToneOpts) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    this.out(g, wet, dist);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise({ dur, vol = 0.3, filter = 'bandpass', f = 1000, f2, q = 1, at = 0, attack = 0.005, wet = 0.2 }: NoiseOpts) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = filter;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(g);
    this.out(g, wet);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  tap() {
    if (!this.ok) return;
    this.tone({ type: 'triangle', f: 880, f2: 660, dur: 0.07, vol: 0.18, wet: 0.05 });
  }

  select() {
    if (!this.ok) return;
    this.tone({ type: 'sine', f: 660, dur: 0.1, vol: 0.2, wet: 0.1 });
    this.tone({ type: 'sine', f: 990, dur: 0.14, vol: 0.18, at: 0.05, wet: 0.15 });
  }

  whoosh() {
    if (!this.ok) return;
    this.noise({ dur: 0.35, vol: 0.25, filter: 'bandpass', f: 400, f2: 3000, q: 0.8, attack: 0.12, wet: 0.1 });
  }

  /** Carta volteándose: papel + golpe seco. */
  flip() {
    if (!this.ok) return;
    this.noise({ dur: 0.18, vol: 0.35, filter: 'highpass', f: 1800, f2: 5000, attack: 0.02, wet: 0.05 });
    this.tone({ type: 'sine', f: 180, f2: 60, dur: 0.12, vol: 0.35, at: 0.1, wet: 0.05 });
  }

  /** Revelación de carta civil: acorde brillante. */
  reveal() {
    if (!this.ok) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone({ type: 'triangle', f, dur: 1.2, vol: 0.12, at: i * 0.045, attack: 0.02, wet: 0.5 }),
    );
    this.noise({ dur: 0.9, vol: 0.06, filter: 'highpass', f: 6000, attack: 0.05, wet: 0.6 });
  }

  /** Revelación de impostor: impacto grave distorsionado + disonancia. */
  impostor() {
    if (!this.ok) return;
    this.tone({ type: 'sine', f: 110, f2: 30, dur: 1.4, vol: 0.9, wet: 0.4 });
    this.tone({ type: 'sawtooth', f: 73.4, dur: 1.6, vol: 0.25, dist: true, attack: 0.01, wet: 0.5 });
    this.tone({ type: 'sawtooth', f: 77.8, dur: 1.6, vol: 0.2, dist: true, attack: 0.01, wet: 0.5 });
    this.tone({ type: 'square', f: 311, f2: 290, dur: 1.2, vol: 0.06, attack: 0.02, wet: 0.7 });
    this.noise({ dur: 0.6, vol: 0.4, filter: 'lowpass', f: 2000, f2: 200, wet: 0.5 });
  }

  /** Crescendo tenso antes de revelar. */
  riser(dur = 1.2) {
    if (!this.ok) return;
    this.noise({ dur, vol: 0.25, filter: 'bandpass', f: 300, f2: 6000, q: 2, attack: dur * 0.9, wet: 0.3 });
    this.tone({ type: 'sawtooth', f: 110, f2: 880, dur, vol: 0.08, attack: dur * 0.9, wet: 0.3 });
  }

  heartbeat() {
    if (!this.ok) return;
    this.tone({ type: 'sine', f: 70, f2: 40, dur: 0.18, vol: 0.7, wet: 0.1 });
    this.tone({ type: 'sine', f: 65, f2: 38, dur: 0.2, vol: 0.5, at: 0.22, wet: 0.1 });
  }

  tick(urgent = false) {
    if (!this.ok) return;
    this.tone({ type: 'square', f: urgent ? 1400 : 1000, dur: 0.04, vol: urgent ? 0.12 : 0.07, wet: 0 });
  }

  spinTick(pitch = 1) {
    if (!this.ok) return;
    this.tone({ type: 'triangle', f: 1200 * pitch, dur: 0.03, vol: 0.1, wet: 0 });
  }

  drumroll(dur = 2) {
    if (!this.ok) return;
    const hits = Math.floor(dur * 22);
    for (let i = 0; i < hits; i++) {
      const p = i / hits;
      this.noise({ dur: 0.06, vol: 0.08 + p * 0.25, filter: 'bandpass', f: 220, q: 0.7, at: i * (dur / hits), wet: 0.15 });
    }
    this.tone({ type: 'sine', f: 60, f2: 40, dur: 0.6, vol: 0.8, at: dur, wet: 0.4 });
    this.noise({ dur: 1.2, vol: 0.3, filter: 'highpass', f: 5000, at: dur, wet: 0.5 });
  }

  /** Sello golpeando la mesa. */
  stamp() {
    if (!this.ok) return;
    this.tone({ type: 'sine', f: 140, f2: 45, dur: 0.35, vol: 0.9, wet: 0.2 });
    this.noise({ dur: 0.12, vol: 0.5, filter: 'lowpass', f: 1500, wet: 0.2 });
  }

  fanfare() {
    if (!this.ok) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.tone({ type: 'square', f, dur: 0.22, vol: 0.07, at: i * 0.1, wet: 0.3 });
      this.tone({ type: 'triangle', f: f / 2, dur: 0.25, vol: 0.12, at: i * 0.1, wet: 0.3 });
    });
    this.noise({ dur: 1.5, vol: 0.1, filter: 'highpass', f: 7000, at: 0.6, wet: 0.6 });
  }

  fail() {
    if (!this.ok) return;
    [392, 370, 349.2, 329.6].forEach((f, i) =>
      this.tone({ type: 'sawtooth', f, f2: i === 3 ? 200 : undefined, dur: i === 3 ? 0.9 : 0.28, vol: 0.09, at: i * 0.3, wet: 0.3 }),
    );
  }

  /** Reto: glitch digital. */
  challenge() {
    if (!this.ok) return;
    for (let i = 0; i < 8; i++)
      this.tone({ type: 'square', f: 200 + Math.random() * 1800, dur: 0.05, vol: 0.08, at: i * 0.045, wet: 0.05 });
    this.tone({ type: 'sawtooth', f: 90, f2: 180, dur: 0.5, vol: 0.2, at: 0.35, dist: true, wet: 0.3 });
    this.tone({ type: 'triangle', f: 880, dur: 0.4, vol: 0.12, at: 0.4, wet: 0.5 });
  }

  levelUp() {
    if (!this.ok) return;
    [440, 554.4, 659.3, 880, 1108.7].forEach((f, i) =>
      this.tone({ type: 'triangle', f, dur: 0.3, vol: 0.12, at: i * 0.07, wet: 0.4 }),
    );
  }

  coin() {
    if (!this.ok) return;
    this.tone({ type: 'square', f: 988, dur: 0.08, vol: 0.06, wet: 0.1 });
    this.tone({ type: 'square', f: 1319, dur: 0.25, vol: 0.06, at: 0.08, wet: 0.2 });
  }

  /** Ambiente de terror de fondo (rondas de horror). */
  startDrone() {
    if (!this.ok || this.drone) return;
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 3);
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.13;
    lfoG.gain.value = 6;
    const oscs = [55, 55.7, 82.4, 116.5].map((f) => {
      const o = ctx.createOscillator();
      o.type = f > 100 ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      lfo.connect(lfoG).connect(o.detune);
      o.connect(g);
      o.start();
      return o;
    });
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    g.connect(lp);
    lp.connect(this.master);
    const w = ctx.createGain();
    w.gain.value = 0.6;
    lp.connect(w).connect(this.verbIn);
    lfo.start();
    this.drone = {
      stop: () => {
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        oscs.forEach((o) => o.stop(t + 1.6));
        lfo.stop(t + 1.6);
      },
    };
  }

  stopDrone() {
    this.drone?.stop();
    this.drone = undefined;
  }
}

export const sfx = new Sfx();

let vibrationOn = true;
export const setVibration = (on: boolean) => (vibrationOn = on);
export function haptic(pattern: number | number[]) {
  if (vibrationOn && 'vibrate' in navigator) navigator.vibrate(pattern);
}
