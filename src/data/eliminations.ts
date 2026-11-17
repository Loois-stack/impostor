/**
 * Animaciones de eliminación: cada jugador elige la suya (o "sorpresa"). Los videos se hicieron en
 * Blender (Cycles) desde cero y el avatar del jugador se dibuja encima, al compás de cada video.
 * Los tiempos (`hit`, `end`) están en segundos y salen de los cuadros de cada escena (24 por segundo).
 */
export type ElimId = 'rayo' | 'agujero' | 'pinata' | 'cohete';
export type ElimChoice = ElimId | 'random';

export interface ElimStyle {
  id: ElimId;
  name: string;
  emoji: string;
  desc: string;
  /** Duración del video. */
  dur: number;
  /** Momento clave: cae el rayo, se colapsa el agujero, revienta la piñata, despega el cohete. */
  hit: number;
}

export const ELIMS: ElimStyle[] = [
  { id: 'rayo', name: 'Fulminado', emoji: '⚡', desc: 'Se arma la tormenta y le cae un rayo.', dur: 2.5, hit: 22 / 24 },
  { id: 'agujero', name: 'Agujero negro', emoji: '🕳️', desc: 'Un remolino espacial se lo traga.', dur: 64 / 24, hit: 46 / 24 },
  { id: 'pinata', name: 'Piñatazo', emoji: '🪅', desc: 'Dos golpes y… ¡revienta en confeti!', dur: 3, hit: 34 / 24 },
  { id: 'cohete', name: 'Al espacio', emoji: '🚀', desc: 'Despega y explota en fuegos artificiales.', dur: 3, hit: 14 / 24 },
];

export const ELIM_BY_ID = Object.fromEntries(ELIMS.map((e) => [e.id, e])) as Record<ElimId, ElimStyle>;

export const isElimChoice = (x: unknown): x is ElimChoice => x === 'random' || (typeof x === 'string' && x in ELIM_BY_ID);

/**
 * La animación que le toca a un jugador. Con "sorpresa" se elige con el número de ronda y de
 * votación: así todos los teléfonos de la sala ven la misma.
 */
export function elimFor(choice: ElimChoice | undefined, seed: string): ElimStyle {
  if (choice && choice !== 'random') return ELIM_BY_ID[choice];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ELIMS[Math.abs(h) % ELIMS.length];
}

/** Dónde está el video de cada animación (junto a la app, también sin internet). */
export const elimVideo = (id: ElimId) => `${import.meta.env.BASE_URL}elim/${id}.mp4`;
