import type { Rng } from './rng';

export type EventId = 'double' | 'blind' | 'terror' | 'sudden' | 'cursed' | 'nobody';

export interface GameEvent {
  id: EventId;
  title: string;
  emoji: string;
  desc: string;
  /** Los eventos secretos no se anuncian. */
  secret?: boolean;
  weight: number;
}

export const EVENTS: Record<EventId, GameEvent> = {
  double: { id: 'double', title: 'Doble impostor', emoji: '👥', desc: '¡Esta ronda hay DOS impostores! Y no se conocen entre ellos.', weight: 3 },
  blind: { id: 'blind', title: 'Impostor a ciegas', emoji: '🙈', desc: 'El impostor NO sabe que es el impostor. Su carta parece normal… Cualquiera podría serlo. Incluso tú.', weight: 2 },
  terror: { id: 'terror', title: 'Ronda de terror', emoji: '🩸', desc: 'Las luces se apagan. La categoría será de horror.', weight: 2 },
  sudden: { id: 'sudden', title: 'Muerte súbita', emoji: '⏱️', desc: 'Una sola vuelta de pistas y 10 segundos por turno. ¡Piensa rápido!', weight: 2 },
  cursed: { id: 'cursed', title: 'Palabra maldita', emoji: '☠️', desc: 'Hay una palabra prohibida. Quien la diga pierde 50 puntos.', weight: 3 },
  nobody: { id: 'nobody', title: 'No había impostor', emoji: '🫥', desc: 'Todos tenían la misma carta.', secret: true, weight: 1 },
};

export const CURSED_WORDS = [
  'grande', 'color', 'famoso', 'película', 'rojo', 'negro', 'pequeño', 'todos', 'mucho', 'miedo',
  'casa', 'tiene', 'come', 'juego', 'bonito', 'raro', 'agua', 'blanco', 'niño', 'mundo',
];

export const EVENT_CHANCE = 0.18;

export function rollEvent(
  opts: { enabled: boolean; sessionRound: number; players: number; impostors: number; horrorAvailable: boolean; lastEvent?: EventId },
  rng: Rng,
): EventId | undefined {
  if (!opts.enabled || opts.sessionRound < 2 || !rng.chance(EVENT_CHANCE)) return undefined;
  const pool = (Object.values(EVENTS) as GameEvent[]).filter((e) => {
    if (e.id === opts.lastEvent) return false;
    if (e.id === 'double') return opts.players >= 5 && opts.impostors === 1;
    if (e.id === 'terror') return opts.horrorAvailable;
    return true;
  });
  return pool.length ? rng.weighted(pool, (e) => e.weight).id : undefined;
}
