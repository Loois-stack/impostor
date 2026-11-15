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

export type MusicMood = 'menu' | 'game' | 'tension' | 'horror';

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface MusicNote {
  type?: Wave;
  f: number;
  dur: number;
  vol: number;
  attack?: number;
  wet?: number;
  lp?: number;
  f2?: number;
  detune?: number;
}

type Voice = (step: number, when: number, spb: number) => void;

/** Lo necesario para sintetizar un sonido nuevo: contexto, salida, reverb, ruido y distorsión. */
export interface Kit {
  ctx: AudioContext;
  master: AudioNode;
  verb: AudioNode;
  noise: AudioBuffer;
  shaper: AudioNode;
}

class Sfx {
  enabled = true;
  musicOn = true;
  private musicGain!: GainNode;
  private mood: MusicMood | null = null;
  private seqTimer = 0;
  private step = 0;
  private nextTime = 0;
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

      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().then(() => this.applyMusic());
    else if (!this.seqTimer) this.applyMusic();
  }

  // ---------------- Música procedural ----------------

  setMusic(mood: MusicMood | null) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (this.ctx) this.applyMusic();
  }

  /** Reaplica el estado de la música (tras cambiar sonido/música o reanudar el audio). */
  applyMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const on = this.enabled && this.musicOn && !!this.mood && ctx.state === 'running';
    const g = this.musicGain.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(on ? 0.5 : 0, t + 0.5);
    clearInterval(this.seqTimer);
    this.seqTimer = 0;
    if (!on) return;
    this.step = 0;
    this.nextTime = t + 0.15;
    this.seqTimer = window.setInterval(() => this.schedule(), 30);
  }

  private schedule() {
    const ctx = this.ctx!;
    const song = this.mood ? SONGS[this.mood] : undefined;
    if (!song) return;
    const spb = 60 / song.bpm / 4;
    // Si la pestaña estuvo en segundo plano, no intentamos "ponernos al día".
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.15) {
      for (const v of song.voices(this)) v(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step++;
    }
  }

  /** Nota de música programada en un instante exacto. */
  mnote(when: number, { type = 'triangle', f, dur, vol, attack = 0.01, wet = 0.25, lp, f2, detune = 0 }: MusicNote) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f, when);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    let node: AudioNode = g;
    if (lp) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lp;
      node = g.connect(filter);
    }
    node.connect(this.musicGain);
    if (wet > 0) {
      const w = ctx.createGain();
      w.gain.value = wet;
      node.connect(w).connect(this.verbIn);
    }
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  mnoise(when: number, dur: number, vol: number, hp = 7000) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(when, Math.random());
    src.stop(when + dur + 0.02);
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

  /** Piezas para armar sonidos fuera de esta clase (las reacciones). `null` si no hay sonido. */
  kit(): Kit | null {
    if (!this.ok) return null;
    return { ctx: this.ctx!, master: this.master, verb: this.verbIn, noise: this.noiseBuf, shaper: this.shaper };
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

  // ---------------- Sobre de cartas (sonidos originales, sintetizados desde cero) ----------------

  /**
   * Un "grano" de ruido muy corto. Muchos granos con tonos y volúmenes al azar suenan a
   * plástico metálico crujiendo; en ráfagas densas, a algo rasgándose.
   */
  private grain(at: number, f: number, q: number, vol: number, dur: number, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.8);
    src.stop(t + dur + 0.01);
  }

  /** Crujido del sobre metálico al tocarlo o apretarlo. `amount` de 0 a 1. */
  packCrinkle(amount = 0.5) {
    if (!this.ok) return;
    const n = 4 + Math.round(amount * 10);
    for (let i = 0; i < n; i++) {
      const at = Math.random() * 0.09;
      this.grain(at, 2500 + Math.random() * 5000, 1 + Math.random() * 3, (0.1 + Math.random() * 0.3) * (0.5 + amount), 0.004 + Math.random() * 0.012);
    }
  }

  /** Rasgado mientras el dedo corta el sobre. `speed` de 0 a 1 según qué tan rápido se corta. */
  packTear(speed = 0.5) {
    if (!this.ok) return;
    const dur = 0.07;
    const n = 6 + Math.round(speed * 14);
    for (let i = 0; i < n; i++) {
      const at = (i / n) * dur + Math.random() * 0.006;
      this.grain(at, 1200 + Math.random() * 3200, 0.8 + Math.random() * 2, 0.14 + Math.random() * 0.26 * (0.6 + speed), 0.006 + Math.random() * 0.01);
    }
    // Cuerpo grave del plástico estirándose.
    this.grain(0, 520 + speed * 300, 0.9, 0.12 + speed * 0.1, dur);
  }

  /** El corte termina: rasgón final, la tira sale volando y el sobre se abre con un "pop". */
  packRip() {
    if (!this.ok) return;
    // Rasgón: ráfaga de granos cada vez más densa y aguda.
    const n = 46;
    for (let i = 0; i < n; i++) {
      const p = i / n;
      this.grain(p * p * 0.32, 900 + p * 3800 + Math.random() * 900, 1.2, 0.08 + p * 0.16, 0.008 + Math.random() * 0.012);
    }
    this.noise({ dur: 0.34, vol: 0.18, filter: 'bandpass', f: 800, f2: 4200, q: 1.4, attack: 0.03, wet: 0.08 });
    // Pop del aire al abrirse.
    this.tone({ type: 'sine', f: 160, f2: 55, dur: 0.18, vol: 0.32, at: 0.3, wet: 0.1 });
    this.noise({ dur: 0.25, vol: 0.14, filter: 'highpass', f: 3000, f2: 9000, at: 0.3, attack: 0.01, wet: 0.3 });
    // Destello: la magia del sobre recién abierto.
    [1568, 2093, 2637, 3136].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.6, vol: 0.05, at: 0.36 + i * 0.05, wet: 0.7 }));
  }

  /** Una carta deslizándose fuera del sobre. */
  cardSlide(pitch = 1) {
    if (!this.ok) return;
    this.noise({ dur: 0.11, vol: 0.28, filter: 'bandpass', f: 2200 * pitch, f2: 5200 * pitch, q: 1.2, attack: 0.025, wet: 0.05 });
    this.grain(0.1, 3800, 2, 0.14, 0.006);
  }

  /** Barajeo tipo "riffle": decenas de cartas golpeándose muy rápido, cada vez más lento. */
  riffle(dur = 0.6) {
    if (!this.ok) return;
    let t = 0;
    let gap = 0.009;
    while (t < dur) {
      this.grain(t, 2400 + Math.random() * 2400, 1.8, 0.24 + Math.random() * 0.18, 0.005 + Math.random() * 0.006);
      // El "tac" de cada carta cayendo sobre la otra.
      if (Math.random() < 0.5) this.grain(t + 0.001, 800 + Math.random() * 500, 2, 0.16, 0.007);
      t += gap * (0.7 + Math.random() * 0.6);
      gap *= 1.035;
    }
    // Las cartas se acomodan al final.
    this.grain(dur + 0.02, 600, 0.8, 0.12, 0.05, 'lowpass');
  }

  /** Golpecitos del mazo contra la mesa para emparejarlo. */
  deckTap() {
    if (!this.ok) return;
    this.tone({ type: 'sine', f: 190, f2: 90, dur: 0.07, vol: 0.4, wet: 0.05 });
    this.grain(0, 700, 0.9, 0.2, 0.04, 'lowpass');
    this.grain(0.002, 3200, 2, 0.05, 0.01);
  }

  /** Brillo cuando las cartas se abren en abanico. */
  sparkle() {
    if (!this.ok) return;
    for (let i = 0; i < 6; i++) this.tone({ type: 'sine', f: 1800 + Math.random() * 2600, dur: 0.35, vol: 0.045, at: i * 0.05 + Math.random() * 0.02, wet: 0.8 });
  }

  // ---------------- Brillo del sobre personal (igual para civiles e impostores) ----------------

  /** El sobre recién cortado se llena de luz: zumbido que sube y chispas cada vez más seguidas. */
  glowCharge(dur = 1, level = 1) {
    if (!this.ok) return;
    this.noise({ dur, vol: 0.1 + level * 0.03, filter: 'bandpass', f: 500, f2: 5000 + level * 1000, q: 3, attack: dur * 0.92, wet: 0.5 });
    this.tone({ type: 'triangle', f: 196, f2: 784 * (1 + level * 0.12), dur, vol: 0.05 + level * 0.012, attack: dur * 0.9, wet: 0.6 });
    this.tone({ type: 'sine', f: 294, f2: 1175 * (1 + level * 0.12), dur, vol: 0.04, attack: dur * 0.9, wet: 0.6, detune: 8 });
    let t = 0;
    let gap = 0.12;
    while (t < dur) {
      this.grain(t, 4000 + Math.random() * 4000, 6, 0.04 + (t / dur) * 0.12, 0.02);
      t += gap;
      gap = Math.max(0.025, gap * 0.86);
    }
    // En los brillos más raros, la mesa retumba.
    if (level >= 3) this.tone({ type: 'sine', f: 55, dur, vol: 0.1 + level * 0.05, attack: dur * 0.85, wet: 0.2 });
  }

  /** Estallido de luz al salir la carta: un arpegio brillante que crece con la rareza. */
  glowBurst(level = 1) {
    if (!this.ok) return;
    this.tone({ type: 'sine', f: 130, f2: 50, dur: 0.5, vol: 0.45 + level * 0.07, wet: 0.3 });
    this.noise({ dur: 0.8 + level * 0.2, vol: 0.14, filter: 'highpass', f: 5000, f2: 9000, attack: 0.01, wet: 0.7 });
    const root = 72 + [0, 2, 4, 5, 7][level - 1];
    const steps = [0, 4, 7, 11, 12, 16, 19, 23, 24, 28, 31, 35, 36];
    const n = Math.min(steps.length, 3 + level * 2);
    for (let i = 0; i < n; i++) {
      const f = midi(root + steps[i]);
      this.tone({ type: 'triangle', f, dur: 0.9, vol: 0.07, at: 0.04 + i * 0.055, attack: 0.008, wet: 0.6 });
      this.tone({ type: 'sine', f: f * 2, dur: 0.6, vol: 0.025, at: 0.05 + i * 0.055, wet: 0.8 });
    }
    // Legendario y mítico: un coro de fondo que se queda sonando.
    if (level >= 4)
      [0, 4, 7, 12].forEach((s) => {
        this.tone({ type: 'triangle', f: midi(root - 12 + s), dur: 2.4, vol: 0.045, attack: 0.25, wet: 0.8, detune: -9 });
        this.tone({ type: 'triangle', f: midi(root - 12 + s), dur: 2.4, vol: 0.045, attack: 0.25, wet: 0.8, detune: 9 });
      });
    if (level === 5) for (let i = 0; i < 10; i++) this.tone({ type: 'sine', f: 2400 + Math.random() * 3200, dur: 0.4, vol: 0.04, at: 0.6 + i * 0.07, wet: 0.9 });
  }

  // ---------------- Última oportunidad del impostor ----------------

  /** La mira se fija sobre el impostor atrapado: dos pitidos y un golpe. */
  lockOn() {
    if (!this.ok) return;
    this.tone({ type: 'square', f: 1760, dur: 0.05, vol: 0.06, wet: 0.05 });
    this.tone({ type: 'square', f: 1760, dur: 0.05, vol: 0.06, at: 0.09, wet: 0.05 });
    this.tone({ type: 'sine', f: 150, f2: 40, dur: 0.5, vol: 0.8, at: 0.18, wet: 0.3 });
    this.noise({ dur: 0.3, vol: 0.3, filter: 'lowpass', f: 1800, f2: 300, at: 0.18, wet: 0.3 });
  }

  /** Golpe de título: impacto grave con un timbre metálico que se queda vibrando. */
  slam() {
    if (!this.ok) return;
    this.tone({ type: 'sine', f: 90, f2: 35, dur: 0.9, vol: 0.9, wet: 0.5 });
    this.tone({ type: 'sawtooth', f: 220, f2: 110, dur: 0.5, vol: 0.12, dist: true, wet: 0.5 });
    this.noise({ dur: 0.5, vol: 0.35, filter: 'bandpass', f: 1200, f2: 300, q: 0.8, wet: 0.5 });
    [880, 1318.5].forEach((f) => this.tone({ type: 'triangle', f, dur: 1.4, vol: 0.05, at: 0.02, wet: 0.8 }));
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

const MINOR = [0, 3, 7, 12];
const MAJOR = [0, 4, 7, 12];

interface Song {
  bpm: number;
  voices: (s: Sfx) => Voice[];
}

const kick = (s: Sfx, when: number, vol = 0.22) => s.mnote(when, { type: 'sine', f: 120, f2: 42, dur: 0.22, vol, wet: 0 });

/** Canciones generadas por pasos de 1/16. Cada compás = 16 pasos. */
const SONGS: Record<MusicMood, Song> = {
  menu: {
    bpm: 88,
    voices: (s) => {
      const prog = [
        [57, MINOR],
        [53, MAJOR],
        [48, MAJOR],
        [55, MAJOR],
      ] as const;
      return [
        (step, when, spb) => {
          const [root, chord] = prog[Math.floor(step / 16) % 4];
          const i = step % 16;
          if (i === 0) {
            kick(s, when, 0.16);
            chord.slice(0, 3).forEach((c) =>
              s.mnote(when, { type: 'sawtooth', f: midi(root + c), dur: spb * 16, vol: 0.012, attack: 0.4, lp: 900, wet: 0.5 }),
            );
          }
          if (i === 8) kick(s, when, 0.12);
          if (i === 0 || i === 6 || i === 10) s.mnote(when, { type: 'triangle', f: midi(root - 12), dur: 0.4, vol: 0.13, wet: 0.1 });
          if (i % 2 === 0) s.mnote(when, { type: 'sine', f: midi(root + 12 + chord[(i / 2) % 4]), dur: 0.3, vol: 0.045, wet: 0.45 });
          if (i % 4 === 2) s.mnoise(when, 0.04, 0.02);
        },
      ];
    },
  },
  game: {
    bpm: 102,
    voices: (s) => {
      const prog = [
        [50, MINOR],
        [46, MAJOR],
        [53, MAJOR],
        [48, MAJOR],
      ] as const;
      const arp = [0, 1, 2, 3, 2, 1, 2, 3];
      return [
        (step, when, spb) => {
          const [root, chord] = prog[Math.floor(step / 16) % 4];
          const i = step % 16;
          if (i === 0 || i === 8) kick(s, when, 0.18);
          if (i === 4 || i === 12) s.mnoise(when, 0.09, 0.035, 2500);
          if (i % 2 === 1) s.mnoise(when, 0.03, 0.015);
          if ([0, 3, 8, 11].includes(i)) s.mnote(when, { type: 'triangle', f: midi(root - 12), dur: spb * 2.5, vol: 0.12, wet: 0.05 });
          s.mnote(when, { type: 'triangle', f: midi(root + 12 + chord[arp[i % 8]]), dur: 0.12, vol: 0.03, wet: 0.35 });
        },
      ];
    },
  },
  tension: {
    bpm: 120,
    voices: (s) => [
      (step, when) => {
        const i = step % 16;
        const root = Math.floor(step / 32) % 2 ? 41 : 40;
        if (i % 2 === 0) s.mnote(when, { type: 'sawtooth', f: midi(root), dur: 0.14, vol: 0.07, lp: 500, wet: 0.05 });
        if (i === 0 || i === 3) kick(s, when, 0.3);
        if (i % 4 === 0) s.mnote(when, { type: 'square', f: 2000, dur: 0.02, vol: 0.012, wet: 0 });
        if (step % 32 === 0) s.mnote(when, { type: 'sine', f: midi(83), dur: 3, vol: 0.02, attack: 1, detune: 12, wet: 0.7 });
      },
    ],
  },
  horror: {
    bpm: 60,
    voices: (s) => {
      const scale = [69, 72, 75, 78, 81, 84];
      return [
        (step, when) => {
          if (step % 4 === 0 && Math.random() < 0.55)
            s.mnote(when, {
              type: 'triangle',
              f: midi(scale[Math.floor(Math.random() * scale.length)]),
              dur: 1.4,
              vol: 0.04,
              detune: (Math.random() - 0.5) * 40,
              wet: 0.85,
            });
          if (step % 64 === 0) s.mnote(when, { type: 'sine', f: 55, f2: 30, dur: 2.5, vol: 0.2, wet: 0.5 });
        },
      ];
    },
  },
};

export const sfx = new Sfx();

let vibrationOn = true;
export const setVibration = (on: boolean) => (vibrationOn = on);
export function haptic(pattern: number | number[]) {
  // El navegador ignora (y reporta error) si nadie ha tocado la pantalla todavía.
  const touched = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
  if (vibrationOn && touched && 'vibrate' in navigator) navigator.vibrate(pattern);
}
