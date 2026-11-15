import { INTENSITY, type Intensity } from './challenges';
import { maxImpostors } from './roles';
import type { Rng } from './rng';

export type EventId =
  | 'double'
  | 'blind'
  | 'terror'
  | 'sudden'
  | 'cursed'
  | 'nobody'
  | 'accomplice'
  | 'detective'
  | 'oneword'
  | 'mexican'
  | 'mime'
  | 'bounty'
  | 'jester'
  | 'whisper';

export interface GameEvent {
  id: EventId;
  title: string;
  emoji: string;
  desc: string;
  color: string;
  /** Recordatorio corto que se ve durante las pistas. */
  rule?: string;
  /** Siempre se juega oculto: se descubre al final. */
  secret?: boolean;
  /** A veces se juega oculto: se anuncia "evento secreto" sin decir cuál. */
  canHide?: boolean;
  minPlayers?: number;
  weight: number;
}

export const EVENTS: Record<EventId, GameEvent> = {
  double: { id: 'double', title: 'Impostor extra', emoji: '👥', color: '#ff2e4d', desc: '¡Esta ronda hay un impostor MÁS de lo normal! Cuenten bien antes de cantar victoria.', canHide: true, minPlayers: 5, weight: 3 },
  blind: { id: 'blind', title: 'Impostor a ciegas', emoji: '🙈', color: '#7c5cff', desc: 'El impostor NO sabe que es el impostor. Su carta parece normal… Cualquiera podría serlo. Incluso tú.', weight: 2 },
  terror: { id: 'terror', title: 'Ronda de terror', emoji: '🩸', color: '#8a0020', desc: 'Las luces se apagan. La categoría será de horror.', weight: 2 },
  sudden: { id: 'sudden', title: 'Muerte súbita', emoji: '⏱️', color: '#ffb547', desc: 'Una sola vuelta de pistas y 10 segundos por turno. ¡Piensa rápido!', rule: 'Una vuelta · 10 s por turno', weight: 2 },
  cursed: { id: 'cursed', title: 'Palabra maldita', emoji: '☠️', color: '#ff5470', desc: 'Hay una palabra prohibida. Quien la diga pierde 50 puntos.', weight: 3 },
  nobody: { id: 'nobody', title: 'No había impostor', emoji: '🫥', color: '#b8c6ff', desc: 'Todos tenían la misma carta.', secret: true, weight: 1 },
  accomplice: { id: 'accomplice', title: 'Hay un cómplice', emoji: '🤝', color: '#ff8a3d', desc: 'Un civil sabe quién es el impostor y juega de su lado. Si el impostor sobrevive, el cómplice también gana.', canHide: true, minPlayers: 5, weight: 3 },
  detective: { id: 'detective', title: 'Hay un detective', emoji: '🔎', color: '#39ff88', desc: 'Un civil sabe con certeza que otro jugador es inocente. ¿Podrá guiar al grupo sin delatarse?', minPlayers: 5, weight: 2 },
  oneword: { id: 'oneword', title: 'Una sola palabra', emoji: '☝️', color: '#2ee6ff', desc: 'Esta ronda cada pista debe ser UNA sola palabra. Nada de frases.', rule: 'Pistas de UNA sola palabra', weight: 2 },
  mexican: { id: 'mexican', title: 'Fiesta mexicana', emoji: '🇲🇽', color: '#19c37d', desc: 'Toda la ronda se habla con el acento que salga. Quien se salga del personaje, se vuelve sospechoso.', weight: 3 },
  mime: { id: 'mime', title: 'Cine mudo', emoji: '🎬', color: '#e8e2d0', desc: 'Nadie habla en su turno: las pistas se dan solo con mímica y gestos. Discutir sí se vale.', rule: 'Pistas solo con mímica', weight: 2 },
  bounty: { id: 'bounty', title: 'Ronda dorada', emoji: '💰', color: '#ffd23d', desc: 'Todos los puntos de esta ronda valen el DOBLE. Para bien… y para mal.', rule: 'Los puntos valen x2', weight: 2 },
  jester: { id: 'jester', title: 'Hay un bufón', emoji: '🃏', color: '#ff5fc8', desc: 'Un civil QUIERE que lo acusen: si votan por él, gana él solito. No caigan en su trampa.', canHide: true, minPlayers: 4, weight: 2 },
  whisper: { id: 'whisper', title: 'Ronda de susurros', emoji: '🤫', color: '#9d7bff', desc: 'Todos hablan susurrando hasta la votación. Quien alce la voz se vuelve sospechoso.', rule: 'Todos susurran', weight: 2 },
};

export const EVENT_LIST = Object.values(EVENTS) as GameEvent[];

/** Cómo se presenta un evento oculto: 'mystery' avisa que hay algo raro; 'silent' no avisa nada. */
export type Hidden = 'mystery' | 'silent';

export const MYSTERY = {
  title: 'Evento secreto',
  emoji: '❓',
  color: '#b8c6ff',
  desc: 'Algo es distinto esta ronda y nadie sabe qué. Puede haber dos impostores, un cómplice, un bufón… o ningún impostor. Se revela al final.',
};

export const CURSED_WORDS = [
  'grande', 'color', 'famoso', 'película', 'rojo', 'negro', 'pequeño', 'todos', 'mucho', 'miedo',
  'casa', 'tiene', 'come', 'juego', 'bonito', 'raro', 'agua', 'blanco', 'niño', 'mundo',
];

export interface Accent {
  id: string;
  name: string;
  emoji: string;
  how: string;
}

/** Acentos y personajes de la "Fiesta mexicana". Con cariño: nos reímos con ellos, no de ellos. */
export const MX_ACCENTS: Accent[] = [
  { id: 'norteno', name: 'Norteño', emoji: '🤠', how: 'Golpeado, fuerte y sin miedo: "¡Ey, compa! ¡Arre con la que barre!"' },
  { id: 'chilango', name: 'Chilango', emoji: '🚇', how: 'Cantadito y alargando el final: "No maaanches, güeeey, ¿qué pasóóó?"' },
  { id: 'fresa', name: 'Fresa', emoji: '💅', how: 'Con la papa en la boca: "O sea, güey, tipo… literal, qué oso."' },
  { id: 'yucateco', name: 'Yucateco', emoji: '🌴', how: 'Pausado y golpeadito: "¡Mare, lindo hermoso! Lo busco y no lo busco."' },
  { id: 'costeno', name: 'Costeño', emoji: '🌊', how: 'Rapidísimo y comiéndose las eses: "¡Qué pasó, mi vida! E\'to e\' así."' },
  { id: 'regio', name: 'Regio', emoji: '🥩', how: 'Cantado del norte y directo: "¡Qué onda, primo! Jálese a la carnita asada."' },
  { id: 'tianguis', name: 'Vendedor de tianguis', emoji: '🛍️', how: 'Gritando ofertas: "¡Pásele, pásele! ¡Bara, bara, llévelo, llévelo!"' },
  { id: 'abuelita', name: 'Abuelita mexicana', emoji: '👵', how: 'Con ternura y regaño: "Ay, mijito, ¿ya comiste? Ponte un suéter."' },
  { id: 'lucha', name: 'Narrador de lucha libre', emoji: '🤼', how: 'A todo pulmón: "¡Desde la tercera cuerdaaa, señoras y señores!"' },
  { id: 'telenovela', name: 'Galán de telenovela', emoji: '🌹', how: 'Puro drama: "¡Tú no puedes hacerme esto, María Fernanda!"' },
];

export const ACCENT_BY_ID: Record<string, Accent> = Object.fromEntries(MX_ACCENTS.map((a) => [a.id, a]));

export const MX_ADULT_RULE =
  'Modo +18: cada pista lleva al menos una grosería mexicana (no mames, chingón, pinche, cabrón, a huevo…). Se le dicen a la carta, nunca a alguien de la mesa.';

export const EVENT_CHANCE = INTENSITY.normal.event;

export interface RollOpts {
  enabled: boolean;
  sessionRound: number;
  players: number;
  impostors: number;
  horrorAvailable: boolean;
  lastEvent?: EventId;
  intensity?: Intensity;
  /** Eventos que los jugadores apagaron en el catálogo. */
  off?: EventId[];
}

/** Eventos que pueden salir con esta mesa (jugadores, categorías, ajustes). */
export function eligibleEvents(opts: Pick<RollOpts, 'players' | 'impostors' | 'horrorAvailable' | 'lastEvent' | 'off'>): GameEvent[] {
  return EVENT_LIST.filter((e) => {
    if (e.id === opts.lastEvent || opts.off?.includes(e.id)) return false;
    if (opts.players < (e.minPlayers ?? 0)) return false;
    // Solo si cabe uno más sin que los impostores igualen a los civiles.
    if (e.id === 'double') return opts.impostors + 1 <= maxImpostors(opts.players);
    if (e.id === 'terror') return opts.horrorAvailable;
    return true;
  });
}

export function rollEvent(opts: RollOpts, rng: Rng): EventId | undefined {
  const lvl = INTENSITY[opts.intensity ?? 'normal'];
  // La primera ronda de la noche es normal para que todos entiendan el juego (salvo en Caos).
  if (!opts.enabled || (opts.sessionRound < 2 && opts.intensity !== 'chaos') || !rng.chance(lvl.event)) return undefined;
  const pool = eligibleEvents(opts);
  return pool.length ? rng.weighted(pool, (e) => e.weight).id : undefined;
}

/** ¿Se juega oculto este evento? */
export function rollHidden(id: EventId, rng: Rng): Hidden | undefined {
  const e = EVENTS[id];
  if (e.secret) return rng.chance(0.5) ? 'silent' : 'mystery';
  if (e.canHide && rng.chance(0.3)) return 'mystery';
  return undefined;
}
