import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Skin = 'neon' | 'fiesta' | 'noir';

/**
 * Preferencias de ESTE teléfono (sonido, apariencia, nombre en salas). Van aparte del estado
 * de la partida porque en multijugador la partida la manda el anfitrión, pero esto no.
 */
interface Prefs {
  sound: boolean;
  music: boolean;
  vibration: boolean;
  skin: Skin;
  /** Identidad estable del teléfono en las salas (para reconectarse sin perder el lugar). */
  deviceId: string;
  /** Último nombre usado en una sala. */
  name: string;
  set(p: Partial<Omit<Prefs, 'set' | 'deviceId'>>): void;
}

const randomId = () => {
  const a = new Uint32Array(2);
  globalThis.crypto.getRandomValues(a);
  return `d${a[0].toString(36)}${a[1].toString(36)}`;
};

/** Antes estas opciones vivían dentro de la partida guardada: las rescatamos una vez. */
function legacy(): Partial<Prefs> {
  try {
    const old = JSON.parse(localStorage.getItem('impostor-v1') ?? 'null')?.state?.settings;
    if (!old) return {};
    return { sound: old.sound ?? true, music: old.music ?? true, vibration: old.vibration ?? true };
  } catch {
    return {};
  }
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      sound: true,
      music: true,
      vibration: true,
      skin: 'neon',
      deviceId: randomId(),
      name: '',
      ...legacy(),
      set: (p) => set(p),
    }),
    { name: 'impostor-prefs', version: 1 },
  ),
);
