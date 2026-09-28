import { describe, expect, it } from 'vitest';
import { BY_CAT, BY_ID, ITEMS, decoyCandidates } from '../data';
import { CATEGORIES } from '../data/categories';
import { CHALLENGES } from '../data/challenges';
import type { CategoryId } from '../data/types';
import { makeRng } from './rng';
import { commitRound, emptyHistory, pickCategory, pickCivil, pickDecoy } from './selector';
import { pickImpostors, turnOrder } from './roles';
import { scoreRound } from './scoring';

describe('dataset', () => {
  it('ids únicos y referencias válidas', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const i of ITEMS) for (const s of i.sim) expect(BY_ID[s.id], `${i.id} -> ${s.id}`).toBeDefined();
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
  });

  it('cada categoría tiene suficientes cartas y cada carta tiene señuelos', () => {
    for (const c of CATEGORIES) expect(BY_CAT[c.id].length).toBeGreaterThanOrEqual(20);
    for (const i of ITEMS) {
      const d = decoyCandidates(i);
      expect(d[1].length + d[2].length + d[3].length, i.id).toBeGreaterThanOrEqual(3);
      expect([...d[1], ...d[2], ...d[3]].some((x) => x.id === i.id)).toBe(false);
    }
  });

  it('todas las cartas tienen contexto', () => {
    for (const i of ITEMS) expect(i.ctx.length, i.id).toBeGreaterThan(30);
  });
});

describe('selector', () => {
  const all = CATEGORIES.map((c) => c.id);

  function simulate(rounds: number, cats: CategoryId[], seed = 42) {
    const rng = makeRng(seed);
    let h = emptyHistory();
    const log: { cat: CategoryId; civil: string; decoy: string }[] = [];
    for (let r = 0; r < rounds; r++) {
      const cat = pickCategory(cats, h, rng);
      const civil = pickCivil(cat, h, rng);
      const { decoy } = pickDecoy(civil, 'mixed', h, rng);
      log.push({ cat, civil: civil.id, decoy: decoy.id });
      h = commitRound(h, cat, civil, decoy);
    }
    return log;
  }

  it('no repite palabra civil en 200 rondas con todas las categorías', () => {
    const log = simulate(200, all);
    const civils = log.map((l) => l.civil);
    expect(new Set(civils).size).toBe(civils.length);
  });

  it('no repite pareja civil/impostor en 300 rondas', () => {
    const log = simulate(300, all, 7);
    const pairs = log.map((l) => [l.civil, l.decoy].sort().join('|'));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('nunca repite categoría dos veces seguidas y las reparte parejo', () => {
    const log = simulate(300, all, 3);
    for (let i = 1; i < log.length; i++) expect(log[i].cat).not.toBe(log[i - 1].cat);
    const counts = all.map((c) => log.filter((l) => l.cat === c).length);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(12);
    expect(Math.max(...counts)).toBeLessThanOrEqual(30);
  });

  it('con una sola categoría recorre al menos 70% antes de repetir', () => {
    const cat: CategoryId = 'horror';
    const n = BY_CAT[cat].length;
    const log = simulate(n * 2, [cat], 11);
    for (let i = 0; i < log.length; i++) {
      const prev = log.slice(Math.max(0, i - Math.floor(n * 0.7)), i).map((l) => l.civil);
      expect(prev).not.toContain(log[i].civil);
    }
  });

  it('el señuelo nunca es igual a la carta civil y respeta la distribución de similitud', () => {
    const rng = makeRng(5);
    const h = emptyHistory();
    const levels = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < 2000; i++) {
      const civil = ITEMS[i % ITEMS.length];
      const { decoy, level } = pickDecoy(civil, 'close', h, rng);
      expect(decoy.id).not.toBe(civil.id);
      levels[level]++;
    }
    expect(levels[1] + levels[2]).toBeGreaterThan(levels[3] * 5);
  });
});

describe('roles', () => {
  it('reparte el rol de impostor de forma justa', () => {
    const rng = makeRng(9);
    const players = ['a', 'b', 'c', 'd', 'e'];
    const counts: Record<string, number> = {};
    let last: string[] = [];
    for (let r = 0; r < 100; r++) {
      const imp = pickImpostors(players, 1, counts, last, rng);
      for (const i of imp) counts[i] = (counts[i] ?? 0) + 1;
      last = imp;
    }
    for (const p of players) expect(counts[p]).toBeGreaterThanOrEqual(15);
  });

  it('el orden de turnos respeta los asientos y rota', () => {
    const rng = makeRng(1);
    const order = turnOrder(['a', 'b', 'c', 'd'], ['a'], undefined, rng);
    const i = order.indexOf('a');
    expect([...order.slice(i), ...order.slice(0, i)]).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('puntuación', () => {
  const base = { players: ['a', 'b', 'c', 'd'], guessed: {}, challenges: {}, cursed: [] };
  it('civiles ganan si atrapan al impostor', () => {
    const r = scoreRound({ ...base, impostors: ['a'], accused: ['a'], nobodyVote: false });
    expect(r.winner).toBe('civ');
    expect(r.lines.find((l) => l.player === 'b')!.base).toBe(100);
    expect(r.lines.find((l) => l.player === 'a')!.base).toBe(0);
  });
  it('impostor gana si sobrevive; bonus por adivinar si lo atrapan', () => {
    expect(scoreRound({ ...base, impostors: ['a'], accused: [], nobodyVote: false }).lines[0].base).toBe(250);
    // +50 por cada inocente que hizo eliminar
    expect(scoreRound({ ...base, impostors: ['a'], accused: ['b', 'c'], nobodyVote: false }).lines[0].base).toBe(350);
    expect(scoreRound({ ...base, impostors: ['a'], accused: ['a'], nobodyVote: false, guessed: { a: true } }).lines[0].base).toBe(150);
  });
  it('ronda sin impostor', () => {
    const r = scoreRound({ ...base, impostors: [], accused: [], nobodyVote: true });
    expect(r.winner).toBe('nobody-found');
    expect(r.lines.every((l) => l.base === 150)).toBe(true);
  });
  it('retos y palabra maldita', () => {
    const r = scoreRound({ ...base, impostors: ['a'], accused: ['b'], nobodyVote: false, challenges: { c: true, d: false }, cursed: ['c'] });
    expect(r.lines.find((l) => l.player === 'c')!.bonus).toBe(0);
    expect(r.lines.find((l) => l.player === 'd')!.bonus).toBe(-25);
  });
});
