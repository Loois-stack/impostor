import { describe, expect, it } from 'vitest';
import { render, rng, Take } from '../audio/voicebox';
import * as V from '../audio/voices';

const SR = 32000;
const SCRIPTS = {
  guffaw: V.guffaw,
  giggle: V.giggle,
  evilLaugh: V.evilLaugh,
  snortLaugh: V.snortLaugh,
  hysterical: V.hysterical,
  scream: V.scream,
  think: V.think,
  doubt: V.doubt,
  uy: V.uy,
  tu: V.tu,
  cry: V.cry,
  chicken: V.chicken,
  raspberry: V.raspberry,
  snore: V.snore,
} as const;

describe('caja de voz', () => {
  it('cada guion suena, sin errores numéricos, con duración razonable y para cualquier voz', { timeout: 30000 }, () => {
    for (let seed = 1; seed <= 4; seed++) {
      const sp = V.speaker(rng(seed * 101));
      for (const [name, script] of Object.entries(SCRIPTS)) {
        const take = (script as (r: () => number, sp: V.Speaker) => Take)(rng(seed), sp);
        const x = render(take, SR, rng(seed));
        const secs = x.length / SR;
        expect(secs, name).toBeGreaterThan(0.3);
        expect(secs, name).toBeLessThan(3.5);
        let peak = 0;
        let energy = 0;
        let finite = true;
        for (const v of x) {
          if (!Number.isFinite(v)) finite = false;
          peak = Math.max(peak, Math.abs(v));
          energy += v * v;
        }
        expect(finite, name).toBe(true);
        expect(peak, name).toBeLessThanOrEqual(0.9001);
        expect(peak, name).toBeGreaterThan(0.85);
        // No es silencio: tiene cuerpo.
        expect(Math.sqrt(energy / x.length), name).toBeGreaterThan(0.02);
      }
    }
  });

  it('la misma persona tiene la misma voz en todos los teléfonos', () => {
    expect(V.speakerFor('dabc123')).toEqual(V.speakerFor('dabc123'));
    const voices = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => V.speakerFor(`jugador-${id}`).f0.toFixed(1)));
    expect(voices.size).toBeGreaterThan(4);
  });

  it('con la misma semilla sale exactamente el mismo sonido', () => {
    const a = render(V.guffaw(rng(5), { f0: 260, vtl: 1 }), SR, rng(9));
    const b = render(V.guffaw(rng(5), { f0: 260, vtl: 1 }), SR, rng(9));
    expect(a).toEqual(b);
  });

  it('una partitura vacía no truena', () => {
    const x = render(new Take(), SR);
    expect(x.length).toBeGreaterThan(0);
    expect(x.every((v) => Number.isFinite(v))).toBe(true);
  });
});
