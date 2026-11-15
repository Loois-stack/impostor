import type { Rng } from './rng';

/** Impostor justo pero impredecible: quien lo ha sido menos veces tiene más probabilidad. */
export function pickImpostors(
  players: string[],
  count: number,
  impCounts: Record<string, number>,
  lastImpostors: string[],
  rng: Rng,
): string[] {
  const pool = [...players];
  const out: string[] = [];
  for (let k = 0; k < count && pool.length; k++) {
    const p = rng.weighted(
      pool,
      (id) => (1 / Math.pow(1 + (impCounts[id] ?? 0), 1.5)) * (lastImpostors.includes(id) ? 0.4 : 1),
    );
    out.push(p);
    pool.splice(pool.indexOf(p), 1);
  }
  return out;
}

/**
 * Orden de turnos respetando cómo están sentados (orden de la lista). El impostor rara vez
 * empieza (no tendría pistas de nadie) y no repite quien empezó la ronda anterior.
 */
export function turnOrder(players: string[], impostors: string[], lastStarter: string | undefined, rng: Rng): string[] {
  const starter = rng.weighted(
    players,
    (id) => (impostors.includes(id) ? 0.5 : 1) * (id === lastStarter && players.length > 2 ? 0.1 : 1),
  );
  const i = players.indexOf(starter);
  return [...players.slice(i), ...players.slice(0, i)];
}

/**
 * Cuántos impostores caben. Siempre debe haber MÁS civiles que impostores al empezar:
 * si igualan, los impostores ya ganaron.
 */
export const maxImpostors = (players: number) => Math.max(1, Math.floor((players - 1) / 2));

/** Cantidad recomendada: más o menos uno por cada 3 o 4 jugadores. */
export function recommendedImpostors(players: number) {
  const k = players <= 5 ? 1 : players <= 8 ? 2 : players <= 11 ? 3 : players <= 15 ? 4 : 5;
  return Math.min(k, maxImpostors(players));
}

/** 0 = automático (lo recomendado); cualquier otro número se ajusta al máximo posible. */
export const resolveImpostors = (setting: number, players: number) =>
  setting > 0 ? Math.min(setting, maxImpostors(players)) : recommendedImpostors(players);

export type Balance = 'easy' | 'fair' | 'hard' | 'brutal';

/** Qué tan pareja queda la partida con esa cantidad de impostores. */
export function balanceOf(impostors: number, players: number): Balance {
  const d = impostors - recommendedImpostors(players);
  return d < 0 ? 'easy' : d === 0 ? 'fair' : d === 1 ? 'hard' : 'brutal';
}
