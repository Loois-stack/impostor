import { BY_CAT, BY_ID, decoyCandidates } from '../data';
import type { CategoryId, Item, Level } from '../data/types';
import type { Rng } from './rng';

export type Similarity = 'close' | 'mixed' | 'far';

/** Memoria entre partidas: es lo que evita que las rondas se repitan. */
export interface History {
  round: number;
  catPlays: Partial<Record<CategoryId, number>>;
  catLast: Partial<Record<CategoryId, number>>;
  /** carta civil -> [veces que se había jugado su categoría cuando salió, ronda global] */
  itemUse: Record<string, [number, number]>;
  /** carta usada como señuelo -> ronda global */
  decoyUse: Record<string, number>;
  pairs: string[];
  lastCat?: CategoryId;
  challengeLast: Record<string, number>;
}

export const emptyHistory = (): History => ({
  round: 0,
  catPlays: {},
  catLast: {},
  itemUse: {},
  decoyUse: {},
  pairs: [],
  challengeLast: {},
});

const MAX_PAIRS = 4000;
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Categorías con "déficit": cuanto más tiempo sin salir, más probable. Nunca repite la anterior. */
export function pickCategory(allowed: CategoryId[], h: History, rng: Rng): CategoryId {
  if (allowed.length === 1) return allowed[0];
  const pool = allowed.filter((c) => c !== h.lastCat);
  return rng.weighted(pool, (c) => 1 + Math.min(h.round - (h.catLast[c] ?? -99), 12) * 0.6);
}

/**
 * Palabra de los civiles. Funciona como una "bolsa barajada" suave: una carta no vuelve
 * hasta que haya salido ~70% de su categoría, y luego regresa con probabilidad creciente.
 */
export function pickCivil(cat: CategoryId, h: History, rng: Rng): Item {
  const pool = BY_CAT[cat];
  const plays = h.catPlays[cat] ?? 0;
  const since = (i: Item) => (h.itemUse[i.id] ? plays - h.itemUse[i.id][0] : Infinity);
  const cooldown = Math.floor(pool.length * 0.7);
  let eligible = pool.filter((i) => since(i) >= cooldown);
  if (!eligible.length) {
    const sorted = [...pool].sort((a, b) => since(b) - since(a));
    eligible = sorted.slice(0, Math.max(1, Math.ceil(pool.length / 4)));
  }
  const k = pool.length * 0.5;
  return rng.weighted(eligible, (i) => (since(i) === Infinity ? 1.3 : 1 - Math.exp(-since(i) / k)));
}

const LEVEL_DIST: Record<Similarity, [number, number, number]> = {
  close: [0.6, 0.35, 0.05],
  mixed: [0.3, 0.5, 0.2],
  far: [0.1, 0.4, 0.5],
};

function levelOrder(first: Level, rng: Rng): Level[] {
  if (first === 1) return [1, 2, 3];
  if (first === 3) return [3, 2, 1];
  return rng.chance(0.5) ? [2, 1, 3] : [2, 3, 1];
}

/** Señuelo del impostor: parecido pero no igual. El nivel decide si puede camuflarse o tiene que jugársela. */
export function pickDecoy(civil: Item, sim: Similarity, h: History, rng: Rng): { decoy: Item; level: Level } {
  const [p1, p2] = LEVEL_DIST[sim];
  const r = rng.next();
  const first: Level = r < p1 ? 1 : r < p1 + p2 ? 2 : 3;
  const cands = decoyCandidates(civil);
  const used = new Set(h.pairs);
  const freshness = (i: Item) => {
    const last = Math.max(h.itemUse[i.id]?.[1] ?? -99, h.decoyUse[i.id] ?? -99);
    return h.round - last < 10 ? 0.15 : 1;
  };
  for (const lvl of levelOrder(first, rng)) {
    const fresh = cands[lvl].filter((d) => !used.has(pairKey(civil.id, d.id)));
    if (fresh.length) return { decoy: rng.weighted(fresh, freshness), level: lvl };
  }
  // Todas las parejas ya se jugaron: se permite repetir la menos reciente.
  for (const lvl of levelOrder(first, rng)) {
    if (cands[lvl].length) return { decoy: rng.weighted(cands[lvl], freshness), level: lvl };
  }
  throw new Error(`Sin señuelos para ${civil.id}`);
}

export function commitRound(h: History, cat: CategoryId, civil: Item, decoy: Item | null): History {
  const round = h.round + 1;
  const catPlays = { ...h.catPlays, [cat]: (h.catPlays[cat] ?? 0) + 1 };
  const itemUse = { ...h.itemUse, [civil.id]: [catPlays[cat]!, round] as [number, number] };
  const decoyUse = decoy ? { ...h.decoyUse, [decoy.id]: round } : h.decoyUse;
  const pairs = decoy ? [...h.pairs, pairKey(civil.id, decoy.id)] : h.pairs;
  return {
    ...h,
    round,
    catPlays,
    catLast: { ...h.catLast, [cat]: round },
    itemUse,
    decoyUse,
    pairs: pairs.slice(-MAX_PAIRS),
    lastCat: cat,
  };
}

export const itemById = (id: string) => BY_ID[id];
