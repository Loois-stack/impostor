/**
 * Fluidez: decide si este teléfono usa efectos completos o ligeros.
 *
 * En "automático" se mide cuántos cuadros por segundo alcanza la app durante el uso normal; si va
 * lenta varias veces seguidas, cambia a ligeros (y lo recuerda para la próxima vez). Los ligeros
 * quitan adornos que se repintan sin parar, bajan partículas y la resolución del fuego. Se marca en
 * `<html data-perf="lite|full">` para el CSS y en `perf.lite` para el código.
 */
import { usePrefs } from '../store/prefs';

const KEY = 'impostor-perf-auto';

let autoLite = (() => {
  try {
    if (localStorage.getItem(KEY) === 'lite') return true;
  } catch {
    /* sin almacenamiento */
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduced || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2);
})();

export const perf = {
  get lite() {
    const p = usePrefs.getState().perf ?? 'auto';
    return p === 'lite' || (p === 'auto' && autoLite);
  },
  /** ¿El modo automático ya detectó que este teléfono va lento? */
  get autoLite() {
    return autoLite;
  },
  /** Cuánto de cada efecto (1 completo, menos en ligeros). */
  scale(full: number, lite: number) {
    return perf.lite ? lite : full;
  },
};

const apply = () => {
  document.documentElement.dataset.perf = perf.lite ? 'lite' : 'full';
};

/** Mide en ventanas de 3 s (solo con la app a la vista) y baja a ligeros si va lenta. */
function watch() {
  let slow = 0;
  let windows = 0;
  const measure = () => {
    if (autoLite || windows >= 12) return;
    if (document.hidden) {
      setTimeout(measure, 3000);
      return;
    }
    const ts: number[] = [];
    const t0 = performance.now();
    const f = (t: number) => {
      ts.push(t);
      if (t - t0 < 3000 && !document.hidden) requestAnimationFrame(f);
      else {
        const d = ts
          .slice(1)
          .map((x, i) => x - ts[i])
          .sort((a, b) => a - b);
        if (d.length > 20) {
          windows++;
          const med = d[Math.floor(d.length / 2)];
          const p90 = d[Math.floor(d.length * 0.9)];
          // Mediana arriba de 28 ms (menos de ~35 cuadros por segundo) o muchos tirones.
          slow = med > 28 || p90 > 55 ? slow + 1 : Math.max(0, slow - 1);
          if (slow >= 2) {
            autoLite = true;
            try {
              localStorage.setItem(KEY, 'lite');
            } catch {
              /* sin almacenamiento */
            }
            apply();
            return;
          }
        }
        setTimeout(measure, 4000);
      }
    };
    requestAnimationFrame(f);
  };
  setTimeout(measure, 2500);
}

export function initPerf() {
  apply();
  usePrefs.subscribe(apply);
  watch();
}
