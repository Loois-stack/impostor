/**
 * Sonidos de las animaciones de eliminación, hechos desde cero con Web Audio y al compás de cada
 * video (los tiempos salen de los cuadros de las escenas de Blender, a 24 por segundo).
 */
import type { ElimId } from '../data/eliminations';
import { clicks, hiss, output, tone } from './reactions';
import { sfx, type Kit } from './sfx';

const F = (frame: number) => frame / 24;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Retumbo grave que crece (ruido filtrado). */
function rumble(k: Kit, at: number, dur: number, vol: number, f = 220, f2 = 90) {
  hiss(k, { filter: 'lowpass', f, f2, q: 0.7, at, dur, vol, attack: dur * 0.85, wet: 0.3 });
}

/** Golpe grave con cuerpo. */
function boom(k: Kit, at: number, vol: number, f = 140, f2 = 38, dur = 0.9) {
  tone(k, { f, f2, at, dur, vol, wet: 0.35 });
  tone(k, { type: 'triangle', f: f * 2, f2: f2 * 2, at, dur: dur * 0.4, vol: vol * 0.35, wet: 0.3 });
  hiss(k, { filter: 'lowpass', f: 1600, f2: 200, at, dur: dur * 0.6, vol: vol * 0.7, wet: 0.4 });
}

/** ⚡ Tormenta: zumbido eléctrico que sube, ¡CRACK! y trueno que rueda. */
function rayo(k: Kit) {
  const strike = F(22);
  rumble(k, 0, strike + 0.2, 0.35, 180, 120);
  // Estática que se acelera.
  const hits = [];
  for (let t = 0.05; t < strike; t += rnd(0.03, 0.12) * (1 - t / strike) + 0.012) hits.push({ at: t, vol: rnd(0.2, 0.6) * (0.3 + t / strike), dur: rnd(0.004, 0.012) });
  clicks(k, hits, 4200, 0.8, 0, 0.1, 'highpass');
  tone(k, { type: 'sawtooth', f: 90, f2: 720, dur: strike, vol: 0.05, attack: strike * 0.9, wet: 0.2 });
  // Destellos previos (cuadros 9 y 15).
  for (const fr of [9, 15]) hiss(k, { filter: 'highpass', f: 2500, at: F(fr), dur: 0.08, vol: 0.18, wet: 0.2 });
  // El rayo.
  hiss(k, { filter: 'highpass', f: 1800, at: strike, dur: 0.18, vol: 0.5, attack: 0.002, wet: 0.5 });
  hiss(k, { f: 3500, q: 0.6, at: strike + 0.02, dur: 0.12, vol: 0.5, attack: 0.002, wet: 0.5 });
  boom(k, strike, 0.7, 120, 32, 1.4);
  // Trueno que rueda y chisporroteo.
  rumble(k, strike + 0.1, 1.4, 0.55, 600, 90);
  hiss(k, { filter: 'highpass', f: 5000, at: strike + 0.05, dur: 1.3, vol: 0.12, attack: 0.05, wet: 0.2 });
  const sizzle = [];
  for (let i = 0; i < 40; i++) sizzle.push({ at: strike + rnd(0.1, 1.5), vol: rnd(0.1, 0.4), dur: rnd(0.003, 0.01) });
  clicks(k, sizzle, 3000, 1, 0, 0.15, 'highpass');
}

/** 🕳️ Agujero negro: remolino que sube y jala todo, implosión y silencio con brillo. */
function agujero(k: Kit) {
  const collapse = F(46);
  // Zumbido que se hunde.
  const o = tone(k, { type: 'sawtooth', f: 160, f2: 38, dur: collapse, vol: 0.08, attack: 0.4, wet: 0.4 });
  const lfo = k.ctx.createOscillator();
  lfo.frequency.value = 6;
  const d = k.ctx.createGain();
  d.gain.value = 30;
  lfo.connect(d).connect(o.detune);
  lfo.start(k.ctx.currentTime);
  lfo.stop(k.ctx.currentTime + collapse);
  // Viento que gira (pasa de izquierda a derecha).
  for (const [at, pan] of [[0.1, -0.7], [0.55, 0.7], [0.95, -0.7], [1.3, 0.7], [1.6, -0.5]] as const)
    hiss(k, { f: 600, f2: 2600, q: 2.5, at, dur: 0.5, vol: 0.18 + at * 0.08, attack: 0.3, pan, wet: 0.4 });
  hiss(k, { f: 300, f2: 4000, q: 1.2, at: 0.2, dur: collapse - 0.2, vol: 0.25, attack: collapse - 0.3, wet: 0.4 });
  // Implosión: un instante de silencio y ¡THUMP!
  boom(k, collapse, 1.0, 90, 28, 1.6);
  tone(k, { f: 1200, f2: 60, at: collapse - 0.12, dur: 0.14, vol: 0.18, wet: 0.2 });
  // Brillo que queda.
  for (let i = 0; i < 8; i++) tone(k, { f: rnd(1800, 4200), at: collapse + 0.15 + i * 0.07, dur: 0.6, vol: 0.035, wet: 0.9 });
}

/** 🪅 Piñata: ¡pum!, ¡pum!, ¡CRACK! y lluvia de dulces con espantasuegras. */
function pinata(k: Kit) {
  const whack = (at: number, vol: number) => {
    tone(k, { f: 180, f2: 70, at, dur: 0.18, vol: vol * 0.7, wet: 0.15 });
    hiss(k, { f: 900, f2: 400, q: 1.2, at, dur: 0.12, vol: vol * 0.55, wet: 0.15 });
    // Cartón que cruje.
    clicks(
      k,
      Array.from({ length: 10 }, () => ({ at: at + rnd(0, 0.09), vol: rnd(0.1, 0.28) * vol, dur: rnd(0.004, 0.015) })),
      2200,
      0.9,
      0,
      0.1,
    );
  };
  whack(F(10), 0.7);
  whack(F(22), 0.85);
  const pop = F(34);
  whack(pop, 1);
  boom(k, pop, 0.7, 160, 50, 0.7);
  hiss(k, { filter: 'highpass', f: 2500, at: pop, dur: 0.5, vol: 0.4, wet: 0.4 });
  // Dulces y papelitos cayendo.
  for (const pan of [-0.6, 0, 0.6]) {
    const hits = Array.from({ length: 22 }, () => ({ at: pop + rnd(0.15, 1.5), vol: rnd(0.1, 0.35), dur: rnd(0.006, 0.02) }));
    clicks(k, hits, rnd(2500, 4500), 1.5, pan, 0.2);
  }
  // Espantasuegras: ¡prrreeee!
  const { ctx } = k;
  const t = ctx.currentTime + 0.01 + pop + 0.25;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(330, t);
  osc.frequency.linearRampToValueAtTime(520, t + 0.5);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(400, t);
  lp.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.05);
  g.gain.setValueAtTime(0.12, t + 0.5);
  g.gain.linearRampToValueAtTime(0, t + 0.6);
  osc.connect(lp).connect(g);
  output(k, g, 0.2);
  osc.start(t);
  osc.stop(t + 0.65);
  // Brillitos.
  for (let i = 0; i < 6; i++) tone(k, { f: rnd(2200, 3800), at: pop + 0.1 + i * 0.08, dur: 0.3, vol: 0.04, wet: 0.7 });
}

/** 🚀 Cohete: mecha que chispea, despegue con silbido y tres fuegos artificiales. */
function cohete(k: Kit) {
  const launch = F(14);
  // Mecha.
  hiss(k, { f: 4000, q: 1.5, dur: launch, vol: 0.18, attack: 0.05, wet: 0.1 });
  clicks(
    k,
    Array.from({ length: 26 }, () => ({ at: rnd(0, launch), vol: rnd(0.15, 0.45), dur: rnd(0.003, 0.009) })),
    5000,
    1,
    0,
    0.05,
    'highpass',
  );
  // Despegue: rugido y silbido que sube.
  hiss(k, { filter: 'lowpass', f: 400, f2: 2500, q: 0.8, at: launch, dur: 1.1, vol: 0.6, attack: 0.05, wet: 0.3 });
  boom(k, launch, 0.5, 110, 45, 0.6);
  tone(k, { f: 500, f2: 2600, at: launch + 0.05, dur: 1.0, vol: 0.07, attack: 0.1, wet: 0.3 });
  // Fuegos artificiales: boom y crepitar.
  for (const [fr, vol, pan] of [
    [40, 0.9, 0],
    [48, 0.6, -0.5],
    [54, 0.7, 0.5],
  ] as const) {
    const at = F(fr);
    boom(k, at, vol, 130, 40, 1.0);
    hiss(k, { filter: 'highpass', f: 3000, at, dur: 0.25, vol: vol * 0.4, pan, wet: 0.5 });
    clicks(
      k,
      Array.from({ length: 30 }, () => ({ at: at + rnd(0.3, 1.2), vol: rnd(0.1, 0.35) * vol, dur: rnd(0.003, 0.01) })),
      rnd(3500, 6000),
      1,
      pan,
      0.4,
      'highpass',
    );
  }
}

const PLAY: Record<ElimId, (k: Kit) => void> = { rayo, agujero, pinata, cohete };

/** Toca el sonido de una animación de eliminación (si el sonido está prendido). */
export function elimSound(id: ElimId) {
  const k = sfx.kit();
  if (!k) return;
  // Más presente que una reacción (es el momento estelar), sin saturar.
  const bus = k.ctx.createGain();
  bus.gain.value = 0.6;
  bus.connect(k.master);
  const verb = k.ctx.createGain();
  verb.gain.value = 0.6;
  verb.connect(k.verb);
  PLAY[id]({ ...k, master: bus, verb });
  window.setTimeout(() => {
    bus.disconnect();
    verb.disconnect();
  }, 6000);
}
