/**
 * Sonidos de las reacciones, hechos desde cero en el teléfono (sin grabaciones ni memes ajenos).
 *
 * Las voces (risas, grito, "mmm", "¡TÚ!", llanto, gallina…) salen de la caja de voz
 * (`voicebox.ts`) con los guiones de `voices.ts`; cada jugador tiene su propia voz, la misma en
 * todos los teléfonos. Los efectos (navaja, bocina, tambor, trombón…) se arman con Web Audio.
 */
import { usePrefs } from '../store/prefs';
import { decodeSound, isSound, resample, SOUND_RATE } from './recordings';
import { sfx, type Kit } from './sfx';
import { render, type Take } from './voicebox';
import * as V from './voices';

type R = () => number;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function output(k: Kit, node: AudioNode, wet: number, pan = 0) {
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

/** Convierte una partitura en sonido y la toca. Devuelve cuánto dura. */
function voice(k: Kit, take: Take, o: { at?: number; wet?: number; pan?: number; vol?: number } = {}) {
  const sr = Math.min(k.ctx.sampleRate, 24000);
  const data = render(take, sr);
  const buf = k.ctx.createBuffer(1, data.length, sr);
  buf.getChannelData(0).set(data);
  const src = k.ctx.createBufferSource();
  src.buffer = buf;
  const g = k.ctx.createGain();
  g.gain.value = o.vol ?? 1;
  src.connect(g);
  output(k, g, o.wet ?? 0.12, o.pan);
  src.start(k.ctx.currentTime + 0.01 + (o.at ?? 0));
  return data.length / sr + (o.at ?? 0);
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

export function tone(k: Kit, { type = 'sine', f, f2, at = 0, dur, vol, attack = 0.005, pan, wet = 0.15 }: ToneOpts) {
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
  return o;
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

export function hiss(k: Kit, { filter = 'bandpass', f, f2, q = 1, at = 0, dur, vol, attack = 0.004, pan, wet = 0.15 }: HissOpts) {
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
export function clicks(k: Kit, hits: { at: number; vol: number; dur: number; burst?: boolean }[], f: number, q: number, pan: number, wet = 0.2, type: BiquadFilterType = 'bandpass') {
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

/** Metal de banda (trombón, acorde de suspenso): diente de sierra con un filtro que se abre. */
function brass(k: Kit, at: number, freqs: number[], dur: number, vol: number, wah: [number, number, number] = [300, 2200, 900], vib = 0) {
  const { ctx } = k;
  const t = ctx.currentTime + 0.01 + at;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 3;
  lp.frequency.setValueAtTime(wah[0], t);
  lp.frequency.exponentialRampToValueAtTime(wah[1], t + Math.min(0.12, dur * 0.4));
  lp.frequency.exponentialRampToValueAtTime(wah[2], t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.03);
  g.gain.setValueAtTime(vol * 0.85, t + dur - 0.06);
  g.gain.linearRampToValueAtTime(0, t + dur);
  lp.connect(g);
  output(k, g, 0.35);
  // Vibrato que entra poco a poco (la nota larga del trombón "llora").
  let depth: GainNode | undefined;
  if (vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(vib, t + dur * 0.4);
    lfo.connect(depth);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  for (const f of freqs)
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = det;
      o.frequency.setValueAtTime(f * 0.97, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      depth?.connect(o.detune);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
}

// ---------------------------------------------------------------- Voces

/** 🤣 Ataque de risa con palmadas en la rodilla. */
function rofl(k: Kit, sp: V.Speaker, r: R) {
  const take = V.hysterical(r, sp);
  for (const at of take.marks) {
    hiss(k, { f: 900, q: 0.9, at, dur: 0.08, vol: 0.5, wet: 0.1 });
    tone(k, { f: 160, f2: 90, at, dur: 0.09, vol: 0.4, wet: 0.05 });
  }
  return voice(k, take);
}

/** 🫣 Traga saliva y se le escapa un "uuuy…". */
function peek(k: Kit, sp: V.Speaker, r: R) {
  hiss(k, { filter: 'lowpass', f: 900, dur: 0.03, vol: 0.25, wet: 0.05 });
  tone(k, { f: 560, f2: 190, at: 0.015, dur: 0.13, vol: 0.2, wet: 0.08 });
  tone(k, { type: 'triangle', f: 760, f2: 300, at: 0.015, dur: 0.1, vol: 0.08, wet: 0.08 });
  return voice(k, V.uy(r, sp), { at: 0.28 });
}

/** 🤨 Chasquido de lengua y "¿eeeh?". */
function doubt(k: Kit, sp: V.Speaker, r: R) {
  hiss(k, { filter: 'highpass', f: 3200, dur: 0.014, vol: 0.4, wet: 0.08 });
  return voice(k, V.doubt(r, sp), { at: 0.14 });
}

/** 🫵 "¡TÚ!" y acorde de suspenso: dun… dun… ¡duuun! */
function accuse(k: Kit, sp: V.Speaker, r: R) {
  voice(k, V.tu(r, sp), { wet: 0.2 });
  const s = 0.62;
  brass(k, s, [98, 146.8], 0.17, 0.09);
  brass(k, s + 0.26, [98, 146.8], 0.17, 0.09);
  brass(k, s + 0.55, [92.5, 138.6, 110], 1.3, 0.1, [300, 2600, 700], 18);
  hiss(k, { filter: 'lowpass', f: 500, at: s + 0.55, dur: 1.2, vol: 0.18, attack: 0.05, wet: 0.3 });
  tone(k, { f: 73.4, at: s + 0.55, dur: 1.2, vol: 0.25, attack: 0.02, wet: 0.2 });
  return s + 1.9;
}

/** 😴 Ronquido y silbido al soltar el aire. */
function snore(k: Kit, _sp: V.Speaker, r: R) {
  voice(k, V.snore(r));
  const w = tone(k, { f: 1500, f2: 900, at: 1.2, dur: 0.55, vol: 0.08, attack: 0.08, wet: 0.2 });
  // El silbido tiembla un poco.
  const lfo = k.ctx.createOscillator();
  lfo.frequency.value = 7;
  const d = k.ctx.createGain();
  d.gain.value = 25;
  lfo.connect(d).connect(w.detune);
  lfo.start(k.ctx.currentTime + 1.2);
  lfo.stop(k.ctx.currentTime + 1.8);
  return 1.85;
}

// ---------------------------------------------------------------- Efectos

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

/** 🎺 Trombón triste: "wa, wa, wa, waaaaa". */
function trombone(k: Kit) {
  const notes: [number, number, number][] = [
    [0, 233.1, 0.3],
    [0.36, 220, 0.3],
    [0.72, 207.7, 0.3],
    [1.08, 196, 1.15],
  ];
  notes.forEach(([at, f, dur], i) => brass(k, at, [f], dur, 0.16, i < 3 ? [350, 1700, 500] : [350, 1900, 380], i === 3 ? 35 : 0));
  return 2.3;
}

/** 🥁 Chiste malo: ba-dum… ¡tss! */
function rimshot(k: Kit) {
  // Tarola.
  tone(k, { type: 'triangle', f: 210, f2: 160, dur: 0.1, vol: 0.35, wet: 0.15 });
  hiss(k, { f: 2000, q: 0.8, dur: 0.16, vol: 0.4, wet: 0.2 });
  // Tom.
  tone(k, { f: 150, f2: 95, at: 0.17, dur: 0.32, vol: 0.55, wet: 0.15 });
  tone(k, { type: 'triangle', f: 300, f2: 190, at: 0.17, dur: 0.12, vol: 0.12, wet: 0.15 });
  hiss(k, { filter: 'lowpass', f: 1200, at: 0.17, dur: 0.08, vol: 0.15, wet: 0.1 });
  // Platillo.
  hiss(k, { filter: 'highpass', f: 6500, at: 0.4, dur: 1.3, vol: 0.32, wet: 0.35 });
  hiss(k, { f: 9500, q: 0.7, at: 0.4, dur: 1.0, vol: 0.14, wet: 0.35 });
  [3150, 4225, 5340, 6890].forEach((f) => tone(k, { type: 'square', f, at: 0.4, dur: 0.9, vol: 0.012, wet: 0.4 }));
  return 1.75;
}

/** 💀 "Me muero": silbato que cae, ¡pum! y pajaritos. */
function dead(k: Kit) {
  const w = tone(k, { f: 1700, f2: 260, dur: 0.75, vol: 0.18, attack: 0.03, wet: 0.2 });
  tone(k, { type: 'triangle', f: 3400, f2: 520, dur: 0.72, vol: 0.03, attack: 0.03, wet: 0.2 });
  const lfo = k.ctx.createOscillator();
  lfo.frequency.value = 9;
  const d = k.ctx.createGain();
  d.gain.value = 35;
  lfo.connect(d).connect(w.detune);
  lfo.start(k.ctx.currentTime);
  lfo.stop(k.ctx.currentTime + 0.85);
  // Golpe.
  tone(k, { f: 220, f2: 65, at: 0.8, dur: 0.35, vol: 0.6, wet: 0.15 });
  tone(k, { type: 'triangle', f: 520, f2: 400, at: 0.8, dur: 0.08, vol: 0.2, wet: 0.15 });
  hiss(k, { filter: 'lowpass', f: 1400, at: 0.8, dur: 0.12, vol: 0.35, wet: 0.15 });
  // Pajaritos dando vueltas.
  [0, 0.14, 0.28, 0.42].forEach((at, i) =>
    tone(k, { f: i % 2 ? 2900 : 3500, f2: i % 2 ? 3300 : 3000, at: 1.0 + at, dur: 0.1, vol: 0.05, pan: i % 2 ? 0.6 : -0.6, wet: 0.4 }),
  );
  return 1.65;
}

/** 🤫 "¡Shhhh!". */
function shush(k: Kit) {
  hiss(k, { f: 3000, f2: 2700, q: 1.6, dur: 0.95, vol: 0.4, attack: 0.12, wet: 0.15 });
  hiss(k, { f: 5200, q: 2, dur: 0.9, vol: 0.12, attack: 0.15, wet: 0.15 });
  hiss(k, { f: 1900, q: 3, dur: 0.85, vol: 0.08, attack: 0.15, wet: 0.1 });
  return 1;
}

/** 🍿 Palomitas: pop, pop, pop… y a masticar. */
function popcorn(k: Kit) {
  let t = 0.02;
  let gap = 0.22;
  for (let i = 0; i < 11; i++) {
    const f = rnd(420, 760);
    const pan = rnd(-0.7, 0.7);
    tone(k, { f, f2: f * 0.55, at: t, dur: 0.045, vol: rnd(0.2, 0.35), pan, wet: 0.12 });
    hiss(k, { filter: 'highpass', f: 2500, at: t, dur: 0.012, vol: 0.25, pan, wet: 0.08 });
    t += gap * rnd(0.6, 1.2);
    gap = Math.max(0.05, gap * 0.8);
  }
  // Ñam, ñam.
  for (let i = 0; i < 3; i++) {
    const at = t + 0.12 + i * 0.2;
    clicks(
      k,
      Array.from({ length: 9 }, () => ({ at: at + rnd(0, 0.09), vol: rnd(0.15, 0.35), dur: rnd(0.006, 0.02) })),
      rnd(1500, 2500),
      0.8,
      0,
      0.05,
    );
  }
  return t + 0.8;
}

/** Cada sonido con su volumen (igualados para que se oigan parejo en la bocina de un celular). */
export const REACTION_VOICES = {
  // Risas (😂 elige una al azar). [sonido, volumen, corte de graves en Hz]
  guffaw: [(k, sp, r) => voice(k, V.guffaw(r, sp)), 0.5, 170],
  giggle: [(k, sp, r) => voice(k, V.giggle(r, sp)), 0.5, 300],
  evil: [(k, _sp, r) => voice(k, V.evilLaugh(r), { wet: 0.45 }), 0.6, 170],
  piggy: [(k, sp, r) => voice(k, V.snortLaugh(r, sp)), 0.7, 260],
  rofl: [rofl, 0.6, 170],
  scream: [(k, sp, r) => voice(k, V.scream(r, sp), { wet: 0.25 }), 0.32],
  think: [(k, sp, r) => voice(k, V.think(r, sp)), 0.55, 380],
  doubt: [doubt, 0.33],
  eyes: [eyes, 4.4],
  peek: [peek, 0.27, 300],
  accuse: [accuse, 0.6, 200],
  knife: [knife, 2.65],
  chicken: [(k, _sp, r) => voice(k, V.chicken(r), { wet: 0.12 }), 0.53],
  raspberry: [(k, _sp, r) => voice(k, V.raspberry(r), { wet: 0.08 }), 0.55],
  honk: [honk, 1.9],
  cry: [(k, sp, r) => voice(k, V.cry(r, sp), { wet: 0.22 }), 0.35],
  dead: [dead, 1.5, 200],
  snore: [snore, 1.6, 350],
  shush: [shush, 2.5],
  popcorn: [popcorn, 3.2],
  rimshot: [rimshot, 1.15],
  trombone: [trombone, 1.25],
  fire: [fire, 2.8],
  clap: [clap, 3.1],
} satisfies Record<string, [play: (k: Kit, sp: V.Speaker, r: R) => number, level: number, lowCut?: number]>;
export type ReactionVoice = keyof typeof REACTION_VOICES;

const BY_EMOJI: Record<string, ReactionVoice | ((r: R) => ReactionVoice)> = {
  // Cada vez una risa distinta: carcajada, risita, de cerdito o, de vez en cuando, de villano.
  '😂': (r) => {
    const x = r();
    return x < 0.12 ? 'evil' : x < 0.27 ? 'piggy' : x < 0.55 ? 'giggle' : 'guffaw';
  },
  '🤣': 'rofl',
  '😱': 'scream',
  '🤔': 'think',
  '🤨': 'doubt',
  '👀': 'eyes',
  '🫣': 'peek',
  '🫵': 'accuse',
  '🔪': 'knife',
  '🐔': 'chicken',
  '😝': 'raspberry',
  '🤡': 'honk',
  '😭': 'cry',
  '💀': 'dead',
  '😴': 'snore',
  '🤫': 'shush',
  '🍿': 'popcorn',
  '🥁': 'rimshot',
  '🎺': 'trombone',
  '🔥': 'fire',
  '👏': 'clap',
};

/** Reacciones que tienen sonido (todas deberían tenerlo). */
export const hasReactionSound = (e: string) => e in BY_EMOJI;

/** Toca un sonido por su nombre, con su volumen y sin graves que la bocina no puede dar. */
export function playVoice(k: Kit, name: ReactionVoice, sp: V.Speaker = V.speaker(Math.random), r: R = Math.random) {
  const [play, level, lowCut] = REACTION_VOICES[name] as [(k: Kit, sp: V.Speaker, r: R) => number, number, number?];
  const { ctx } = k;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = lowCut ?? 130;
  const bus = ctx.createGain();
  bus.gain.value = level;
  bus.connect(hp).connect(k.master);
  const verb = ctx.createGain();
  verb.gain.value = level;
  verb.connect(k.verb);
  const dur = play({ ...k, master: bus, verb }, sp, r);
  window.setTimeout(() => {
    bus.disconnect();
    verb.disconnect();
    hp.disconnect();
  }, (dur + 3) * 1000);
  return dur;
}

/** Calienta la caja de voz cuando la app está quieta, para que la primera risa no tarde más. */
if (typeof window !== 'undefined')
  window.setTimeout(() => {
    const warm = () => render(V.guffaw(Math.random, V.speaker(Math.random)), 16000);
    if ('requestIdleCallback' in window) window.requestIdleCallback(warm);
    else warm();
  }, 4000);

// ---------------------------------------------------------------- Sonidos grabados

/** Sala: los sonidos grabados de cada teléfono, por reacción (solo en memoria, mientras dure la sala). */
const roomSounds = new Map<string, Map<string, string>>();
const decoded = new Map<string, Float32Array>();

/** Sala: llegó (o se borró) un sonido grabado de un teléfono. */
export function setRoomSound(pid: string, e: string, d: string | null) {
  if (!hasReactionSound(e)) return;
  const mine = roomSounds.get(pid) ?? new Map<string, string>();
  if (d && isSound(d)) mine.set(e, d);
  else mine.delete(e);
  if (mine.size) roomSounds.set(pid, mine);
  else roomSounds.delete(pid);
}

/** Para pruebas: qué sonidos grabados tenemos de cada teléfono. */
export const roomSoundIds = () => Object.fromEntries([...roomSounds].map(([pid, m]) => [pid, [...m.keys()]]));

/** Al salir de la sala se olvidan los sonidos de los demás. */
export const clearRoomSounds = () => {
  roomSounds.clear();
  decoded.clear();
};

/** El sonido grabado que le toca a una reacción: el tuyo, o el de quien la mandó en la sala. */
export const recordedFor = (e: string, who?: string, mine = !who) => (mine ? usePrefs.getState().sounds[e] : who ? roomSounds.get(who)?.get(e) : undefined);

/** Toca un sonido grabado (un poquito distinto cada vez). */
function playRecorded(k: Kit, d: string) {
  let x = decoded.get(d);
  if (!x) {
    // Se sube a 24 kHz para que cualquier navegador lo pueda tocar.
    x = resample(decodeSound(d), SOUND_RATE, 24000);
    if (decoded.size > 40) decoded.clear();
    decoded.set(d, x);
  }
  const buf = k.ctx.createBuffer(1, x.length, 24000);
  buf.getChannelData(0).set(x);
  const src = k.ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 0.96 + Math.random() * 0.1;
  const g = k.ctx.createGain();
  g.gain.value = 0.55;
  src.connect(g);
  output(k, g, 0.1);
  src.start(k.ctx.currentTime + 0.01);
  return x.length / 24000 / src.playbackRate.value;
}

let busy: { until: number }[] = [];
const last = new Map<string, number>();

/**
 * Toca el sonido de una reacción. `who` es quien la mandó: cada jugador tiene su propia voz y
 * suena igual en todos los teléfonos. En la sala pueden llegar muchas juntas: se tocan hasta 3 a
 * la vez y la misma no se repite antes de un cuarto de segundo. `preview` se salta el límite.
 */
export function reactionSound(e: string, who?: string, preview = false, mine = !who): boolean {
  const k = sfx.kit();
  const name = BY_EMOJI[e];
  if (!k || !name) return false;
  // Si quien la mandó grabó su propio sonido para esta reacción, suena con su voz.
  const recorded = recordedFor(e, who, mine);
  const now = k.ctx.currentTime;
  busy = busy.filter((b) => b.until > now);
  if (!preview && (busy.length >= 3 || now - (last.get(e) ?? -9) < 0.25)) return false;
  last.set(e, now);
  const slot = { until: now + 2 };
  busy.push(slot);
  if (recorded) {
    slot.until = now + playRecorded(k, recorded);
    return true;
  }
  const voiceName = typeof name === 'function' ? name(Math.random) : name;
  const sp = who ? V.speakerFor(who) : V.speaker(Math.random);
  // Las voces se calculan en el teléfono: primero se dibuja la burbuja y luego se arma el sonido.
  requestAnimationFrame(() =>
    setTimeout(() => {
      slot.until = k.ctx.currentTime + playVoice(k, voiceName, sp);
    }, 0),
  );
  return true;
}
