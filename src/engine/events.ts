import type { Rng } from './rng';

export type EventId = 'double' | 'blind' | 'terror' | 'sudden' | 'cursed' | 'nobody' | 'accomplice' | 'detective' | 'oneword';

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
  accomplice: { id: 'accomplice', title: 'Hay un cómplice', emoji: '🤝', desc: 'Un civil sabe quién es el impostor y juega de su lado. Si el impostor sobrevive, el cómplice también gana.', weight: 3 },
  detective: { id: 'detective', title: 'Hay un detective', emoji: '🔎', desc: 'Un civil sabe con certeza que otro jugador es inocente. ¿Podrá guiar al grupo sin delatarse?', weight: 2 },
  oneword: { id: 'oneword', title: 'Una sola palabra', emoji: '☝️', desc: 'Esta ronda cada pista debe ser UNA sola palabra. Nada de frases.', weight: 2 },
};

export const CURSED_WORDS = [
  'grande', 'color', 'famoso', 'película', 'rojo', 'negro', 'pequeño', 'todos', 'mucho', 'miedo',
  'casa', 'tiene', 'come', 'juego', 'bonito', 'raro', 'agua', 'blanco', 'niño', 'mundo',
];

export const EVENT_CHANCE = 0.22;

export function rollEvent(
  opts: { enabled: boolean; sessionRound: number; players: number; impostors: number; horrorAvailable: boolean; lastEvent?: EventId },
  rng: Rng,
): EventId | undefined {
  if (!opts.enabled || opts.sessionRound < 2 || !rng.chance(EVENT_CHANCE)) return undefined;
  const pool = (Object.values(EVENTS) as GameEvent[]).filter((e) => {
    if (e.id === opts.lastEvent) return false;
    if (e.id === 'double') return opts.players >= 5 && opts.impostors === 1;
    if (e.id === 'terror') return opts.horrorAvailable;
    if (e.id === 'accomplice' || e.id === 'detective') return opts.players >= 5;
    return true;
  });
  return pool.length ? rng.weighted(pool, (e) => e.weight).id : undefined;
}
