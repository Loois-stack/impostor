/**
 * Guiones de voz para las reacciones: risas, grito, "mmm", "¿eeeh?", "¡TÚ!", llanto, gallina,
 * trompetilla y ronquido. Cada función arma una partitura (`Take`) para la caja de voz.
 *
 * Las risas siguen cómo se ríe la gente de verdad: ráfagas de "ja" con aire al inicio, el tono
 * sube un poco y cae, cada "ja" sale más bajito y más grave, la última se rompe en carraspeo y
 * al final se jala aire (a veces con un chillidito). Todo cambia un poco cada vez.
 */
import { Take, rng, type Vowel } from './voicebox';

export type R = () => number;
const between = (r: R, a: number, b: number) => a + r() * (b - a);

/** La voz de alguien: tono de su risa y tamaño de su boca. */
export interface Speaker {
  f0: number;
  vtl: number;
}

/** Elige una voz: grave, aguda o muy aguda. */
export function speaker(r: R): Speaker {
  const kind = r();
  if (kind < 0.42) return { f0: between(r, 205, 265), vtl: between(r, 0.96, 1.04) };
  if (kind < 0.84) return { f0: between(r, 295, 370), vtl: between(r, 1.1, 1.18) };
  return { f0: between(r, 390, 460), vtl: between(r, 1.2, 1.28) };
}

/** La misma persona siempre tiene la misma voz (en todos los teléfonos de la sala). */
export function speakerFor(id: string): Speaker {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return speaker(rng(h));
}

/** Tono para hablar (más grave que el de la risa). */
const talk = (sp: Speaker) => sp.f0 * 0.62;

interface Call {
  t: number;
  f0: number;
  dur: number;
  /** Aire antes de la voz ("j"). */
  h?: number;
  v?: Vowel;
  vol?: number;
  rise?: number;
  fall?: number;
  creak?: number;
  br?: number;
  nasal?: number;
  af?: number;
}

/** Un "ja": aire, la voz sube un poco y cae, y a veces se rompe al final. Devuelve cuándo termina. */
function ha(k: Take, c: Call) {
  const h = c.h ?? 0.04;
  const vol = c.vol ?? 1;
  const vt = c.t + h;
  const end = vt + c.dur;
  k.key(c.t, { ah: 0, av: 0, af: 0, v: c.v ?? 'a', nasal: c.nasal ?? 0, creak: 0 });
  if (h > 0.008) k.key(c.t + Math.min(0.012, h * 0.4), { ah: 0.5 * vol, af: (c.af ?? 0.1) * vol });
  k.key(vt - 0.003, { ah: 0.12 * vol, af: 0, av: 0, f0: c.f0, br: c.br ?? 0.35, oq: 0.66 });
  k.key(vt + 0.015, { av: vol });
  k.key(vt + c.dur * 0.3, { f0: c.f0 * (c.rise ?? 1.06) });
  if (c.creak) {
    k.key(end - 0.035, { av: vol * 0.85, f0: c.f0 * (c.fall ?? 0.84), creak: 0 });
    k.key(end, { creak: c.creak, av: vol * 0.55 });
    k.key(end + 0.05, { av: 0, ah: 0.04 * vol, creak: c.creak });
    k.key(end + 0.06, { creak: 0, ah: 0 });
    return end + 0.06;
  }
  k.key(end - 0.02, { av: vol * 0.8, f0: c.f0 * (c.fall ?? 0.84) });
  k.key(end + 0.012, { av: 0, ah: 0.07 * vol });
  k.key(end + 0.045, { ah: 0 });
  return end + 0.045;
}

/** Jalar aire después de reír, con un chillidito. */
function inhale(k: Take, t: number, f0: number, dur = 0.3, voiced = 0.3) {
  k.key(t, { ah: 0, av: 0, v: 'i', creak: 0 });
  k.key(t + 0.06, { ah: 0.35 });
  k.key(t + 0.08, { av: 0, f0, br: 0.8, oq: 0.8 });
  k.key(t + 0.12, { av: voiced });
  k.key(t + dur - 0.06, { av: voiced * 0.8, f0: f0 * 1.12, ah: 0.3 });
  k.key(t + dur, { av: 0, ah: 0 });
  return t + dur;
}

/** Ronquido de cerdito: aire jalado por la nariz que vibra lento y disparejo. */
function snort(k: Take, t: number, vol = 1) {
  k.key(t, { av: 0, ah: 0, af: 0, v: 'ə', nasal: 0.7, creak: 1 });
  k.key(t + 0.015, { av: 0.8 * vol, ah: 0.8 * vol, af: 0.6 * vol, f0: 70, oq: 0.3, br: 0.3 });
  k.key(t + 0.11, { av: 0.7 * vol, ah: 0.6 * vol, af: 0.4 * vol });
  k.key(t + 0.14, { av: 0, ah: 0, af: 0 });
  k.key(t + 0.15, { creak: 0, nasal: 0 });
  return t + 0.15;
}

// ---------------------------------------------------------------- Risas

/** Carcajada: "¡ja ja ja ja jaaa!", jala aire y a veces le vuelve a dar. */
export function guffaw(r: R, sp: Speaker) {
  const k = new Take(sp.vtl, 0.014, 0.1);
  k.vib = [5.5, 0.008];
  const n = 5 + Math.floor(r() * 3);
  let t = 0.01;
  let end = 0;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    end = ha(k, {
      t,
      f0: sp.f0 * (1.2 - i * 0.045) * (i === 0 ? 1.08 : 1),
      dur: last ? between(r, 0.15, 0.2) : between(r, 0.075, 0.1),
      h: i === 0 ? 0.06 : between(r, 0.035, 0.05),
      vol: 1 - i * 0.06,
      creak: last ? 0.7 : r() < 0.2 ? 0.4 : 0,
      fall: last ? 0.72 : 0.84,
      af: 0.15,
    });
    t = Math.max(end + 0.005, t + between(r, 0.16, 0.19) + i * 0.008);
  }
  end = inhale(k, end + 0.1, sp.f0 * 2.1, 0.3, 0.25);
  if (r() < 0.5) {
    let t2 = end + 0.08;
    const m = 2 + Math.floor(r() * 2);
    for (let i = 0; i < m; i++) {
      const e = ha(k, { t: t2, f0: sp.f0 * (1.05 - i * 0.05), dur: i === m - 1 ? 0.14 : 0.08, vol: 0.65 - i * 0.08, creak: i === m - 1 ? 0.6 : 0 });
      t2 = e + 0.06;
    }
  }
  return k;
}

/** Risita: "ji ji ji ji", rápida y aguda (a veces con la boca cerrada: "jm jm jm"). */
export function giggle(r: R, sp: Speaker) {
  const k = new Take(sp.vtl * 1.05, 0.016, 0.12);
  k.vib = [6, 0.01];
  const n = 6 + Math.floor(r() * 3);
  const closed = r() < 0.4;
  let t = 0.01;
  let end = 0;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    end = ha(k, {
      t,
      f0: sp.f0 * 1.3 * (1.08 - i * 0.03),
      dur: last ? 0.12 : between(r, 0.045, 0.06),
      h: 0.028,
      vol: 1 - i * 0.05,
      br: 0.5,
      v: closed ? (i % 2 ? 'm' : 'ə') : i % 3 === 2 ? 'e' : 'i',
      nasal: closed ? 0.6 : 0,
      fall: 0.86,
      creak: last ? 0.4 : 0,
    });
    t = Math.max(end + 0.004, t + between(r, 0.11, 0.13));
  }
  if (r() < 0.6) inhale(k, end + 0.07, sp.f0 * 2.4, 0.22, 0.45);
  return k;
}

/** Risa de villano: "¡muajajajajá!", grave y ronca. */
export function evilLaugh(r: R) {
  const f = between(r, 105, 130);
  const k = new Take(0.88, 0.012, 0.09);
  k.vib = [5, 0.012];
  k.key(0, { v: 'm', av: 0, ah: 0, f0: f, oq: 0.55, br: 0.15 });
  k.key(0.02, { av: 0.9 });
  k.key(0.14, { v: 'm', f0: f * 1.05 });
  k.key(0.2, { v: 'u', f0: f * 1.15 });
  k.key(0.3, { v: 'a', f0: f * 1.4, av: 1 });
  k.key(0.55, { f0: f * 1.3 });
  k.key(0.68, { f0: f * 1.12, av: 0.8 });
  k.key(0.72, { av: 0, ah: 0.05 });
  let t = 0.8;
  for (let i = 0; i < 6; i++) {
    const end = ha(k, { t, f0: f * (1.4 - i * 0.04), dur: 0.1, h: 0.05, af: 0.35, vol: 0.95, br: 0.2, fall: 0.85 });
    t = Math.max(end + 0.01, t + 0.18);
  }
  ha(k, { t, f0: f * 1.5, dur: 0.55, h: 0.05, af: 0.35, br: 0.2, fall: 0.6, creak: 0.8, rise: 1.04 });
  return k;
}

/** Risa de cerdito: carcajada con ronquidos por la nariz. */
export function snortLaugh(r: R, sp: Speaker) {
  const k = new Take(sp.vtl, 0.015, 0.1);
  k.vib = [5.5, 0.008];
  const patterns = ['hhhs hhs ss', 'shhh s hh s', 'hhs hhhs s'];
  const pattern = patterns[Math.floor(r() * patterns.length)];
  let t = 0.01;
  let i = 0;
  for (const ch of pattern) {
    if (ch === ' ') t += 0.08;
    else if (ch === 's') t = snort(k, t) + 0.06;
    else {
      t = ha(k, { t, f0: sp.f0 * (1.18 - i * 0.035), dur: between(r, 0.07, 0.095), h: 0.04, vol: 1 - i * 0.04 }) + 0.01;
      i++;
    }
  }
  return k;
}

/** 🤣 Ataque de risa: se le escapa por la nariz, explota, se queda sin aire, ronca y "¡ay, no!". */
export function hysterical(r: R, sp: Speaker) {
  const k = new Take(sp.vtl, 0.02, 0.14);
  k.vib = [6, 0.012];
  let t = 0.01;
  for (let i = 0; i < 3; i++) t = ha(k, { t, f0: sp.f0 * 1.25, dur: 0.05, h: 0.025, v: 'm', nasal: 0.8, br: 0.4, vol: 0.6 + i * 0.1 }) + 0.03;
  for (let i = 0; i < 6; i++) {
    t = ha(k, { t, f0: sp.f0 * (1.3 + i * 0.07), dur: 0.07, h: 0.035, af: 0.15, br: 0.45 }) + 0.005;
    // Se pega en la rodilla.
    if (i === 1 || i === 4) k.marks.push(t - 0.06);
  }
  // Ya sin voz: puro aire y chillido.
  for (let i = 0; i < 3; i++) {
    k.key(t, { ah: 0, av: 0, v: 'i', creak: 0 });
    k.key(t + 0.02, { ah: 0.55 });
    k.key(t + 0.03, { av: 0, f0: sp.f0 * 2.6, br: 0.9 });
    k.key(t + 0.05, { av: 0.18 });
    k.key(t + 0.11, { ah: 0.4, av: 0.12 });
    k.key(t + 0.13, { ah: 0, av: 0 });
    t += between(r, 0.16, 0.19);
  }
  t = snort(k, t + 0.02) + 0.05;
  t = snort(k, t) + 0.14;
  // "¡Ay, no!"
  const f = talk(sp) * 1.5;
  k.key(t, { ah: 0, av: 0, v: 'a', creak: 0, nasal: 0 });
  k.key(t + 0.02, { av: 1, f0: f, br: 0.3, oq: 0.6 });
  k.key(t + 0.12, { f0: f * 1.08 });
  k.key(t + 0.2, { v: 'i' });
  k.key(t + 0.27, { f0: f * 0.75, av: 0.8 });
  k.key(t + 0.31, { av: 0 });
  t += 0.4;
  k.key(t, { v: 'm', av: 0 });
  k.key(t + 0.02, { av: 0.9, f0: f * 0.9 });
  k.key(t + 0.07, { v: 'm' });
  k.key(t + 0.12, { v: 'o' });
  k.key(t + 0.36, { f0: f * 0.62, av: 0.8, creak: 0 });
  k.key(t + 0.42, { av: 0.4, creak: 0.6 });
  k.key(t + 0.46, { av: 0, creak: 0 });
  return k;
}

// ---------------------------------------------------------------- Otras voces

/** 😱 Se le va el aire y grita: "¡AAAAH!". */
export function scream(r: R, sp: Speaker) {
  const f = Math.min(950, sp.f0 * 2.2) * between(r, 0.95, 1.05);
  const k = new Take(sp.vtl * 1.08, 0.03, 0.15);
  k.vib = [7, 0.035];
  k.key(0, { v: 'a', ah: 0, av: 0 });
  k.key(0.12, { ah: 0.4 });
  k.key(0.17, { ah: 0 });
  k.key(0.18, { av: 0, f0: f * 0.6, br: 0.3, oq: 0.5 });
  k.key(0.2, { av: 0.8, ah: 0.1 });
  k.key(0.32, { av: 1, f0: f });
  k.key(0.8, { f0: f * 1.05, av: 1, v: 'a' });
  k.key(1.1, { f0: f * 0.7, av: 0.7 });
  k.key(1.18, { av: 0, ah: 0.05 });
  k.key(1.25, { ah: 0 });
  return k;
}

/** 🤔 "Mmmmm…" pensando. */
export function think(r: R, sp: Speaker) {
  const f = talk(sp) * between(r, 1.05, 1.15);
  const k = new Take(sp.vtl, 0.01, 0.05);
  k.vib = [4.5, 0.008];
  // Boca casi cerrada y el aire por la nariz ("hmmm"): se oye bien hasta en la bocina del celular.
  k.key(0, { v: 'm', av: 0, ah: 0, f0: f, oq: 0.45, br: 0.05 });
  k.key(0.015, { ah: 0.2 });
  k.key(0.04, { av: 1, ah: 0 });
  k.key(0.35, { f0: f * 0.94 });
  k.key(0.7, { f0: f * 1.12 });
  k.key(1.05, { f0: f * 0.96, av: 0.85, creak: 0 });
  k.key(1.12, { av: 0.5, creak: 0.3 });
  k.key(1.2, { av: 0 });
  return k;
}

/** 🤨 "¿Eeeeh?" que empieza ronco y sube. */
export function doubt(r: R, sp: Speaker) {
  const f = talk(sp) * between(r, 0.95, 1.05);
  const k = new Take(sp.vtl, 0.012, 0.07);
  k.vib = [5, 0.008];
  k.key(0, { v: 'e', ah: 0, av: 0 });
  k.key(0.01, { ah: 0.3 });
  k.key(0.03, { ah: 0.05, av: 0, f0: f, creak: 0.6, oq: 0.5, br: 0.15 });
  k.key(0.05, { av: 0.9 });
  k.key(0.16, { creak: 0, f0: f * 0.97 });
  k.key(0.3, { f0: f * 1.05 });
  k.key(0.62, { f0: f * 1.85, av: 1 });
  k.key(0.68, { av: 0, ah: 0.05 });
  k.key(0.72, { ah: 0 });
  return k;
}

/** 🫣 "Uuuuy…" temblorosa. */
export function uy(r: R, sp: Speaker) {
  const f = talk(sp) * 1.7 * between(r, 0.95, 1.05);
  const k = new Take(sp.vtl * 1.05, 0.02, 0.12);
  k.vib = [8.5, 0.04];
  k.key(0, { v: 'u', av: 0, ah: 0, f0: f, br: 0.4, oq: 0.7 });
  k.key(0.04, { av: 0.9, ah: 0.05 });
  k.key(0.4, { f0: f * 0.94, v: 'u' });
  k.key(0.55, { v: 'i', f0: f * 0.86 });
  k.key(0.62, { av: 0.7 });
  k.key(0.66, { av: 0, ah: 0.08 });
  k.key(0.72, { ah: 0 });
  return k;
}

/** 🫵 "¡TÚ!": la "t" explota y el tono cae, acusador. */
export function tu(r: R, sp: Speaker) {
  const f = talk(sp) * between(r, 1.15, 1.25);
  const k = new Take(sp.vtl * 0.98, 0.01, 0.06);
  k.vib = [5, 0.01];
  k.key(0, { v: 'u', ah: 0, af: 0, av: 0 });
  k.key(0.002, { ah: 0.9, af: 0.6 });
  k.key(0.014, { ah: 0.3, af: 0.1 });
  k.key(0.03, { ah: 0.05, af: 0, av: 0, f0: f * 1.05, br: 0.15, oq: 0.5 });
  k.key(0.045, { av: 1 });
  k.key(0.15, { f0: f * 1.1 });
  k.key(0.38, { f0: f * 0.78, av: 0.9, creak: 0 });
  k.key(0.44, { av: 0.4, creak: 0.5 });
  k.key(0.48, { av: 0, creak: 0, ah: 0.04 });
  k.key(0.52, { ah: 0 });
  return k;
}

/** 😭 "¡Buaaaa!", hipeo y otra vez "¡buaaa!". */
export function cry(r: R, sp: Speaker) {
  const f = Math.max(330, sp.f0) * between(r, 1, 1.12);
  const k = new Take(Math.max(1.15, sp.vtl * 1.06), 0.025, 0.15);
  k.vib = [6.5, 0.05];
  const wail = (t: number, len: number, vol: number) => {
    k.key(t, { v: 'u', av: 0, ah: 0, f0: f * 0.9, br: 0.35, oq: 0.6, creak: 0 });
    k.key(t + 0.02, { av: 0.8 * vol });
    k.key(t + 0.1, { v: 'u', av: vol });
    k.key(t + 0.2, { v: 'a', f0: f * 1.1 });
    k.key(t + len * 0.5, { f0: f * 1.35 });
    k.key(t + len - 0.2, { f0: f * 1.1, av: 0.9 * vol });
    k.key(t + len - 0.05, { f0: f * 0.85, av: 0.6 * vol, creak: 0.3 });
    k.key(t + len, { av: 0, creak: 0, ah: 0.1 });
    k.key(t + len + 0.04, { ah: 0 });
    return t + len + 0.04;
  };
  let t = wail(0, 1.15, 1) + 0.08;
  for (let i = 0; i < 2; i++) {
    k.key(t, { ah: 0, av: 0, v: 'i' });
    k.key(t + 0.02, { ah: 0.5 });
    k.key(t + 0.04, { av: 0.5, f0: f * 1.5, br: 0.7 });
    k.key(t + 0.09, { av: 0, ah: 0 });
    t += 0.16;
  }
  wail(t + 0.04, 0.6, 0.75);
  return k;
}

/** 🐔 Gallina: "co, co, co… ¡cocooó!". */
export function chicken(r: R) {
  const base = between(r, 520, 620);
  const k = new Take(1.5, 0.035, 0.22);
  k.vib = [0, 0];
  let t = 0.02;
  const n = 4 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    k.key(t, { v: 'o', av: 0, ah: 0, f0: base * between(r, 0.95, 1.08), oq: 0.45, br: 0.1 });
    k.key(t + 0.008, { av: 1 });
    k.key(t + 0.05, { av: 0.8, f0: base * 0.85 });
    k.key(t + 0.065, { av: 0 });
    t += between(r, 0.11, 0.2);
  }
  k.key(t, { v: 'ə', av: 0, f0: base });
  k.key(t + 0.01, { av: 0.8 });
  k.key(t + 0.06, { av: 0 });
  t += 0.09;
  k.key(t, { v: 'a', av: 0, f0: base * 1.2, br: 0.2 });
  k.key(t + 0.015, { av: 1 });
  k.key(t + 0.12, { f0: base * 1.55 });
  k.key(t + 0.32, { f0: base * 1.15, av: 0.9 });
  k.key(t + 0.36, { av: 0 });
  return k;
}

/** 😝 Trompetilla: "¡pffrrrrt!" con los labios. */
export function raspberry(r: R) {
  const f = between(r, 95, 130);
  const k = new Take(1, 0.09, 0.4);
  k.vib = [0, 0];
  k.key(0, { v: 'o', av: 0, ah: 0 });
  k.key(0.01, { ah: 0.8, af: 0.5 });
  k.key(0.05, { ah: 0.5, af: 0.45, av: 0, f0: f, oq: 0.3, br: 0.3 });
  k.key(0.07, { av: 1 });
  for (let t = 0.12; t < 0.85; t += 0.07) k.key(t, { f0: f * between(r, 0.75, 1.3), v: r() < 0.5 ? 'ə' : 'o', creak: between(r, 0, 0.35), ah: between(r, 0.35, 0.6) });
  k.key(0.9, { av: 0.8 });
  k.key(0.95, { av: 0, ah: 0.1 });
  k.key(1.0, { ah: 0 });
  return k;
}

/** 😴 Ronquido: "khhhrrr…" (el silbido de salida lo pone `reactions.ts`). */
export function snore(r: R) {
  const k = new Take(0.95, 0.05, 0.3);
  k.vib = [0, 0];
  k.key(0, { v: 'ə', nasal: 0.25, av: 0, ah: 0, af: 0, creak: 1, f0: 60, oq: 0.3, br: 0.4 });
  k.key(0.15, { av: 0.5, ah: 0.4, af: 0.3 });
  k.key(0.55 + between(r, -0.05, 0.05), { av: 1, ah: 0.7, af: 0.5, v: 'a' });
  k.key(0.85, { av: 0.6, ah: 0.5, af: 0.3 });
  k.key(0.95, { av: 0, ah: 0, af: 0 });
  k.key(1.15, { v: 'u', nasal: 0, creak: 0, ah: 0 });
  k.key(1.25, { ah: 0.3 });
  k.key(1.6, { ah: 0.18 });
  k.key(1.75, { ah: 0 });
  return k;
}
