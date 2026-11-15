/**
 * Caja de voz: sintetiza una voz humana muestra por muestra, sin grabaciones.
 *
 * Es un sintetizador de formantes en cascada (como los que se usan en fonética):
 * - Cuerdas vocales: cada ciclo es un pulso de aire que se abre y se cierra, con pequeñas
 *   imperfecciones de tono (jitter) y de volumen (shimmer), como una voz de verdad.
 * - Aire: ruido de aspiración ("j" de "ja") y aire que se cuela mientras vibran las cuerdas.
 * - Carraspeo (vocal fry): al final de una risa la voz se "rompe" en pulsos lentos e irregulares.
 * - Boca: cinco resonancias (formantes) en cascada que se mueven de una vocal a otra, y una
 *   resonancia nasal para la "m" y los ronquidos de cerdito.
 *
 * Es una función pura: recibe una partitura y devuelve las muestras. Se puede probar sin navegador.
 */

export type Vowel = 'a' | 'e' | 'i' | 'o' | 'u' | 'ə' | 'm';

/** Formantes F1–F5 y sus anchos de banda (voz adulta; `vtl` los escala). */
const VOWELS: Record<Vowel, { f: number[]; b: number[]; nasal?: number }> = {
  a: { f: [780, 1280, 2600, 3500, 4500], b: [90, 110, 160, 250, 300] },
  e: { f: [480, 1850, 2550, 3500, 4500], b: [70, 100, 150, 250, 300] },
  i: { f: [310, 2300, 3000, 3700, 4600], b: [60, 100, 150, 250, 300] },
  o: { f: [520, 920, 2500, 3450, 4500], b: [80, 100, 150, 250, 300] },
  u: { f: [340, 780, 2400, 3400, 4500], b: [70, 100, 150, 250, 300] },
  ə: { f: [580, 1420, 2500, 3500, 4500], b: [90, 120, 160, 250, 300] },
  m: { f: [330, 1150, 2250, 3400, 4500], b: [70, 150, 220, 300, 350], nasal: 1 },
};

type Track = [t: number, v: number][];

/** Lee una pista avanzando en el tiempo (interpolación lineal; fuera de rango se queda fija). */
function reader(track: Track, def: number) {
  const tr = [...track].sort((x, y) => x[0] - y[0]);
  let i = 1;
  return (t: number) => {
    if (!tr.length) return def;
    if (t <= tr[0][0]) return tr[0][1];
    while (i < tr.length && tr[i][0] < t) i++;
    if (i >= tr.length) return tr[tr.length - 1][1];
    const [t0, v0] = tr[i - 1];
    const [t1, v1] = tr[i];
    return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  };
}

export interface Key {
  /** Tono (Hz). */
  f0?: number;
  /** Volumen de la voz (cuerdas vibrando), 0–1. */
  av?: number;
  /** Aspiración ("h", "j", resoplido), 0–1. */
  ah?: number;
  /** Fricción de la "j" mexicana (raspado en el paladar), 0–1. */
  af?: number;
  /** Aire mezclado en la voz, 0–1. */
  br?: number;
  /** Carraspeo, 0–1. */
  creak?: number;
  /** Nasal, 0–1 (además de lo que ya trae la "m"). */
  nasal?: number;
  /** Vocal (la boca se mueve hacia ella). */
  v?: Vowel;
  /** Qué tan abiertas están las cuerdas en cada ciclo (0.4 apretada – 0.85 suspirada). */
  oq?: number;
}

const FIELDS = ['f0', 'av', 'ah', 'af', 'br', 'creak', 'nasal', 'oq'] as const;
type Field = (typeof FIELDS)[number];

/** Partitura de una voz: se van poniendo puntos clave en el tiempo y se interpola entre ellos. */
export class Take {
  tracks: Record<Field, Track> = { f0: [], av: [], ah: [], af: [], br: [], creak: [], nasal: [], oq: [] };
  vowels: [number, Vowel][] = [];
  end = 0;
  constructor(
    /** Tamaño de la boca: >1 más chica (niña, gallina), <1 más grande (villano). */
    public vtl = 1,
    /** Imperfección de tono por ciclo (0.01 = 1 %). */
    public jitter = 0.012,
    /** Imperfección de volumen por ciclo. */
    public shimmer = 0.08,
  ) {}

  /** Vibrato: veces por segundo y profundidad (0.03 = 3 % del tono). */
  vib: [rate: number, depth: number] = [5, 0.006];
  /** Momentos marcados para sincronizar efectos (palmadas, golpes). */
  marks: number[] = [];

  key(t: number, k: Key) {
    for (const f of FIELDS) if (k[f] !== undefined) this.tracks[f].push([t, k[f]!]);
    if (k.v) this.vowels.push([t, k.v]);
    this.end = Math.max(this.end, t);
    return this;
  }
}

/** Generador aleatorio con semilla (para pruebas repetibles). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Forma de un pulso de las cuerdas vocales (se abre suave y se cierra rápido), precalculada. */
const PULSE = (() => {
  const n = 1024;
  const tp = 0.62;
  const t = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    t[i] = x < tp ? 0.5 * (1 - Math.cos((Math.PI * x) / tp)) : Math.cos((Math.PI / 2) * ((x - tp) / (1 - tp)));
  }
  return t;
})();

/** Resonador de 2 polos (formante) con coeficientes que se recalculan seguido. */
class Reso {
  a = 1;
  b = 0;
  c = 0;
  y1 = 0;
  y2 = 0;
  set(f: number, bw: number, sr: number) {
    const r = Math.exp((-Math.PI * bw) / sr);
    this.c = -r * r;
    this.b = 2 * r * Math.cos((2 * Math.PI * f) / sr);
    this.a = 1 - this.b - this.c;
  }
  run(x: number) {
    const y = this.a * x + this.b * this.y1 + this.c * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Antirresonador (cero nasal): quita energía en una frecuencia. */
class Anti {
  a = 1;
  b = 0;
  c = 0;
  x1 = 0;
  x2 = 0;
  set(f: number, bw: number, sr: number) {
    const r = Math.exp((-Math.PI * bw) / sr);
    const c = -r * r;
    const b = 2 * r * Math.cos((2 * Math.PI * f) / sr);
    const a = 1 - b - c;
    this.a = 1 / a;
    this.b = -b / a;
    this.c = -c / a;
  }
  run(x: number) {
    const y = this.a * x + this.b * this.x1 + this.c * this.x2;
    this.x2 = this.x1;
    this.x1 = x;
    return y;
  }
}

/**
 * Convierte la partitura en muestras. Devuelve audio mono normalizado (pico 0.9).
 * `tail` agrega silencio al final para que se apague la última resonancia.
 */
export function render(take: Take, sr: number, rand: () => number = Math.random, tail = 0.08): Float32Array {
  const n = Math.max(1, Math.ceil((take.end + tail) * sr));
  const out = new Float32Array(n);
  const T = take.tracks;
  const get = {
    f0: reader(T.f0, 200),
    av: reader(T.av, 0),
    ah: reader(T.ah, 0),
    af: reader(T.af, 0),
    br: reader(T.br, 0.15),
    creak: reader(T.creak, 0),
    oq: reader(T.oq, 0.6),
    nasal: reader(T.nasal, 0),
  };
  const vowels = [...take.vowels].sort((x, y) => x[0] - y[0]);
  if (!vowels.length) vowels.push([0, 'ə']);

  const formants = Array.from({ length: 5 }, () => new Reso());
  const nasalPole = new Reso();
  const nasalZero = new Anti();
  const fric = new Reso();
  fric.set(1900 * take.vtl, 900, sr);
  const BLOCK = 16;

  // Estado de las cuerdas vocales.
  let phase = 0;
  let period0 = 1; // f0 de este ciclo (con jitter)
  let amp = 1; // volumen de este ciclo (con shimmer)
  let flowPrev = 0;
  let tiltY = 0;
  let noiseLp = 0;
  let creakAlt = 1;

  // Valores del bloque actual.
  let f0 = 200;
  let av = 0;
  let ah = 0;
  let af = 0;
  let br = 0;
  let creak = 0;
  let oq = 0.6;
  let vib = 1;

  for (let i = 0; i < n; i++) {
    if (i % BLOCK === 0) {
      const t = i / sr;
      vib = 1 + take.vib[1] * Math.sin(2 * Math.PI * take.vib[0] * t);
      f0 = get.f0(t);
      av = get.av(t);
      ah = get.ah(t);
      af = get.af(t);
      br = get.br(t);
      creak = get.creak(t);
      oq = get.oq(t);
      const nasal = get.nasal(t);
      // Boca: interpolar formantes entre las vocales vecinas (con transición suave).
      let k = 0;
      while (k < vowels.length - 1 && vowels[k + 1][0] <= t) k++;
      const A = VOWELS[vowels[k][1]];
      const nxt = vowels[k + 1];
      let w = 0;
      if (nxt) {
        // Cada vocal se alcanza 60 ms antes de su punto clave.
        const span = Math.max(0.001, Math.min(0.06, nxt[0] - vowels[k][0]));
        w = Math.max(0, Math.min(1, (t - (nxt[0] - span)) / span));
        w = w * w * (3 - 2 * w);
      }
      const B = nxt ? VOWELS[nxt[1]] : A;
      for (let j = 0; j < 5; j++) {
        const f = (A.f[j] + (B.f[j] - A.f[j]) * w) * take.vtl;
        // Con las cuerdas abiertas (risa con aire) las resonancias se apagan más rápido.
        const bw = (A.b[j] + (B.b[j] - A.b[j]) * w) * (1 + br * 0.8 + (j === 0 ? br * 0.6 : 0));
        formants[j].set(Math.min(f, sr * 0.45), bw, sr);
      }
      const nz = Math.min(1, nasal + (A.nasal ?? 0) * (1 - w) + (B.nasal ?? 0) * w);
      nasalPole.set(270, 100, sr);
      // Sin nasalidad el cero cancela al polo; con nasalidad el cero se va arriba.
      nasalZero.set(270 + nz * 1300, 100 + nz * 120, sr);
    }

    // Cuerdas vocales.
    const fryF0 = 62;
    const curF0 = (f0 + (fryF0 - f0) * creak) * vib;
    phase += (curF0 * period0) / sr;
    if (phase >= 1) {
      phase -= 1;
      const jit = take.jitter + creak * 0.22;
      period0 = 1 + (rand() * 2 - 1) * jit;
      creakAlt = creak > 0.3 ? -creakAlt : 1;
      amp = Math.max(0, 1 + (rand() * 2 - 1) * (take.shimmer + creak * 0.5)) * (creakAlt < 0 ? 1 - creak * 0.6 : 1);
    }
    const q = Math.max(0.25, Math.min(0.9, oq - creak * 0.3));
    const flow = phase < q ? PULSE[((phase / q) * 1024) | 0] : 0;
    // Derivada del flujo (incluye la radiación de los labios), normalizada para cualquier tono.
    let src = ((flow - flowPrev) * sr) / (curF0 * 6);
    flowPrev = flow;
    // Inclinación espectral: la voz suspirada es más suave.
    const tiltK = 0.08 + br * 0.3;
    tiltY = tiltY * tiltK + src * (1 - tiltK);
    src = tiltY * amp * av;

    // Aire.
    const white = rand() * 2 - 1;
    noiseLp = noiseLp * 0.35 + white * 0.65;
    const open = phase < q ? 1 : 0.35;
    const aspiration = noiseLp * (ah + av * br * 0.55 * open);

    // Boca: nasal → formantes en cascada (de arriba a abajo).
    let y = nasalZero.run(nasalPole.run(src + aspiration * 0.9));
    for (let j = 4; j >= 0; j--) y = formants[j].run(y);
    // La "j" mexicana: raspado en paralelo.
    if (af > 0) y += fric.run(white) * af * 0.5;
    out[i] = y;
  }

  // Quitar componente continua, dar brillo (como la radiación de la boca) y normalizar.
  let hp = 0;
  let prevX = 0;
  let prevY = 0;
  const R = Math.exp((-2 * Math.PI * 70) / sr);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const x = out[i];
    hp = R * (hp + x - prevX);
    prevX = x;
    const y = hp - 0.6 * prevY;
    prevY = hp;
    out[i] = y;
    peak = Math.max(peak, Math.abs(y));
  }
  // Fundido final para no cortar en seco.
  const fade = Math.min(n, Math.floor(sr * 0.02));
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  if (peak > 0) for (let i = 0; i < n; i++) out[i] *= 0.9 / peak;
  return out;
}
