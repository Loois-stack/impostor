import { MISSIONS, TURN_EVENTS, type Challenge, type ChallengeKind } from '../data/challenges';
import type { Rng } from './rng';

export interface ChallengeState {
  /** Jugadores que ya recibieron evento de turno esta ronda. */
  given: string[];
  /** Turnos seguidos sin evento (el "pity timer" sube la probabilidad). */
  sinceLast: number;
  max: number;
}

/** Qué tan seguido salen los eventos. Es lo que el jugador elige en "Frecuencia de eventos". */
export type Intensity = 'chill' | 'normal' | 'wild' | 'chaos';

export interface IntensityLevel {
  label: string;
  emoji: string;
  /** Probabilidad de evento de ronda. */
  event: number;
  /** Probabilidad base de evento en cada turno (sube 15 % por cada turno sin evento). */
  turn: number;
  turnCap: number;
  /** Máximo de eventos de turno por ronda según el número de jugadores. */
  turnMax: (players: number) => number;
  /** Probabilidad de que a un jugador le toque misión secreta al repartir. */
  mission: number;
  missionMax: (players: number) => number;
}

export const INTENSITY: Record<Intensity, IntensityLevel> = {
  chill: { label: 'Pocos', emoji: '🌙', event: 0.12, turn: 0.15, turnCap: 0.5, turnMax: (n) => Math.ceil(n / 3), mission: 0.1, missionMax: () => 1 },
  normal: { label: 'Normal', emoji: '⚡', event: 0.25, turn: 0.3, turnCap: 0.75, turnMax: (n) => Math.ceil(n / 2), mission: 0.18, missionMax: (n) => Math.ceil(n / 3) },
  wild: { label: 'Muchos', emoji: '🔥', event: 0.45, turn: 0.45, turnCap: 0.85, turnMax: (n) => Math.ceil(n * 0.75), mission: 0.28, missionMax: (n) => Math.ceil(n / 2) },
  chaos: { label: 'Caos', emoji: '🌪️', event: 1, turn: 0.7, turnCap: 0.95, turnMax: (n) => n, mission: 0.4, missionMax: (n) => Math.ceil(n * 0.75) },
};

export const BASE_CHANCE = INTENSITY.normal.turn;

export function challengeChance(sinceLast: number, intensity: Intensity = 'normal') {
  const lvl = INTENSITY[intensity];
  return Math.min(lvl.turnCap, lvl.turn + sinceLast * 0.15);
}

export interface ChallengeOpts {
  intensity?: Intensity;
  /** Modo +18: incluye los eventos con groserías. */
  adult?: boolean;
  /** Tipos de evento desactivados por los jugadores. */
  kindsOff?: ChallengeKind[];
}

const allowed = (ch: Challenge, o: ChallengeOpts) => (o.adult || !ch.adult) && !(o.kindsOff ?? []).includes(ch.kind);

/** Preferimos lo que lleva más tiempo sin salir. */
const freshness = (id: string, last: Record<string, number>, round: number) => {
  const l = last[id];
  return l === undefined ? 1.2 : 1 - Math.exp(-(round - l) / 8);
};

/** Decide si el jugador en turno recibe un evento y cuál. */
export function maybeChallenge(
  player: string,
  st: ChallengeState,
  last: Record<string, number>,
  round: number,
  rng: Rng,
  /** Tipos que ya salieron esta ronda: se vuelven poco probables para variar. */
  usedKinds: ChallengeKind[] = [],
  opts: ChallengeOpts = {},
): Challenge | null {
  if (st.given.includes(player) || st.given.length >= st.max) return null;
  if (!rng.chance(challengeChance(st.sinceLast, opts.intensity))) return null;
  const pool = TURN_EVENTS.filter((ch) => allowed(ch, opts));
  if (!pool.length) return null;
  return rng.weighted(pool, (ch) => {
    const repeat = usedKinds.filter((k) => k === ch.kind).length;
    // Con +18 activo, los eventos picantes salen un poco más: para eso lo prendieron.
    return freshness(ch.id, last, round) * (ch.adult ? 1.6 : 1) * Math.pow(0.2, repeat);
  });
}

/**
 * Reparte las misiones secretas junto con las cartas. Nadie sabe quién tiene una: cada jugador
 * tiene la misma probabilidad, sea civil o impostor (así no se filtra información).
 */
export function dealMissions(
  players: string[],
  /** Impostores que saben que lo son: no reciben misiones pensadas para civiles. */
  awareImpostors: string[],
  last: Record<string, number>,
  round: number,
  rng: Rng,
  opts: ChallengeOpts & { enabled: boolean },
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!opts.enabled || (opts.kindsOff ?? []).includes('traicion')) return out;
  const lvl = INTENSITY[opts.intensity ?? 'normal'];
  const max = lvl.missionMax(players.length);
  const used = new Set<string>();
  for (const p of rng.shuffle(players)) {
    if (Object.keys(out).length >= max) break;
    if (!rng.chance(lvl.mission)) continue;
    const pool = MISSIONS.filter((m) => (opts.adult || !m.adult) && !used.has(m.id) && !(m.civ && awareImpostors.includes(p)));
    if (!pool.length) break;
    const m = rng.weighted(pool, (x) => freshness(x.id, last, round) * (x.adult ? 1.6 : 1));
    used.add(m.id);
    out[p] = m.id;
  }
  return out;
}
