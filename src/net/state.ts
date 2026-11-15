import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePrefs } from '../store/prefs';
import { useGame } from '../store/game';

export type NetRole = 'off' | 'host' | 'guest';
export type NetStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error';

interface NetState {
  role: NetRole;
  /** Código de la sala (4 letras/números). */
  code: string;
  status: NetStatus;
  error?: string;
  /** Jugadores conectados ahora mismo (ids). */
  present: string[];
  /** Última sala en la que estuvo este teléfono (para volver a entrar con un toque). */
  lastCode?: string;
  /** Invitado: desde cuándo no hay conexión con el anfitrión (ms). */
  lostSince?: number;
  /** Invitado: si para entonces no volvió la conexión, se regresa a "Entrar a una sala". */
  giveUpAt?: number;
}

/** Estado de la conexión. Solo rol y código se guardan, para poder volver a la sala tras recargar. */
export const useNet = create<NetState>()(
  persist<NetState, [], [], Pick<NetState, 'role' | 'code' | 'lastCode'>>(() => ({ role: 'off', code: '', status: 'idle', present: [] }), {
    name: 'impostor-net',
    version: 1,
    partialize: (s) => ({ role: s.role, code: s.code, lastCode: s.lastCode }),
  }),
);

/**
 * Id público de un teléfono dentro de una sala. El id real del teléfono solo lo conoce el
 * anfitrión (sirve para recuperar el lugar al reconectarse); los demás ven este derivado.
 */
export function publicId(deviceId: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < deviceId.length; i++) {
    const ch = deviceId.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `p${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}`;
}

/**
 * Quién soy en esta partida.
 * - Un solo teléfono: no hay "yo"; quien lo sostiene controla a todos.
 * - Sala: `me` es mi jugador, `seats` son los jugadores que se manejan desde este teléfono
 *   (yo y quienes juegan en él) y `host` dice si este teléfono dirige la partida.
 */
export function useSeat() {
  const online = useGame((s) => s.online);
  const players = useGame((s) => s.players);
  const role = useNet((s) => s.role);
  const deviceId = usePrefs((s) => s.deviceId);
  const me = online ? publicId(deviceId) : undefined;
  const seats = online ? players.filter((p) => p.id === me || p.owner === me).map((p) => p.id) : players.map((p) => p.id);
  return { online, me, seats, host: !online || role !== 'guest' };
}

/** ¿Está conectado el teléfono de este jugador? */
export const isHere = (p: { id: string; owner?: string }, present: string[]) => present.includes(p.owner ?? p.id);
