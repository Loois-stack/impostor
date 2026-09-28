import { CHALLENGES, type Challenge } from '../data/challenges';
import type { Rng } from './rng';

export interface ChallengeState {
  /** Jugadores que ya recibieron reto esta ronda. */
  given: string[];
  /** Turnos seguidos sin reto (el "pity timer" sube la probabilidad). */
  sinceLast: number;
  max: number;
}

export const BASE_CHANCE = 0.3;

export function challengeChance(sinceLast: number) {
  return Math.min(0.75, BASE_CHANCE + sinceLast * 0.15);
}

/** Decide si el jugador en turno recibe un reto y cuál. */
export function maybeChallenge(
  player: string,
  st: ChallengeState,
  last: Record<string, number>,
  round: number,
  rng: Rng,
): Challenge | null {
  if (st.given.includes(player) || st.given.length >= st.max) return null;
  if (!rng.chance(challengeChance(st.sinceLast))) return null;
  return rng.weighted(CHALLENGES, (c) => {
    const l = last[c.id];
    const fresh = l === undefined ? 1.2 : 1 - Math.exp(-(round - l) / 8);
    return fresh * (c.kind === 'traicion' ? 0.8 : 1);
  });
}
