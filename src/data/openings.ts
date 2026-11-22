/**
 * Cómo se abre el sobre personal: cada jugador elige (como su animación de eliminación). Es igual
 * para civiles e impostores y no depende de la carta, así que no delata a nadie.
 */
export type OpenId = 'corte' | 'fuego';

export interface OpenStyle {
  id: OpenId;
  name: string;
  emoji: string;
  desc: string;
  /** Qué hacer con el sobre cerrado. */
  hint: string;
}

export const OPENINGS: OpenStyle[] = [
  { id: 'corte', name: 'Cortar', emoji: '✂️', desc: 'Lo cortas con el dedo y se llena de luz.', hint: 'Desliza el dedo por la línea punteada para cortarlo ✂️' },
  { id: 'fuego', name: 'Fuego azul', emoji: '🔥', desc: 'Lo tocas y se desintegra en llamas azules.', hint: 'Toca el sobre donde quieras prenderle fuego 🔥' },
];

export const OPEN_BY_ID = Object.fromEntries(OPENINGS.map((o) => [o.id, o])) as Record<OpenId, OpenStyle>;

export const isOpenChoice = (x: unknown): x is OpenId => typeof x === 'string' && x in OPEN_BY_ID;

/** La apertura de un jugador (si no eligió, o llega una que este teléfono no conoce: cortar). */
export const openOf = (id?: string): OpenStyle => (id && isOpenChoice(id) ? OPEN_BY_ID[id] : OPENINGS[0]);
