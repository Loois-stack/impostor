import type { CategoryId, Item, Level } from './types';
import memes from './items/memes';
import creepy from './items/creepy';
import scp from './items/scp';
import horror from './items/horror';
import cartoons from './items/cartoons';
import animated from './items/animated';
import anime from './items/anime';
import movies from './items/movies';
import heroes from './items/heroes';
import games from './items/games';
import series from './items/series';
import famous from './items/famous';
import objects from './items/objects';
import food from './items/food';
import animals from './items/animals';

export const ITEMS: Item[] = [
  ...memes, ...creepy, ...scp, ...horror, ...cartoons, ...animated, ...anime, ...movies,
  ...heroes, ...games, ...series, ...famous, ...objects, ...food, ...animals,
];

export const BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// Las relaciones de similitud son simétricas: si A se parece a B, B se parece a A.
for (const item of ITEMS) {
  for (const s of item.sim) {
    const other = BY_ID[s.id];
    if (other && !other.sim.some((o) => o.id === item.id)) other.sim.push({ id: item.id, level: s.level });
  }
}

export const BY_CAT = ITEMS.reduce(
  (acc, it) => ((acc[it.cat] ??= []).push(it), acc),
  {} as Record<CategoryId, Item[]>,
);

const BY_GROUP = ITEMS.reduce((acc, it) => ((acc[it.group] ??= []).push(it), acc), {} as Record<string, Item[]>);

/** Candidatos a señuelo agrupados por nivel de similitud. */
export function decoyCandidates(item: Item): Record<Level, Item[]> {
  const out: Record<Level, Item[]> = { 1: [], 2: [], 3: [] };
  const seen = new Set([item.id]);
  const add = (lvl: Level, it?: Item) => {
    if (it && !seen.has(it.id)) {
      seen.add(it.id);
      out[lvl].push(it);
    }
  };
  for (const s of item.sim) if (s.level === 1) add(1, BY_ID[s.id]);
  for (const s of item.sim) if (s.level === 2) add(2, BY_ID[s.id]);
  for (const it of BY_GROUP[item.group]) add(2, it);
  for (const s of item.sim) if (s.level === 3) add(3, BY_ID[s.id]);
  for (const it of BY_CAT[item.cat]) add(3, it);
  return out;
}
