/**
 * Puente mínimo entre el estado del juego y la red. Vive aparte para que el store no tenga
 * que importar la capa de red (y viceversa).
 */

/** Lo que un invitado puede pedirle al anfitrión. Todo lo demás lo decide el anfitrión. */
export type NetAction =
  | { a: 'ready' }
  | { a: 'next' }
  | { a: 'accept' }
  | { a: 'vote'; target: string }
  | { a: 'guess'; id: string }
  | { a: 'cursed'; player: string };

export const link = {
  /** Este teléfono es invitado: refleja el estado del anfitrión y le manda sus acciones. */
  guest: false,
  send: (_a: NetAction): void => {},
};
