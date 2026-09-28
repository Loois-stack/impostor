export interface Rng {
  next(): number;
  int(n: number): number;
  pick<T>(arr: readonly T[]): T;
  weighted<T>(arr: readonly T[], weight: (t: T) => number): T;
  shuffle<T>(arr: readonly T[]): T[];
  chance(p: number): boolean;
}

export function cryptoSeed(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0];
}

/** mulberry32: PRNG rápido y determinista para poder probar el motor con semilla fija. */
export function makeRng(seed = cryptoSeed()): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    pick: (arr) => arr[int(arr.length)],
    weighted(arr, weight) {
      const ws = arr.map((x) => Math.max(0, weight(x)));
      const total = ws.reduce((a, b) => a + b, 0);
      if (total <= 0) return arr[int(arr.length)];
      let r = next() * total;
      for (let i = 0; i < arr.length; i++) if ((r -= ws[i]) < 0) return arr[i];
      return arr[arr.length - 1];
    },
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    chance: (p) => next() < p,
  };
}
