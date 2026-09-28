import { describe, expect, it } from 'vitest';
import { BY_CAT, BY_ID, CUSTOM_GROUP, decoyCandidates, playable, setCustomItems } from '../data';
import { THEMES } from '../data/themes';
import type { Item } from '../data/types';
import { maybeChallenge } from './challenges';
import { rollEvent } from './events';
import { makeRng } from './rng';
import { scoreRound } from './scoring';
import { commitRound, emptyHistory, pickCivil, pickDecoy, pickFromTheme, pickTheme } from './selector';

const custom = (n: number): Item[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `c_${i}`,
    name: `Carta ${i}`,
    cat: 'custom',
    group: CUSTOM_GROUP,
    emoji: '😀',
    wiki: '',
    ctx: 'contexto',
    sim: [],
  }));

describe('cartas propias', () => {
  it('se registran, se pueden jugar y el señuelo sale de la misma categoría', () => {
    setCustomItems(custom(2));
    expect(playable('custom')).toBe(false);
    setCustomItems(custom(5));
    expect(playable('custom')).toBe(true);
    expect(BY_CAT.custom).toHaveLength(5);

    const rng = makeRng(3);
    let h = emptyHistory();
    const seen = new Set<string>();
    for (let r = 0; r < 3; r++) {
      const civil = pickCivil('custom', h, rng);
      const { decoy } = pickDecoy(civil, 'mixed', h, rng);
      expect(decoy.cat).toBe('custom');
      expect(decoy.id).not.toBe(civil.id);
      seen.add(civil.id);
      h = commitRound(h, 'custom', civil, decoy);
    }
    expect(seen.size).toBe(3);
  });

  it('reemplazar las cartas propias no deja restos', () => {
    setCustomItems(custom(4));
    setCustomItems(custom(3));
    expect(BY_CAT.custom).toHaveLength(3);
    expect(decoyCandidates(BY_CAT.custom[0])[2]).toHaveLength(2);
    setCustomItems([]);
    expect(playable('custom')).toBe(false);
  });
});

describe('eventos nuevos', () => {
  it('cómplice y detective solo con 5+ jugadores', () => {
    const rng = makeRng(1);
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const e = rollEvent({ enabled: true, sessionRound: 5, players: 4, impostors: 1, horrorAvailable: true }, rng);
      if (e) seen.add(e);
    }
    expect(seen.has('accomplice')).toBe(false);
    expect(seen.has('detective')).toBe(false);
    expect(seen.has('oneword')).toBe(true);
  });

  it('el cómplice gana solo si el impostor sobrevive', () => {
    const base = { players: ['a', 'b', 'c', 'd', 'e'], impostors: ['a'], guessed: {}, challenges: {}, cursed: [], accomplice: 'b', event: 'accomplice' as const };
    const survived = scoreRound({ ...base, accused: ['c'], nobodyVote: false });
    expect(survived.lines.find((l) => l.player === 'b')!.base).toBe(200);
    const caught = scoreRound({ ...base, accused: ['a'], nobodyVote: false });
    expect(caught.lines.find((l) => l.player === 'b')!.base).toBe(0);
    expect(caught.lines.find((l) => l.player === 'c')!.base).toBe(100);
  });
});

describe('modo Mezcla', () => {
  it('cada tema tiene 4+ cartas válidas de 2+ categorías', () => {
    for (const t of THEMES) {
      for (const id of t.items) expect(BY_ID[id], `${t.id} -> ${id}`).toBeDefined();
      expect(t.items.length, t.id).toBeGreaterThanOrEqual(4);
      expect(new Set(t.items.map((id) => BY_ID[id].cat)).size, t.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('el señuelo es del mismo tema y casi siempre de otra categoría; no repite tema seguido', () => {
    const rng = makeRng(21);
    let h = emptyHistory();
    let cross = 0;
    let last = '';
    for (let r = 0; r < 200; r++) {
      const theme = pickTheme(h, rng);
      expect(theme.id).not.toBe(last);
      last = theme.id;
      const { civil, decoy } = pickFromTheme(theme, h, rng);
      expect(theme.items).toContain(civil.id);
      expect(theme.items).toContain(decoy.id);
      expect(decoy.id).not.toBe(civil.id);
      if (decoy.cat !== civil.cat) cross++;
      h = commitRound(h, civil.cat, civil, decoy, theme.id);
    }
    expect(cross).toBeGreaterThan(180);
  });
});

describe('retos', () => {
  it('evita repetir el mismo tipo de reto en una ronda', () => {
    const rng = makeRng(8);
    let same = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const c = maybeChallenge('p', { given: [], sinceLast: 10, max: 5 }, {}, 1, rng, ['actuacion', 'actuacion']);
      if (c?.kind === 'actuacion') same++;
    }
    expect(same / N).toBeLessThan(0.03);
  });
});

describe('modo eliminación', () => {
  const base = { order: ['a', 'b', 'c', 'd'], impostors: ['a'], accused: [] as string[], elimination: true, nobodyVote: false };
  const st = async (r: Partial<typeof base>) => {
    const { roundStatus } = await import('../store/game');
    return roundStatus({ ...base, ...r } as unknown as Parameters<typeof roundStatus>[0]);
  };

  it('si eliminan a un inocente y quedan 3, la ronda sigue', async () => {
    const s = await st({ accused: ['b'] });
    expect(s.over).toBe(false);
    expect(s.alive).toEqual(['a', 'c', 'd']);
  });

  it('si quedan solo 2 (impostor + 1), gana el impostor', async () => {
    const s = await st({ accused: ['b', 'c'] });
    expect(s.over).toBe(true);
    expect(s.impParity).toBe(true);
  });

  it('si atrapan al impostor, termina', async () => {
    expect((await st({ accused: ['b', 'a'] })).over).toBe(true);
  });

  it('con doble impostor sigue tras atrapar a uno', async () => {
    const s = await st({ order: ['a', 'b', 'c', 'd', 'e', 'f'], impostors: ['a', 'b'], accused: ['a'] });
    expect(s.over).toBe(false);
  });

  it('sin eliminación, una votación termina la ronda', async () => {
    expect((await st({ elimination: false, accused: ['b'] })).over).toBe(true);
  });
});
