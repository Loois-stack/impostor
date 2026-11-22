import { describe, expect, it } from 'vitest';
import { burnField, burnProgress, maskAlpha } from './bluefire';

describe('fuego azul del sobre', () => {
  it('empieza justo donde se tocó y lo último en quemarse llega a 0.97', () => {
    const cols = 40;
    const rows = 64;
    const f = burnField(cols, rows, 0.3, 0.7, 1.6, 1234);
    const at = (u: number, v: number) => f[Math.floor(v * rows) * cols + Math.floor(u * cols)];
    expect(at(0.3, 0.7)).toBeLessThan(0.06);
    expect(Math.max(...f)).toBeCloseTo(0.97, 5);
    expect(Math.min(...f)).toBeGreaterThanOrEqual(0);
    // Lo más lejano (arriba a la derecha) se quema después que lo cercano.
    expect(at(0.95, 0.05)).toBeGreaterThan(at(0.35, 0.65));
  });

  it('es igual en todos los teléfonos con la misma semilla', () => {
    expect(burnField(20, 30, 0.5, 0.5, 1.6, 7)).toEqual(burnField(20, 30, 0.5, 0.5, 1.6, 7));
  });

  it('el avance pasa todo el campo y la máscara borra lo quemado', () => {
    expect(burnProgress(0)).toBeLessThan(0);
    expect(burnProgress(1, 0.97)).toBeGreaterThan(0.97);
    expect(maskAlpha(-0.1)).toBe(0);
    expect(maskAlpha(0.1)).toBe(1);
    expect(maskAlpha(0.005)).toBeGreaterThan(0);
  });
});
