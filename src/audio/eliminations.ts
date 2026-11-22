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

/** Zumbido eléctrico de caricatura ("¡bzzzt!") que se prende y apaga al compás de las descargas. */
function buzz(k: Kit, at: number, gates: [number, number][], vol: number) {
  const { ctx } = k;
  const t = ctx.currentTime + 0.01 + at;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(92, t);
  const o2 = ctx.createOscillator();
  o2.type = 'sawtooth';
  o2.frequency.setValueAtTime(139, t);
  const lp = ctx.createBiquadFilter();
  lp.type = 'bandpass';
  lp.frequency.value = 1400;
  lp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  for (const [a, b] of gates) {
    g.gain.setValueAtTime(0, t + a);
    g.gain.linearRampToValueAtTime(vol, t + a + 0.008);
    g.gain.setValueAtTime(vol, t + b - 0.01);
    g.gain.linearRampToValueAtTime(0, t + b);
  }
  o.connect(lp);
  o2.connect(lp);
  lp.connect(g);
  output(k, g, 0.15);
  const end = t + gates[gates.length - 1][1] + 0.05;
  for (const x of [o, o2]) {
    x.start(t);
    x.stop(end);
  }
}

/** ⚡ Tormenta: lluvia, truenos lejanos, el rayo guía que chisporrotea, ¡CRACK!, zumbido de rayos X, trueno y cenizas. */
function rayo(k: Kit) {
  const strike = F(22);
  // Lluvia de fondo (y su golpeteo).
  hiss(k, { filter: 'lowpass', f: 5200, q: 0.4, dur: 2.6, vol: 0.06, attack: 0.25, wet: 0.2 });
  hiss(k, { filter: 'highpass', f: 6500, q: 0.5, dur: 2.6, vol: 0.035, attack: 0.25, wet: 0.1 });
  clicks(k, Array.from({ length: 70 }, () => ({ at: rnd(0, 2.5), vol: rnd(0.04, 0.12), dur: rnd(0.004, 0.01) })), 3200, 1.2, 0, 0.1);
  // Truenos lejanos tras los relámpagos de los cuadros 9 y 15.
  rumble(k, F(9) + 0.12, 0.9, 0.16, 260, 70);
  rumble(k, F(15) + 0.1, 0.7, 0.12, 300, 80);
  rumble(k, 0, strike + 0.2, 0.3, 180, 120);
  // El rayo guía baja a tirones (cuadros 17–21).
  const lead = [];
  for (let fr = 17; fr <= 21; fr++) for (let i = 0; i < 6; i++) lead.push({ at: F(fr) + rnd(0, 0.035), vol: rnd(0.25, 0.55), dur: rnd(0.004, 0.01) });
  clicks(k, lead, 5200, 0.9, 0, 0.15, 'highpass');
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
  // Rayos X: ¡bzzt-bzzt-bzzt! mientras se ve la calavera (tres veces, con las descargas).
  buzz(k, strike, [[0, F(2)], [F(3), F(5)], [F(6), F(7.5)]], 0.11);
  // Se desmorona en cenizas (cuadros 38–50): crujido seco que cae y un soplido.
  const crumble = [];
  for (let i = 0; i < 60; i++) crumble.push({ at: F(38) + rnd(0, 0.5) * rnd(0.3, 1), vol: rnd(0.08, 0.25), dur: rnd(0.006, 0.02) });
  clicks(k, crumble, 1600, 0.8, 0, 0.15);
  hiss(k, { filter: 'lowpass', f: 1800, f2: 500, at: F(38), dur: 0.7, vol: 0.12, attack: 0.1, wet: 0.3 });
  tone(k, { type: 'triangle', f: 330, f2: 140, at: F(39), dur: 0.5, vol: 0.05, wet: 0.3 });
}

/** 🕳️ Agujero negro: se rasga el espacio, remolino que jala todo, chorros a pulsos, silbido que cae, implosión y una estrellita. */
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
  // Se rasga el espacio al abrirse (cuadros 1–12).
  hiss(k, { f: 180, f2: 1400, q: 1.5, dur: F(12), vol: 0.14, attack: F(10), wet: 0.5 });
  tone(k, { f: 38, f2: 64, dur: F(14), vol: 0.22, attack: F(8), wet: 0.3 });
  // Los chorros de energía salen a pulsos (cuadros 20, 28 y 36).
  for (const [fr, pan] of [[20, -0.4], [28, 0.4], [36, 0]] as const) {
    hiss(k, { filter: 'highpass', f: 2200, f2: 5200, at: F(fr), dur: 0.35, vol: 0.11, attack: 0.03, pan, wet: 0.5 });
    tone(k, { type: 'triangle', f: 220, f2: 440, at: F(fr), dur: 0.3, vol: 0.04, wet: 0.5 });
  }
  // Silbido que baja mientras el jugador cae (corrimiento al rojo).
  tone(k, { f: 1500, f2: 90, at: F(14), dur: F(43) - F(14), vol: 0.035, attack: 0.3, wet: 0.4 });
  // La estrellita que queda titila.
  for (const [fr, f] of [[53, 2637], [57, 3136], [61, 3520]] as const) tone(k, { f, at: F(fr), dur: 0.5, vol: 0.045, wet: 0.85 });
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
  // ¡Fiuuu! El palo corta el aire antes de cada golpe (el último viene del otro lado).
  for (const [fr, pan] of [[10, -0.5], [22, -0.5], [34, 0.5]] as const) hiss(k, { f: 500, f2: 2400, q: 2.2, at: F(fr) - 0.16, dur: 0.17, vol: 0.2, attack: 0.12, pan, wet: 0.1 });
  // La cuerda que rechina al mecerse y truena al romperse.
  for (const at of [0.25, 0.75, 1.15]) tone(k, { type: 'sawtooth', f: 520, f2: 380, at, dur: 0.14, vol: 0.012, attack: 0.05, wet: 0.2 });
  clicks(k, [{ at: pop + 0.02, vol: 0.5, dur: 0.02 }, { at: pop + 0.05, vol: 0.3, dur: 0.015 }], 1200, 1.5, 0, 0.2);
  // ¡Ta-dá! Fanfarria corta.
  for (const [i, f] of [523, 659, 784, 1047].entries()) {
    tone(k, { type: 'triangle', f, at: pop + 0.55 + i * 0.09, dur: i === 3 ? 0.6 : 0.16, vol: 0.06, wet: 0.35 });
    tone(k, { type: 'square', f: f * 2, at: pop + 0.55 + i * 0.09, dur: i === 3 ? 0.5 : 0.12, vol: 0.008, wet: 0.35 });
  }
}

/** 🚀 Cohete: mecha que chispea, despegue con silbido y cuatro fuegos artificiales que suben silbando. */
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
  // Fuegos artificiales: cada uno sube silbando y revienta (peonía 40, sauce 47, corazón 53, anillo 58).
  for (const [fr, vol, pan] of [
    [40, 0.9, 0],
    [47, 0.65, -0.5],
    [53, 0.7, 0.5],
    [58, 0.5, -0.3],
  ] as const) {
    const at = F(fr);
    tone(k, { f: 900, f2: 2400, at: at - F(9), dur: F(9), vol: 0.035, attack: 0.05, pan, wet: 0.4 });
    hiss(k, { f: 2500, q: 2, at: at - F(9), dur: F(9), vol: 0.05, attack: 0.05, pan, wet: 0.3 });
    boom(k, at, vol, 130, 40, 1.0);
    hiss(k, { filter: 'highpass', f: 3000, at, dur: 0.25, vol: vol * 0.4, pan, wet: 0.5 });
    clicks(
      k,
      Array.from({ length: fr === 47 ? 60 : 30 }, () => ({ at: at + rnd(0.3, fr === 47 ? 1.0 : 1.2), vol: rnd(0.1, 0.35) * vol, dur: rnd(0.003, 0.01) })),
      rnd(3500, 6000),
      1,
      pan,
      0.4,
      'highpass',
    );
  }
  // El sauce dorado cae siseando; el corazón deja campanitas.
  hiss(k, { filter: 'highpass', f: 4500, at: F(48), dur: 1.0, vol: 0.06, attack: 0.2, pan: -0.5, wet: 0.4 });
  for (const [i, f] of [1568, 1976, 2349].entries()) tone(k, { f, at: F(55) + i * 0.08, dur: 0.45, vol: 0.035, pan: 0.5, wet: 0.8 });
}

/** Tono con vibrato (el "uuuiiiuuu" de los platillos de película vieja). */
function wobble(k: Kit, { f, f2, at, dur, vol, rate = 7, depth = 40, type = 'sine' as OscillatorType, pan = 0 }: { f: number; f2?: number; at: number; dur: number; vol: number; rate?: number; depth?: number; type?: OscillatorType; pan?: number }) {
  const { ctx } = k;
  const t = ctx.currentTime + 0.01 + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const dg = ctx.createGain();
  dg.gain.value = depth;
  lfo.connect(dg).connect(o.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.15, dur / 3));
  g.gain.setValueAtTime(vol, t + dur * 0.75);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  output(k, g, 0.35, pan);
  for (const x of [o, lfo]) {
    x.start(t);
    x.stop(t + dur + 0.05);
  }
}

/** 🛸 Platillo: baja con su "uuuiii", zumba, prende el rayo, el jugador sube, ¡glup! y sale disparado. */
function ovni(k: Kit) {
  const [beam, hit, zoom] = [F(12), F(48), F(56)];
  wobble(k, { f: 1250, f2: 620, at: 0, dur: 0.55, vol: 0.06, rate: 8, depth: 60 });
  hiss(k, { f: 900, f2: 300, q: 1.2, dur: 0.5, vol: 0.12, attack: 0.2, wet: 0.3 });
  // Zumbido del motor (dos tonos que baten).
  for (const f of [70, 72.5]) tone(k, { type: 'sawtooth', f, at: 0.3, dur: zoom - 0.1, vol: 0.035, attack: 0.3, wet: 0.2 });
  // El rayo se prende y canta mientras sube el jugador.
  tone(k, { type: 'sawtooth', f: 180, f2: 900, at: beam, dur: 0.2, vol: 0.05, wet: 0.3 });
  hiss(k, { f: 1200, f2: 3000, q: 3, at: beam, dur: 0.25, vol: 0.12, wet: 0.4 });
  wobble(k, { f: 330, f2: 990, at: beam + 0.1, dur: hit - beam - 0.1, vol: 0.05, rate: 11, depth: 18, type: 'triangle' });
  wobble(k, { f: 660, f2: 1980, at: beam + 0.1, dur: hit - beam - 0.1, vol: 0.015, rate: 13, depth: 30 });
  for (let i = 0; i < 14; i++) tone(k, { f: rnd(2200, 4200), at: beam + 0.15 + i * 0.075 + rnd(0, 0.04), dur: 0.18, vol: 0.02, pan: rnd(-0.5, 0.5), wet: 0.7 });
  // ¡Glup!
  tone(k, { f: 160, f2: 950, at: hit - 0.02, dur: 0.12, vol: 0.2, wet: 0.2 });
  tone(k, { f: 520, f2: 140, at: hit + 0.12, dur: 0.14, vol: 0.14, wet: 0.2 });
  tone(k, { f: 380, f2: 120, at: hit + 0.24, dur: 0.12, vol: 0.09, wet: 0.2 });
  // El rayo se apaga.
  tone(k, { type: 'sawtooth', f: 900, f2: 90, at: hit + 0.05, dur: 0.3, vol: 0.035, wet: 0.3 });
  // ¡Fiuuum! Sale disparado hacia la derecha y deja un destello.
  wobble(k, { f: 500, f2: 3200, at: zoom, dur: 0.35, vol: 0.06, rate: 20, depth: 50, pan: 0.6 });
  hiss(k, { f: 600, f2: 5000, q: 1.5, at: zoom, dur: 0.35, vol: 0.12, attack: 0.05, pan: 0.6, wet: 0.3 });
  for (const [i, f] of [3136, 4186].entries()) tone(k, { f, at: F(63) + i * 0.07, dur: 0.5, vol: 0.04, pan: 0.6, wet: 0.85 });
}

/** 🧊 Hielo: ventisca, cristales que crujen al formarse, ¡clink!, se cuartea y estalla como vidrio. */
function hielo(k: Kit) {
  const [freeze, solid, smash] = [F(10), F(30), F(40)];
  // Ventisca que va y viene de lado a lado.
  for (const [at, pan] of [[0, -0.6], [0.45, 0.6], [0.9, -0.4], [1.9, 0.4]] as const) hiss(k, { f: 450, f2: 1300, q: 2.2, at, dur: 0.8, vol: 0.12, attack: 0.35, pan, wet: 0.4 });
  hiss(k, { filter: 'lowpass', f: 900, q: 0.5, dur: 3, vol: 0.05, attack: 0.3, wet: 0.3 });
  // Cristales que crecen: crujidos finos y un tono vidrioso que sube.
  const crys = [];
  for (let i = 0; i < 70; i++) crys.push({ at: freeze + rnd(0, solid - freeze) * Math.sqrt(Math.random()), vol: rnd(0.08, 0.3), dur: rnd(0.003, 0.008) });
  clicks(k, crys, 6500, 1.2, 0, 0.3, 'highpass');
  clicks(k, Array.from({ length: 16 }, () => ({ at: freeze + rnd(0.1, 0.7), vol: rnd(0.15, 0.35), dur: rnd(0.01, 0.03) })), 900, 1, 0, 0.2);
  wobble(k, { f: 620, f2: 1860, at: freeze, dur: solid - freeze, vol: 0.03, rate: 9, depth: 12 });
  // ¡Clink! Ya está congelado.
  tone(k, { type: 'triangle', f: 2489, at: solid, dur: 0.5, vol: 0.06, wet: 0.7 });
  tone(k, { f: 3729, at: solid + 0.01, dur: 0.4, vol: 0.03, wet: 0.7 });
  // Se cuartea (cuadros 32, 35 y 38).
  for (const fr of [32, 35, 38]) {
    hiss(k, { filter: 'highpass', f: 2500, at: F(fr), dur: 0.06, vol: 0.3, attack: 0.002, wet: 0.3 });
    tone(k, { type: 'square', f: 1700, f2: 900, at: F(fr), dur: 0.04, vol: 0.03, wet: 0.3 });
  }
  // ¡Estalla como vidrio!
  hiss(k, { filter: 'highpass', f: 1800, at: smash, dur: 0.5, vol: 0.55, attack: 0.002, wet: 0.5 });
  hiss(k, { f: 4500, q: 0.7, at: smash, dur: 0.3, vol: 0.35, attack: 0.002, wet: 0.5 });
  boom(k, smash, 0.5, 120, 45, 0.6);
  for (let i = 0; i < 40; i++) tone(k, { type: i % 3 ? 'sine' : 'triangle', f: rnd(1800, 6200), at: smash + 0.02 + Math.pow(Math.random(), 1.6) * 1.2, dur: rnd(0.08, 0.3), vol: rnd(0.015, 0.05), pan: rnd(-0.7, 0.7), wet: 0.6 });
  clicks(k, Array.from({ length: 40 }, () => ({ at: smash + 0.2 + rnd(0, 0.9), vol: rnd(0.1, 0.3), dur: rnd(0.004, 0.012) })), 5000, 1.5, 0, 0.3);
}

const PLAY: Record<ElimId, (k: Kit) => void> = { rayo, agujero, pinata, cohete, ovni, hielo };
/** Volumen de cada una para que suenen parejo (medido con un render sin conexión: RMS ≈ 0.035–0.065). */
const LEVEL: Record<ElimId, number> = { rayo: 1, agujero: 1, pinata: 1, cohete: 1, ovni: 3.4, hielo: 1.15 };

/** Toca el sonido de una animación de eliminación (si el sonido está prendido). */
export function elimSound(id: ElimId) {
  const k = sfx.kit();
  if (!k) return;
  // Más presente que una reacción (es el momento estelar), sin saturar.
  const bus = k.ctx.createGain();
  bus.gain.value = 0.6 * LEVEL[id];
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
