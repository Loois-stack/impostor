/**
 * Sonidos de las reacciones, hechos desde cero con Web Audio (sin grabaciones ni memes ajenos).
 *
 * Las voces (risa, grito, "mmm", "¿eeeh?") salen de un sintetizador de formantes: un pulso como
 * el de las cuerdas vocales pasa por tres filtros que imitan la forma de la boca para cada vocal,
 * con aire ("j"), vibrato e inestabilidad natural. Cada risa se arma al momento, así que nunca
 * suena exactamente igual (y si en la sala ríen varios teléfonos, suena a una mesa riéndose).
 */
import { sfx, type Kit } from './sfx';

type Vowel = 'a' | 'e' | 'i' | 'o' | 'u' | 'm';
/** Formantes por vocal: frecuencia, Q (qué tan angosto) y volumen. */
type Formant = readonly [f: number, q: number, g: number];

const VOWELS: Record<Vowel, readonly Formant[]> = {
  a: [[850, 6, 1], [1250, 8, 0.75], [2800, 11, 0.4]],
  e: [[500, 5, 1], [1950, 10, 0.6], [2750, 11, 0.38]],
  i: [[330, 4, 0.8], [2450, 11, 0.7], [3250, 13, 0.4]],
  o: [[560, 5, 1], [950, 7, 0.65], [2650, 11, 0.22]],
  u: [[370, 4, 1], [820, 6, 0.55], [2550, 11, 0.14]],
  // Boca cerrada: un zumbido nasal. Se refuerzan los armónicos medios para que se oiga en bocinas de celular.
  m: [[300, 2.2, 0.8], [1150, 5, 0.42], [2400, 9, 0.08]],
};

interface Syl {
  v: Vowel;
  /** Inicio y duración (segundos, desde que empieza la voz). */
  at: number;
  dur: number;
  /** Tono al empezar y al terminar. */
  f: number;
  f2?: number;
  vol?: number;
  /** Segundos de aire antes de la vocal (la "j" de "ja"). */
  h?: number;
  /** Aire mezclado en la vocal. */
  breath?: number;
  /** Se liga con la sílaba siguiente sin cortar el sonido. */
  tie?: boolean;
}

interface VoiceOpts {
  vol: number;
  at?: number;
  /** >1 voz más chica (formantes más agudos), <1 más grande. */
  shift?: number;
  vib?: [rate: number, cents: number];
  /** Inestabilidad del tono, en cents. */
  jitter?: number;
  /** Segunda voz desafinada (cents): da aspereza, para gritos. */
  rough?: number;
  /** Raspado de la "j" mexicana. */
  rasp?: number;
  wet?: number;
  pan?: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function output(k: Kit, node: AudioNode, wet: number, pan = 0) {
  let out = node;
  if (pan && k.ctx.createStereoPanner) {
    const p = k.ctx.createStereoPanner();
    p.pan.value = pan;
    out = node.connect(p);
  }
  out.connect(k.master);
  if (wet > 0) {
    const w = k.ctx.createGain();
    w.gain.value = wet;
    out.connect(w).connect(k.verb);
  }
}

/** Sintetiza una voz. Devuelve cuánto dura. */
function speak(k: Kit, syls: Syl[], o: VoiceOpts) {
  const { ctx } = k;
  const t0 = ctx.currentTime + 0.01 + (o.at ?? 0);
  const length = Math.max(...syls.map((s) => s.at + s.dur));
  const end = t0 + length + 0.25;
  const shift = o.shift ?? 1;

  // Fuente: pulso de las cuerdas vocales (y una segunda, desafinada, si la voz es áspera).
  const srcs = [ctx.createOscillator()];
  if (o.rough) srcs.push(ctx.createOscillator());
  const tilt = ctx.createBiquadFilter();
  tilt.type = 'lowpass';
  tilt.frequency.value = 3800;
  tilt.Q.value = 0.5;
  const voiced = ctx.createGain();
  voiced.gain.setValueAtTime(0, t0);
  tilt.connect(voiced);
  srcs.forEach((s, n) => {
    s.type = 'sawtooth';
    const base = n ? o.rough! : 0;
    s.detune.setValueAtTime(base, t0);
    const jit = o.jitter ?? 12;
    for (let t = t0 + 0.03; t < end; t += 0.03 + Math.random() * 0.02) s.detune.linearRampToValueAtTime(base + rnd(-jit, jit), t);
    s.connect(tilt);
  });
  if (o.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vib[0];
    const depth = ctx.createGain();
    depth.gain.value = o.vib[1];
    lfo.connect(depth);
    srcs.forEach((s) => depth.connect(s.detune));
    lfo.start(t0);
    lfo.stop(end);
  }

  // Aire: ruido que pasa por la misma "boca" (suena a "j" o a respiración).
  const air = ctx.createBufferSource();
  air.buffer = k.noise;
  air.loop = true;
  const airHp = ctx.createBiquadFilter();
  airHp.type = 'highpass';
  airHp.frequency.value = 450;
  const breath = ctx.createGain();
  breath.gain.setValueAtTime(0, t0);
  air.connect(airHp).connect(breath);

  const mouth = ctx.createGain();
  mouth.gain.value = o.vol;
  const first = VOWELS[syls[0].v];
  const bank = first.map(([f, q, g]) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f * shift, t0);
    bp.Q.setValueAtTime(q, t0);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(g, t0);
    voiced.connect(bp);
    breath.connect(bp);
    bp.connect(amp).connect(mouth);
    return { bp, amp };
  });
  if (o.rasp) {
    const j = ctx.createBiquadFilter();
    j.type = 'bandpass';
    j.frequency.value = 1700 * shift;
    j.Q.value = 1.3;
    const jg = ctx.createGain();
    jg.gain.value = o.rasp;
    breath.connect(j).connect(jg).connect(mouth);
  }

  syls.forEach((s, i) => {
    const a = t0 + s.at;
    const next = syls[i + 1];
    // El tono no se encima con el de la sílaba siguiente.
    const d = next ? Math.min(s.dur, next.at - s.at) : s.dur;
    const f2 = s.f * Math.pow((s.f2 ?? s.f) / s.f, d / s.dur);
    srcs.forEach((x) => {
      x.frequency.setValueAtTime(s.f, a);
      x.frequency.exponentialRampToValueAtTime(f2, a + d);
    });
    VOWELS[s.v].forEach(([f, q, g], n) => {
      bank[n].bp.frequency.setTargetAtTime(f * shift, a, 0.018);
      bank[n].bp.Q.setTargetAtTime(q, a, 0.018);
      bank[n].amp.gain.setTargetAtTime(g, a, 0.018);
    });
    const vol = s.vol ?? 1;
    const h = s.h ?? 0;
    const tied = i > 0 && syls[i - 1].tie;
    if (h > 0) breath.gain.setTargetAtTime(0.85 * vol, a, 0.006);
    breath.gain.setTargetAtTime((s.breath ?? 0.06) * vol, a + h, 0.02);
    voiced.gain.setTargetAtTime(vol, a + h * 0.6, tied ? 0.03 : 0.012);
    if (!s.tie) {
      const off = a + s.dur * 0.7;
      voiced.gain.setTargetAtTime(0, off, s.dur * 0.1);
      breath.gain.setTargetAtTime(0, off, s.dur * 0.08);
    }
  });

  output(k, mouth, o.wet ?? 0.15, o.pan);
  srcs.forEach((s) => {
    s.start(t0);
    s.stop(end);
  });
  air.start(t0, Math.random());
  air.stop(end);
  return length + (o.at ?? 0);
}

interface ToneOpts {
  type?: OscillatorType;
  f: number;
  f2?: number;
  at?: number;
  dur: number;
  vol: number;
  attack?: number;
  pan?: number;
  wet?: number;
}

function tone(k: Kit, { type = 'sine', f, f2, at = 0, dur, vol, attack = 0.005, pan, wet = 0.15 }: ToneOpts) {
  const { ctx } = k;
  const t = ctx.currentTime + 0.01 + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  output(k, g, wet, pan);
  o.start(t);
  o.stop(t + dur + 0.05);
}

interface HissOpts {
  filter?: BiquadFilterType;
  f: number;
  f2?: number;
  q?: number;
  at?: number;
  dur: number;
  vol: number;
  attack?: number;
  pan?: number;
  wet?: number;
}

function hiss(k: Kit, { filter = 'bandpass', f, f2, q = 1, at = 0, dur, vol, attack = 0.004, pan, wet = 0.15 }: HissOpts) {
  const { ctx } = k;
  const t = ctx.currentTime + 0.01 + at;
  const src = ctx.createBufferSource();
  src.buffer = k.noise;
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
  output(k, g, wet, pan);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

/** Muchos golpecitos de ruido con un solo filtro (aplausos, chasquidos del fuego). */
function clicks(k: Kit, hits: { at: number; vol: number; dur: number; burst?: boolean }[], f: number, q: number, pan: number, wet = 0.2, type: BiquadFilterType = 'bandpass') {
  const { ctx } = k;
  const t0 = ctx.currentTime + 0.01;
  const fl = ctx.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = q;
  output(k, fl, wet, pan);
  for (const h of hits) {
    const t = t0 + h.at;
    const src = ctx.createBufferSource();
    src.buffer = k.noise;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    if (h.burst) {
      // Aplauso: tres choques muy seguidos y una cola corta (las palmas no chocan de una vez).
      for (let n = 0; n < 3; n++) {
        g.gain.setValueAtTime(h.vol * (n === 2 ? 1 : 0.7), t + n * 0.008);
        g.gain.setTargetAtTime(0.0001, t + n * 0.008 + 0.001, 0.0025);
      }
      g.gain.setValueAtTime(h.vol, t + 0.024);
      g.gain.setTargetAtTime(0, t + 0.025, h.dur / 4);
    } else {
      g.gain.setValueAtTime(h.vol, t);
      g.gain.setTargetAtTime(0, t + 0.0005, h.dur / 4);
    }
    src.connect(g).connect(fl);
    src.start(t, Math.random() * 1.8);
    src.stop(t + h.dur + 0.03);
  }
}

// ---------------------------------------------------------------- 😂 Risas

/** Carcajada: "¡ja ja ja ja jaaa!" y una aspiración al final. */
function guffaw(k: Kit) {
  const base = rnd(250, 310);
  const n = 5 + Math.floor(Math.random() * 3);
  const syls: Syl[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const per = 0.155 + i * 0.008 + rnd(-0.01, 0.01);
    const f = base * (1.14 - i * 0.04) * (i === 0 ? 1.08 : 1);
    syls.push({ v: 'a', at: t, dur: last ? 0.3 : per * 0.94, f, f2: f * (last ? 0.76 : 0.86), h: 0.045, vol: 1 - i * 0.05, breath: 0.1 });
    if (!last) t += per;
  }
  // Se queda sin aire.
  syls.push({ v: 'e', at: t + 0.42, dur: 0.3, f: base * 2.1, f2: base * 2.5, vol: 0.22, breath: 1.1 });
  return speak(k, syls, { vol: 2.3, vib: [6, 14], jitter: 18, rasp: 0.35, wet: 0.16 });
}

/** Risita: "ji ji ji ji" aguda y rápida. */
function giggle(k: Kit) {
  const base = rnd(420, 500);
  const n = 6 + Math.floor(Math.random() * 3);
  const syls: Syl[] = [];
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const f = base * (1.06 - i * 0.022);
    syls.push({ v: i % 3 === 2 ? 'e' : 'i', at: i * 0.115, dur: last ? 0.22 : 0.105, f, f2: f * (last ? 0.8 : 0.9), h: 0.03, vol: 1 - i * 0.04, breath: 0.12 });
  }
  return speak(k, syls, { vol: 2.6, shift: 1.12, vib: [7, 22], jitter: 20, rasp: 0.2, wet: 0.14 });
}

/** Risa de villano: "¡muajajajá!", grave y con eco (muy de impostor). */
function evilLaugh(k: Kit) {
  const b = rnd(128, 150);
  const syls: Syl[] = [
    { v: 'm', at: 0, dur: 0.13, f: b, f2: b * 1.08, tie: true },
    { v: 'u', at: 0.13, dur: 0.07, f: b * 1.08, f2: b * 1.2, tie: true },
    { v: 'a', at: 0.2, dur: 0.42, f: b * 1.35, f2: b * 1.12, breath: 0.1 },
  ];
  for (let i = 0; i < 5; i++) {
    const f = b * (1.32 - i * 0.05);
    syls.push({ v: 'a', at: 0.66 + i * 0.165, dur: 0.15, f, f2: f * 0.86, h: 0.05, vol: 0.95, breath: 0.1 });
  }
  syls.push({ v: 'a', at: 0.66 + 5 * 0.165, dur: 0.6, f: b * 1.45, f2: b * 0.92, h: 0.05, breath: 0.12 });
  return speak(k, syls, { vol: 2.2, shift: 0.9, vib: [5, 22], jitter: 14, rasp: 0.4, wet: 0.5 });
}

// ---------------------------------------------------------------- Las demás

/** 😱 Se le va el aire y grita: "¡AAAAH!". */
function scream(k: Kit) {
  const f = rnd(780, 900);
  hiss(k, { f: 1100, f2: 2400, q: 1.2, dur: 0.17, vol: 0.12, attack: 0.13, wet: 0.1 });
  const len = speak(
    k,
    [
      { v: 'a', at: 0, dur: 0.14, f: f * 0.58, f2: f, h: 0.01, breath: 0.25, tie: true },
      { v: 'a', at: 0.14, dur: 0.5, f, f2: f * 1.06, breath: 0.25, tie: true },
      { v: 'a', at: 0.64, dur: 0.38, f: f * 1.06, f2: f * 0.66, vol: 0.85, breath: 0.3 },
    ],
    { vol: 1.5, at: 0.17, shift: 1.14, vib: [7.5, 45], jitter: 30, rough: 22, rasp: 0.25, wet: 0.3 },
  );
  return len;
}

/** 🤔 "Mmmmm…" pensando. */
function think(k: Kit) {
  const f = rnd(200, 225);
  return speak(
    k,
    [
      { v: 'm', at: 0, dur: 0.36, f, f2: f * 0.93, tie: true, breath: 0.02 },
      { v: 'm', at: 0.36, dur: 0.32, f: f * 0.93, f2: f * 1.12, tie: true, breath: 0.02 },
      { v: 'm', at: 0.68, dur: 0.48, f: f * 1.12, f2: f * 0.95, vol: 0.9, breath: 0.02 },
    ],
    { vol: 2.4, vib: [5, 12], jitter: 10, wet: 0.15 },
  );
}

/** 🤨 Chasquido de lengua y un "¿eeeh?" que sube. */
function doubt(k: Kit) {
  hiss(k, { filter: 'highpass', f: 3200, dur: 0.014, vol: 0.4, wet: 0.08 });
  const f = rnd(175, 200);
  return speak(
    k,
    [
      { v: 'e', at: 0, dur: 0.16, f, f2: f * 0.96, h: 0.03, tie: true },
      { v: 'e', at: 0.16, dur: 0.44, f: f * 0.96, f2: f * 1.75, vol: 1 },
    ],
    { vol: 2.2, at: 0.15, vib: [5.5, 14], jitter: 12, wet: 0.16 },
  );
}

/** 🔪 Navaja que sale de la funda: "shhhiiing". */
function knife(k: Kit) {
  hiss(k, { f: 700, f2: 2600, q: 1.4, dur: 0.17, vol: 0.12, attack: 0.12, wet: 0.2 });
  hiss(k, { f: 2600, f2: 7500, q: 3.5, at: 0.13, dur: 0.38, vol: 0.22, wet: 0.45 });
  // Metal: parciales que no forman acorde y laten un poco entre sí.
  [2380, 3712, 5190, 6935, 8470].forEach((f, i) => {
    const vol = 0.06 / (1 + i * 0.35);
    tone(k, { f, at: 0.14, dur: 1.2 - i * 0.12, vol, wet: 0.5 });
    tone(k, { f: f * 1.004, at: 0.14, dur: 1.0 - i * 0.1, vol: vol * 0.7, wet: 0.5 });
  });
  return 1.35;
}

/** 👀 La mirada va de un lado al otro (suena a la izquierda y luego a la derecha). */
function eyes(k: Kit) {
  [
    [0, -0.8],
    [0.24, 0.8],
  ].forEach(([at, pan]) => {
    tone(k, { type: 'triangle', f: 640, f2: 1350, at, dur: 0.09, vol: 0.2, pan, wet: 0.12 });
    tone(k, { f: 1300, f2: 2700, at, dur: 0.08, vol: 0.06, pan, wet: 0.12 });
    hiss(k, { f: 3000, f2: 5000, q: 2, at, dur: 0.07, vol: 0.08, pan, wet: 0.1 });
  });
  return 0.4;
}

/** 🫣 Traga saliva y se le escapa un "uuuy…". */
function peek(k: Kit) {
  hiss(k, { filter: 'lowpass', f: 900, dur: 0.03, vol: 0.25, wet: 0.05 });
  tone(k, { f: 560, f2: 190, at: 0.015, dur: 0.13, vol: 0.2, wet: 0.08 });
  tone(k, { type: 'triangle', f: 760, f2: 300, at: 0.015, dur: 0.1, vol: 0.08, wet: 0.08 });
  const f = rnd(320, 350);
  return speak(
    k,
    [
      { v: 'u', at: 0, dur: 0.42, f, f2: f * 0.92, breath: 0.2, tie: true },
      { v: 'i', at: 0.42, dur: 0.2, f: f * 0.92, f2: f * 0.82, breath: 0.25 },
    ],
    { vol: 2.6, at: 0.3, shift: 1.05, vib: [8.5, 55], jitter: 16, wet: 0.18 },
  );
}

/** 🤡 Bocina de payaso: ¡mok, mok! */
function honk(k: Kit) {
  const { ctx } = k;
  const t0 = ctx.currentTime + 0.01;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(512);
  for (let i = 0; i < 512; i++) curve[i] = Math.tanh(((i / 511) * 2 - 1) * 3);
  shaper.curve = curve;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1050;
  bp.Q.value = 1.1;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3400;
  const out = ctx.createGain();
  out.gain.value = 0.22;
  shaper.connect(bp).connect(lp).connect(out);
  output(k, out, 0.18);
  const f = rnd(330, 360);
  [0, 0.25].forEach((at) => {
    const t = t0 + at;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.014);
    g.gain.setValueAtTime(0.9, t + 0.13);
    g.gain.linearRampToValueAtTime(0, t + 0.18);
    g.connect(shaper);
    (['sawtooth', 'square'] as const).forEach((type, n) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f * 0.82, t);
      o.frequency.exponentialRampToValueAtTime(f * (n ? 1.006 : 1), t + 0.025);
      o.frequency.linearRampToValueAtTime(f * 0.97, t + 0.18);
      const m = ctx.createGain();
      m.gain.value = n ? 0.35 : 0.5;
      o.connect(m).connect(g);
      o.start(t);
      o.stop(t + 0.22);
    });
  });
  return 0.5;
}

/** 🔥 Se prende: "¡fuuum!" y chasquidos de fuego. */
function fire(k: Kit) {
  hiss(k, { filter: 'lowpass', f: 300, f2: 3200, q: 0.8, dur: 1.0, vol: 0.9, attack: 0.18, wet: 0.25 });
  hiss(k, { f: 700, f2: 1900, q: 0.7, dur: 0.9, vol: 0.45, attack: 0.15, wet: 0.25 });
  for (const pan of [-0.6, 0, 0.6]) {
    const hits = Array.from({ length: 6 }, () => ({ at: rnd(0.12, 1.2), vol: rnd(0.1, 0.3), dur: rnd(0.004, 0.014) }));
    clicks(k, hits, rnd(2200, 4500), 0.9, pan, 0.15, 'highpass');
  }
  return 1.25;
}

/** 👏 Aplausos de varias personas, cada una con su ritmo y su lugar. */
function clap(k: Kit) {
  const len = 1.5;
  for (let p = 0; p < 7; p++) {
    const rate = rnd(4.2, 5.6);
    const hits = [];
    for (let t = rnd(0, 0.12); t < len; t += 1 / rate + rnd(-0.015, 0.015)) {
      const fade = Math.min(1, t / 0.08, (len - t) / 0.5);
      hits.push({ at: t, vol: rnd(0.35, 0.6) * Math.max(0.05, fade), dur: 0.06, burst: true });
    }
    clicks(k, hits, rnd(950, 1700), rnd(1, 1.8), rnd(-0.75, 0.75), 0.22);
  }
  return len;
}

/** Cada sonido con su volumen (igualados para que se oigan parejo en la bocina de un celular). */
export const REACTION_VOICES = {
  guffaw: [guffaw, 0.6],
  giggle: [giggle, 0.45],
  evilLaugh: [evilLaugh, 0.6],
  scream: [scream, 0.3],
  think: [think, 0.6],
  doubt: [doubt, 0.45],
  knife: [knife, 2.8],
  eyes: [eyes, 4.5],
  peek: [peek, 0.6],
  honk: [honk, 2.6],
  fire: [fire, 2.6],
  clap: [clap, 3.2],
} satisfies Record<string, [(k: Kit) => number, number]>;
export type ReactionVoice = keyof typeof REACTION_VOICES;

const BY_EMOJI: Record<string, ReactionVoice | (() => ReactionVoice)> = {
  // Cada quien se ríe distinto: carcajada, risita o, de vez en cuando, risa de villano.
  '😂': () => {
    const r = Math.random();
    return r < 0.15 ? 'evilLaugh' : r < 0.5 ? 'giggle' : 'guffaw';
  },
  '😱': 'scream',
  '🤔': 'think',
  '🤨': 'doubt',
  '🔪': 'knife',
  '👀': 'eyes',
  '🫣': 'peek',
  '🤡': 'honk',
  '🔥': 'fire',
  '👏': 'clap',
};

/** Reacciones que tienen sonido (todas deberían tenerlo). */
export const hasReactionSound = (e: string) => e in BY_EMOJI;

/** Toca un sonido por su nombre, con su volumen y sin graves que la bocina no puede dar. */
export function playVoice(k: Kit, name: ReactionVoice) {
  const [play, level] = REACTION_VOICES[name];
  const { ctx } = k;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 130;
  const bus = ctx.createGain();
  bus.gain.value = level;
  bus.connect(hp).connect(k.master);
  const verb = ctx.createGain();
  verb.gain.value = level;
  verb.connect(k.verb);
  const dur = play({ ...k, master: bus, verb });
  window.setTimeout(() => {
    bus.disconnect();
    verb.disconnect();
    hp.disconnect();
  }, (dur + 3) * 1000);
  return dur;
}

let busy: number[] = [];
const last = new Map<string, number>();

/**
 * Toca el sonido de una reacción. En la sala pueden llegar muchas juntas: se tocan hasta 3 a
 * la vez y la misma no se repite antes de un cuarto de segundo. `preview` se salta el límite.
 */
export function reactionSound(e: string, preview = false): boolean {
  const k = sfx.kit();
  const voice = BY_EMOJI[e];
  if (!k || !voice) return false;
  const now = k.ctx.currentTime;
  busy = busy.filter((t) => t > now);
  if (!preview && (busy.length >= 3 || now - (last.get(e) ?? -9) < 0.25)) return false;
  const dur = playVoice(k, typeof voice === 'function' ? voice() : voice);
  last.set(e, now);
  busy.push(now + dur);
  return true;
}

