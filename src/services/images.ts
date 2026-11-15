import IMAGES from '../data/images.json';
import type { Item } from '../data/types';

const map = IMAGES as Record<string, string>;

/** Caché de imágenes del service worker (ver vite.config.ts). */
const CACHE = 'wiki-img-v2';

/** URL de la imagen de Wikipedia (resuelta al compilar con `npm run validate-wiki`) o null si usa arte propio. */
export const imageFor = (item: Item): string | null => item.img ?? map[item.id] ?? null;

const preloaded = new Set<string>();
export function preload(items: (Item | undefined | null)[]) {
  for (const it of items) {
    const url = it && imageFor(it);
    if (!url || preloaded.has(url)) continue;
    preloaded.add(url);
    const img = new Image();
    img.decoding = 'async';
    if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.src = url;
  }
}

const allUrls = () => [...new Set(Object.values(map))];
export const imageCount = () => allUrls().length;

async function cached(): Promise<Set<string>> {
  if (!('caches' in globalThis)) return new Set();
  const keys = await (await caches.open(CACHE)).keys();
  return new Set(keys.map((r) => r.url));
}

export interface OfflineStatus {
  done: number;
  total: number;
  /** MB que ocupa la app en este teléfono, si el navegador lo dice. */
  mb?: number;
}

/** Cuántas imágenes están ya guardadas en este teléfono. */
export async function offlineStatus(): Promise<OfflineStatus> {
  const have = await cached().catch(() => new Set<string>());
  const urls = allUrls();
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  return { done: urls.filter((u) => have.has(u)).length, total: urls.length, mb: est?.usage ? Math.round(est.usage / 1e6) : undefined };
}

/**
 * Descarga las imágenes que falten para jugar sin internet. Se piden con CORS para que el
 * navegador guarde la imagen real (y no una respuesta "opaca" que cuenta como 7 MB cada una).
 * Se puede pausar y continuar: lo ya guardado no se vuelve a bajar.
 */
export async function downloadAll(onProgress: (s: { done: number; total: number; failed: number }) => void, stop: () => boolean) {
  // Pide al navegador que no borre lo descargado si falta espacio.
  await navigator.storage?.persist?.().catch(() => false);
  const cache = 'caches' in globalThis ? await caches.open(CACHE) : null;
  const have = await cached().catch(() => new Set<string>());
  const urls = allUrls();
  const queue = urls.filter((u) => !have.has(u));
  let done = urls.length - queue.length;
  let failed = 0;
  onProgress({ done, total: urls.length, failed });
  const worker = async () => {
    while (queue.length && !stop()) {
      const url = queue.shift()!;
      try {
        let res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        // Wikimedia frena a quien pide demasiado rápido: se espera y se reintenta.
        for (let wait = 2000; res.status === 429 && wait <= 8000 && !stop(); wait *= 2) {
          await new Promise((r) => setTimeout(r, wait));
          res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        }
        if (!res.ok) throw new Error(String(res.status));
        // Con el service worker activo ya quedó guardada; si no (primera visita), se guarda aquí.
        if (cache && !(await cache.match(url))) await cache.put(url, res.clone());
        await res.arrayBuffer();
        done++;
      } catch {
        failed++;
      }
      onProgress({ done, total: urls.length, failed });
    }
  };
  // Pocas descargas a la vez para no saturar a Wikimedia (ni el Wi-Fi de la fiesta).
  await Promise.all(Array.from({ length: 3 }, worker));
}

/** Limpia la caché de versiones anteriores (guardaba respuestas opacas que ya no sirven). */
export function dropLegacyCache() {
  if ('caches' in globalThis) void caches.delete('wiki-img').catch(() => false);
}
