/**
 * Puente mínimo entre el estado del juego y la red. Vive aparte para que el store no tenga
 * que importar la capa de red (y viceversa).
 */

/**
 * Lo que un teléfono invitado puede pedirle al anfitrión. `as` es el jugador por el que actúa:
 * él mismo o alguien que juega en su teléfono. El anfitrión comprueba que de verdad le toque.
 */
export type NetAction =
  | { a: 'ready'; as?: string }
  | { a: 'next'; as?: string }
  | { a: 'accept'; as?: string }
  | { a: 'vote'; as?: string; target: string }
  | { a: 'guess'; as?: string; id: string }
  | { a: 'cursed'; player: string }
  | { a: 'addLocal'; name: string }
  | { a: 'removeLocal'; as: string }
  | { a: 'avatar'; as: string; avatar: string };

export const link = {
  /** Este teléfono es invitado: refleja el estado del anfitrión y le manda sus acciones. */
  guest: false,
  send: (_a: NetAction): void => {},
};
