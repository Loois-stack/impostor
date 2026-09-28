import IMAGES from '../data/images.json';
import type { Item } from '../data/types';

const map = IMAGES as Record<string, string>;

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
    img.src = url;
  }
}

/** Descarga todas las imágenes para que el service worker las guarde y se pueda jugar sin internet. */
export async function downloadAll(onProgress: (done: number, total: number) => void) {
  const urls = [...new Set(Object.values(map))];
  let done = 0;
  const queue = [...urls];
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift()!;
      try {
        await fetch(url, { mode: 'no-cors' });
      } catch {
        /* sin conexión: se intentará en la partida */
      }
      onProgress(++done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

export const imageCount = () => new Set(Object.values(map)).size;
