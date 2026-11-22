/**
 * Sonidos del sobre que se quema con fuego azul, hechos desde cero con Web Audio (ruido filtrado y
 * osciladores, sin grabaciones): cerillo, "¡fuuum!" al prender, llamas que rugen y truenan, y el
 * soplido cuando se deshace en ceniza.
 */
import { clicks, hiss, output, tone } from './reactions';
import { sfx, type Kit } from './sfx';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function bus(vol: number, ms: number): Kit | null {
  const k = sfx.kit();
  if (!k) return null;
  const g = k.ctx.createGain();
  g.gain.value = vol;
  g.connect(k.master);
  const v = k.ctx.createGain();
  v.gain.value = vol;
  v.connect(k.verb);
  window.setTimeout(() => {
    g.disconnect();
    v.disconnect();
  }, ms);
  return { ...k, master: g, verb: v };
}

/** Rugido de llamas: ruido grave que "respira" con dos vaivenes (así no suena a ruido parejo). */
function roar(k: Kit, at: number, dur: number, vol: number) {
  const { ctx } = k;
  const t = ctx.currentTime + 0.01 + at;
  const src = ctx.createBufferSource();
  src.buffer = k.noise;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.8;
  lp.frequency.setValueAtTime(350, t);
  lp.frequency.linearRampToValueAtTime(1300, t + dur * 0.7);
  lp.frequency.linearRampToValueAtTime(700, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.35, dur * 0.3));
  g.gain.setValueAtTime(vol, t + dur * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const flick = ctx.createGain();
  flick.gain.value = 1;
  for (const [rate, depth] of [
    [6.3, 0.25],
    [10.7, 0.18],
  ]) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const dg = ctx.createGain();
    dg.gain.value = depth;
    lfo.connect(dg).connect(flick.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  src.connect(lp).connect(flick).connect(g);
  output(k, g, 0.25);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

/** Cerillo que raspa y la llama que prende de golpe ("¡fuuum!"), con un brillo azul. */
export function fireIgnite() {
  const k = bus(1, 3000);
  if (!k) return;
  hiss(k, { f: 3200, q: 1.4, dur: 0.11, vol: 0.28, attack: 0.01, wet: 0.05 });
  clicks(k, Array.from({ length: 9 }, () => ({ at: rnd(0, 0.1), vol: rnd(0.2, 0.5), dur: rnd(0.003, 0.008) })), 4200, 1.2, 0, 0.05);
  hiss(k, { filter: 'lowpass', f: 160, f2: 1400, q: 0.9, at: 0.08, dur: 0.6, vol: 0.5, attack: 0.07, wet: 0.3 });
  tone(k, { f: 70, f2: 45, at: 0.09, dur: 0.4, vol: 0.32, wet: 0.2 });
  // Un brillito "mágico" porque el fuego es azul.
  for (const [i, f] of [1568, 2093, 2637].entries()) tone(k, { f, at: 0.12 + i * 0.05, dur: 0.5, vol: 0.022, wet: 0.8 });
}

/** Las llamas mientras se quema (dura `dur` segundos) y el soplido final cuando ya es ceniza. */
export function fireBurn(dur: number) {
  const k = bus(1, (dur + 2.5) * 1000);
  if (!k) return;
  roar(k, 0, dur + 0.4, 0.3);
  hiss(k, { filter: 'highpass', f: 4500, q: 0.6, dur: dur + 0.2, vol: 0.05, attack: dur * 0.4, wet: 0.2 });
  // Truenitos de la madera/papel: cada vez más seguidos y luego se calman.
  const pops = [];
  for (let i = 0; i < 70; i++) {
    const u = Math.pow(Math.random(), 0.8);
    pops.push({ at: u * dur, vol: rnd(0.12, 0.45) * (0.4 + 0.6 * Math.sin(u * Math.PI)), dur: rnd(0.003, 0.012) });
  }
  clicks(k, pops, 2600, 1.1, 0, 0.15);
  clicks(k, Array.from({ length: 22 }, () => ({ at: rnd(0.1, dur), vol: rnd(0.2, 0.5), dur: rnd(0.01, 0.025) })), 900, 1, 0, 0.15);
  // Se deshace: soplido que sube y un tono que cae (la ceniza se va volando).
  hiss(k, { f: 500, f2: 3400, q: 1.6, at: dur - 0.15, dur: 0.6, vol: 0.22, attack: 0.25, wet: 0.4 });
  tone(k, { type: 'triangle', f: 880, f2: 220, at: dur - 0.05, dur: 0.5, vol: 0.03, wet: 0.5 });
}
