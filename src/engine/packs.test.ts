import { beforeEach, describe, expect, it } from 'vitest';
import { GLOWS, PACK_DESIGNS, fallbackPack, glowChance, rollPacks } from '../data/packs';
import { BY_ID } from '../data';
import { makeRng } from './rng';
import { useGame, type Round } from '../store/game';

/** Tono (0-360) de un color #rrggbb. */
function hue(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.08) return { h: -1, s: 0 }; // casi gris o blanco
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(max + min - 1) || 1) };
}

describe('sobres personales', () => {
  it('ningún brillo usa el azul de los civiles ni el rojo de los impostores', () => {
    for (const g of GLOWS)
      for (const c of g.colors) {
        const { h, s } = hue(c);
        if (h < 0 || s < 0.25) continue;
        // Azul/cian de civiles (~186°) y rojo de impostores (~352°): lejos de ambos.
        expect(Math.min(Math.abs(h - 186), 360 - Math.abs(h - 186)), `${g.id} ${c}`).toBeGreaterThan(40);
        expect(Math.min(Math.abs(h - 352), 360 - Math.abs(h - 352)), `${g.id} ${c}`).toBeGreaterThan(25);
      }
  });

  it('las rarezas suman 100 % y los sorteos siguen sus probabilidades', () => {
    expect(GLOWS.reduce((s, g) => s + glowChance(g), 0)).toBeCloseTo(1, 6);
    const ids = Array.from({ length: 20000 }, (_, i) => `p${i}`);
    const rolls = rollPacks(ids, false, makeRng(7));
    for (const g of GLOWS) {
      const got = ids.filter((id) => rolls[id].g === g.id).length / ids.length;
      expect(Math.abs(got - glowChance(g))).toBeLessThan(0.015);
    }
    // Todos los diseños salen; Terror casi nunca fuera de las rondas de terror.
    const designs = new Set(ids.map((id) => rolls[id].d));
    expect(designs.size).toBe(PACK_DESIGNS.length);
    const terror = ids.filter((id) => rolls[id].d === 'terror').length / ids.length;
    expect(terror).toBeLessThan(0.08);
    const horror = rollPacks(ids, true, makeRng(8));
    expect(ids.filter((id) => horror[id].d === 'terror').length / ids.length).toBeGreaterThan(0.35);
  });

  it('el sobre de respaldo es estable y no usa nada secreto', () => {
    expect(fallbackPack(3, ['a', 'b'], 'a')).toEqual(fallbackPack(3, ['a', 'b'], 'a'));
  });

  describe('en la partida', () => {
    const g = () => useGame.getState();
    const round = () => g().round as Round;
    beforeEach(() => {
      useGame.setState({ players: [], profiles: {}, round: null, online: false, benched: undefined, screen: 'home' });
      g().newSession();
      g().clearHistory();
      for (const n of ['Ana', 'Beto', 'Caro', 'Dani', 'Eli', 'Fer', 'Gabi', 'Hugo', 'Iris', 'Juan']) g().addPlayer(n);
      g().setSettings({ events: false, challenges: false, missions: false, elimination: false, impostors: 3, impTeam: false, mode: 'similar', voteStyle: 'group' });
    });

    it('cada jugador tiene su sobre y el brillo no depende de ser impostor', () => {
      const count = { imp: {} as Record<string, number>, civ: {} as Record<string, number>, nImp: 0, nCiv: 0 };
      for (let i = 0; i < 1500; i++) {
        g().startRound();
        const r = round();
        expect(Object.keys(r.packs!).sort()).toEqual([...r.order].sort());
        for (const id of r.order) {
          const side = r.impostors.includes(id) ? 'imp' : 'civ';
          count[side][r.packs![id].g] = (count[side][r.packs![id].g] ?? 0) + 1;
          if (side === 'imp') count.nImp++;
          else count.nCiv++;
        }
      }
      // Con 4 500 sobres de impostor y 10 500 de civil, cada rareza sale casi igual en los dos.
      for (const gl of GLOWS) {
        const a = (count.imp[gl.id] ?? 0) / count.nImp;
        const b = (count.civ[gl.id] ?? 0) / count.nCiv;
        expect(Math.abs(a - b), gl.id).toBeLessThan(0.03);
      }
    });

    it('última oportunidad: adivinan antes de la verdad y nadie ve si el otro acertó', () => {
      g().startRound();
      for (let i = 0; i < g().players.length; i++) g().dealNext();
      const [a, b] = round().impostors;
      g().openVote();
      g().vote([a, b], false);
      expect(round().step).toBe('verdict');
      g().setStep('guess');
      const wrong = Object.keys(BY_ID).find((id) => id !== round().civil)!;
      g().guess(round().civil);
      // Primero acertó, pero la ronda sigue en "adivinar" para el siguiente.
      expect(round().step).toBe('guess');
      expect(round().guessPicks).toEqual({ [a]: round().civil });
      g().guess(wrong); // no puede volver a elegir
      expect(round().guessPicks![a]).toBe(round().civil);
      g().nextGuess();
      expect(round().guessIdx).toBe(1);
      expect(round().guessPick).toBeUndefined();
      g().guess(wrong);
      expect(round().guessed).toEqual({ [a]: true, [b]: false });
      g().nextGuess();
      expect(round().step).toBe('truth');
      g().finishRound();
      const line = round().result!.lines.find((l) => l.player === a)!;
      expect(line.base).toBeGreaterThanOrEqual(150);
    });
  });
});
