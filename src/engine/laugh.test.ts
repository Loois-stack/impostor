import { describe, expect, it } from 'vitest';
import { decodeLaugh, encodeLaugh, isLaugh, LAUGH_MAX_CHARS, LAUGH_MAX_S, LAUGH_RATE, resample, tidy } from '../audio/myLaugh';

/** Una "risa" de prueba: tres "ja" con silencio antes y después. */
function fakeLaugh(rate = LAUGH_RATE) {
  const x = new Float32Array(rate * 2);
  for (let k = 0; k < 3; k++) {
    const a = Math.floor(rate * (0.5 + k * 0.25));
    for (let i = 0; i < rate * 0.15; i++) x[a + i] = 0.4 * Math.sin((2 * Math.PI * 300 * i) / rate);
  }
  return x;
}

describe('risa grabada', () => {
  it('se comprime y se recupera casi igual (µ-law)', () => {
    const x = fakeLaugh();
    const y = decodeLaugh(encodeLaugh(x));
    expect(y.length).toBe(x.length);
    let err = 0;
    for (let i = 0; i < x.length; i++) err = Math.max(err, Math.abs(x[i] - y[i]));
    expect(err).toBeLessThan(0.02);
  });

  it('recorta el silencio, sube el volumen y no pasa de 3 segundos', () => {
    const clean = tidy(fakeLaugh());
    // 0.5 s de risa + orillas (sin los 1.5 s de silencio).
    expect(clean.length / LAUGH_RATE).toBeGreaterThan(0.6);
    expect(clean.length / LAUGH_RATE).toBeLessThan(0.8);
    expect(Math.max(...clean.map(Math.abs))).toBeGreaterThan(0.85);
    expect(tidy(new Float32Array(LAUGH_RATE))).toHaveLength(0);
    const long = new Float32Array(LAUGH_RATE * 5).fill(0.3);
    expect(decodeLaugh(encodeLaugh(long)).length).toBe(LAUGH_RATE * LAUGH_MAX_S);
  });

  it('cambia de frecuencia de muestreo', () => {
    const x = fakeLaugh(48000);
    expect(resample(x, 48000, LAUGH_RATE).length).toBe(LAUGH_RATE * 2);
    expect(resample(new Float32Array(LAUGH_RATE), LAUGH_RATE, 24000).length).toBe(24000);
  });

  it('el anfitrión solo reparte risas válidas y de tamaño razonable', () => {
    const ok = encodeLaugh(tidy(fakeLaugh()));
    expect(isLaugh(ok)).toBe(true);
    expect(isLaugh(encodeLaugh(new Float32Array(LAUGH_RATE * 3).fill(0.5)))).toBe(true);
    expect(isLaugh('A'.repeat(LAUGH_MAX_CHARS + 4))).toBe(false);
    expect(isLaugh('<script>alert(1)</script>'.repeat(10))).toBe(false);
    expect(isLaugh(123)).toBe(false);
    expect(isLaugh(null)).toBe(false);
  });
});
