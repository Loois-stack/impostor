import { registerSW } from 'virtual:pwa-register';
import { create } from 'zustand';

/** Cada cuánto se pregunta si hay una versión nueva publicada. */
const CHECK_MS = 5 * 60 * 1000;

interface UpdateState {
  /** Hay una versión nueva descargada, lista para instalarse. */
  ready: boolean;
  applying: boolean;
}

export const useUpdate = create<UpdateState>(() => ({ ready: false, applying: false }));

let apply: (() => Promise<void>) | null = null;

/**
 * Busca actualizaciones al abrir, cada 5 minutos y cada vez que se vuelve a la app. La nueva
 * versión se descarga en segundo plano; instalarla recarga la página, por eso se hace fuera
 * de la ronda (la partida y la sala se recuperan solas tras recargar).
 */
export function startUpdates() {
  if (!('serviceWorker' in navigator)) return;
  apply = registerSW({
    immediate: true,
    onNeedRefresh: () => useUpdate.setState({ ready: true }),
    onRegisteredSW: (_url, reg) => {
      if (!reg) return;
      const check = () => {
        if (navigator.onLine && !reg.installing) void reg.update().catch(() => undefined);
      };
      setInterval(check, CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
    },
  });
}

/** Instala la versión nueva (recarga la app). */
export function applyUpdate() {
  if (!apply || useUpdate.getState().applying) return;
  useUpdate.setState({ applying: true });
  void apply();
}
