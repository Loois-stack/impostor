import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Skin = 'neon' | 'fiesta' | 'noir';
/** Qué reacciones suenan en este teléfono: las de todos, solo las propias o ninguna. */
export type ReactSound = 'all' | 'mine' | 'off';

/**
 * Preferencias de ESTE teléfono (sonido, apariencia, nombre en salas). Van aparte del estado
 * de la partida porque en multijugador la partida la manda el anfitrión, pero esto no.
 */
export type PerfPref = 'auto' | 'lite' | 'full';

interface Prefs {
  sound: boolean;
  music: boolean;
  vibration: boolean;
  reactSound: ReactSound;
  /** Ver la animación cuando eliminan a alguien. */
  elimFx: boolean;
  /** Efectos visuales: automático (ligeros si el teléfono no alcanza), siempre ligeros o completos. */
  perf: PerfPref;
  /** Tus sonidos grabados (comprimidos), por reacción: si existe, esa reacción suena con tu voz. */
  sounds: Record<string, string>;
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
      reactSound: 'all',
      elimFx: true,
      perf: 'auto',
      sounds: {},
      skin: 'neon',
      deviceId: randomId(),
      name: '',
      ...legacy(),
      set: (p) => set(p),
    }),
    {
      name: 'impostor-prefs',
      version: 2,
      // v2: la risa grabada pasó a ser uno de "tus sonidos" (uno por reacción).
      migrate: (state, version) => {
        const st = (state ?? {}) as Partial<Prefs> & { laugh?: string };
        if (version < 2) {
          const sounds = { ...(st.sounds ?? {}) };
          if (st.laugh) sounds['😂'] = st.laugh;
          delete st.laugh;
          return { ...st, sounds } as Prefs;
        }
        return st as Prefs;
      },
    },
  ),
);
