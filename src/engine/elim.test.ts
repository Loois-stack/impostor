import { describe, expect, it } from 'vitest';
import { ELIM_BY_ID, ELIMS, elimFor, isElimChoice } from '../data/eliminations';

describe('animaciones de eliminación', () => {
  it('hay al menos 3 para elegir y cada una tiene su momento clave dentro del video', () => {
    expect(ELIMS.length).toBeGreaterThanOrEqual(3);
    for (const e of ELIMS) {
      expect(e.hit).toBeGreaterThan(0);
      expect(e.hit).toBeLessThan(e.dur);
      expect(ELIM_BY_ID[e.id]).toBe(e);
    }
  });

  it('respeta la elegida; "sorpresa" sale igual en todos los teléfonos para la misma votación', () => {
    expect(elimFor('pinata', 'x').id).toBe('pinata');
    expect(elimFor('random', '3-2-abc').id).toBe(elimFor('random', '3-2-abc').id);
    expect(elimFor(undefined, '3-2-abc').id).toBe(elimFor('random', '3-2-abc').id);
    const seen = new Set(Array.from({ length: 60 }, (_, i) => elimFor('random', `ronda-${i}`).id));
    expect(seen.size).toBe(ELIMS.length);
  });

  it('el anfitrión solo acepta opciones que existen', () => {
    expect(isElimChoice('rayo')).toBe(true);
    expect(isElimChoice('random')).toBe(true);
    expect(isElimChoice('bomba')).toBe(false);
    expect(isElimChoice(undefined)).toBe(false);
  });
});
