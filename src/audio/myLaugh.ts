/**
 * Tu propia risa: se graba con el micrófono, se recorta el silencio, se comprime (12 kHz, µ-law,
 * unos 25–40 KB) y se guarda en este teléfono. En una sala viaja solo a los teléfonos de esa sala
 * (y ahí solo vive en memoria): así tu 😂 suena con tu risa de verdad en todos.
 */

/** Frecuencia a la que se guarda la risa (suficiente para una voz). */
export const LAUGH_RATE = 12000;
/** Lo más que dura una risa grabada. */
export const LAUGH_MAX_S = 3;
/** Tamaño máximo de una risa ya codificada (texto base64). */
export const LAUGH_MAX_CHARS = Math.ceil((LAUGH_RATE * LAUGH_MAX_S) / 3) * 4 + 4;

// ---------------------------------------------------------------- µ-law (G.711)

const BIAS = 0x84;
const CLIP = 32635;

function toMu(x: number) {
  let s = Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
  const sign = s < 0 ? 0x80 : 0;
  if (sign) s = -s;
  if (s > CLIP) s = CLIP;
  s += BIAS;
  let exp = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exp > 0; exp--, mask >>= 1);
  const man = (s >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | man) & 0xff;
}

function fromMu(u: number) {
  u = ~u & 0xff;
  const sign = u & 0x80;
  const exp = (u >> 4) & 7;
  const man = u & 0x0f;
  const s = (((man << 3) + BIAS) << exp) - BIAS;
  return (sign ? -s : s) / 32768;
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** ¿Es una risa válida? (lo revisa el anfitrión antes de repartirla) */
export const isLaugh = (d: unknown): d is string => typeof d === 'string' && d.length > 100 && d.length <= LAUGH_MAX_CHARS && d.length % 4 === 0 && B64.test(d);

/** Muestras (a `LAUGH_RATE`) → texto. */
export function encodeLaugh(x: Float32Array): string {
  const bytes = new Uint8Array(Math.min(x.length, LAUGH_RATE * LAUGH_MAX_S));
  for (let i = 0; i < bytes.length; i++) bytes[i] = toMu(x[i]);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Texto → muestras (a `LAUGH_RATE`). */
export function decodeLaugh(d: string): Float32Array {
  const bin = atob(d);
  const x = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) x[i] = fromMu(bin.charCodeAt(i));
  return x;
}

/** Cambia la frecuencia de muestreo (promediando al bajar, interpolando al subir). */
export function resample(x: Float32Array, from: number, to: number): Float32Array {
  const ratio = from / to;
  const n = Math.max(1, Math.floor(x.length / ratio));
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = i * ratio;
    if (ratio > 1) {
      const a = Math.max(0, Math.floor(c - ratio / 2));
      const b = Math.min(x.length, Math.ceil(c + ratio / 2));
      let s = 0;
      for (let j = a; j < b; j++) s += x[j];
      y[i] = s / Math.max(1, b - a);
    } else {
      const j = Math.floor(c);
      const f = c - j;
      y[i] = x[j] * (1 - f) + (x[Math.min(x.length - 1, j + 1)] ?? 0) * f;
    }
  }
  return y;
}

/** Quita el silencio del principio y del final, sube el volumen y suaviza las orillas. */
export function tidy(x: Float32Array, rate = LAUGH_RATE): Float32Array {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  if (peak < 0.01) return new Float32Array(0);
  const th = peak * 0.08;
  let a = 0;
  while (a < x.length && Math.abs(x[a]) < th) a++;
  let b = x.length - 1;
  while (b > a && Math.abs(x[b]) < th) b--;
  const pad = Math.floor(rate * 0.04);
  const y = x.slice(Math.max(0, a - pad), Math.min(x.length, b + pad));
  const fade = Math.min(Math.floor(rate * 0.015), Math.floor(y.length / 2));
  const gain = 0.95 / peak;
  for (let i = 0; i < y.length; i++) {
    const edge = Math.min(1, i / Math.max(1, fade), (y.length - 1 - i) / Math.max(1, fade));
    y[i] *= gain * edge;
  }
  return y;
}

// ---------------------------------------------------------------- Grabar

export interface Recording {
  /** Termina antes de tiempo. */
  stop(): void;
  /** La risa lista (o `null` si no se oyó nada). */
  done: Promise<string | null>;
}

/** Empieza a grabar (llamar desde un toque). Se detiene sola a los `LAUGH_MAX_S` segundos. */
export async function recordLaugh(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<string | null>((resolve, reject) => {
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || chunks[0]?.type });
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
        void ctx.close();
        // Mezcla a un canal, baja a 12 kHz y limpia.
        const mono = new Float32Array(buf.length);
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
          const d = buf.getChannelData(ch);
          for (let i = 0; i < d.length; i++) mono[i] += d[i] / buf.numberOfChannels;
        }
        const clean = tidy(resample(mono, buf.sampleRate, LAUGH_RATE));
        resolve(clean.length > LAUGH_RATE * 0.15 ? encodeLaugh(clean) : null);
      } catch (e) {
        reject(e);
      }
    };
  });
  rec.start();
  const timer = window.setTimeout(() => rec.state !== 'inactive' && rec.stop(), LAUGH_MAX_S * 1000);
  return {
    stop: () => {
      clearTimeout(timer);
      if (rec.state !== 'inactive') rec.stop();
    },
    done,
  };
}

/** ¿Se puede grabar en este navegador? */
export const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
