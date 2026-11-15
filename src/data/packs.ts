import { makeRng, type Rng } from '../engine/rng';

/**
 * Sobres personales: cada jugador abre el suyo al recibir su carta. El diseño y el brillo se
 * sortean SIN mirar el rol, así que no dicen nada de quién es impostor. Por eso ningún brillo usa
 * el azul de los civiles (#2ee6ff) ni el rojo de los impostores (#ff2e4d).
 */

export type PackDesignId = 'clasico' | 'holo' | 'misterio' | 'fiesta' | 'expediente' | 'galaxia' | 'arcade' | 'terror';

export interface PackDesign {
  id: PackDesignId;
  name: string;
  emoji: string;
  /** Lema chiquito debajo del logo. */
  motto: string;
  c1: string;
  c2: string;
  horror?: boolean;
}

export const PACK_DESIGNS: PackDesign[] = [
  { id: 'clasico', name: 'Clásico', emoji: '👁️', motto: '¿Quién miente?', c1: '#7c5cff', c2: '#2a1a4a' },
  { id: 'holo', name: 'Prisma', emoji: '💎', motto: 'Edición holográfica', c1: '#d8d3ff', c2: '#4b4580' },
  { id: 'misterio', name: 'Misterio', emoji: '🎭', motto: 'Nada es lo que parece', c1: '#6b35e8', c2: '#0b0518' },
  { id: 'fiesta', name: 'Fiesta', emoji: '🪅', motto: '¡Que no te cachen!', c1: '#ff3fa4', c2: '#ff9a1f' },
  { id: 'expediente', name: 'Expediente', emoji: '🔎', motto: 'Caso sin resolver', c1: '#d2a465', c2: '#6b4220' },
  { id: 'galaxia', name: 'Galaxia', emoji: '🪐', motto: 'Perdido entre estrellas', c1: '#8a4dff', c2: '#06021a' },
  { id: 'arcade', name: 'Arcade', emoji: '👾', motto: 'Inserta moneda… y miente', c1: '#ff4fd8', c2: '#1b0848' },
  { id: 'terror', name: 'Terror', emoji: '👻', motto: 'No mires atrás', c1: '#5a2a7a', c2: '#070508', horror: true },
];

export const DESIGN_BY_ID = Object.fromEntries(PACK_DESIGNS.map((d) => [d.id, d])) as Record<PackDesignId, PackDesign>;

export type GlowId = 'plata' | 'oro' | 'rosa' | 'amatista' | 'holo' | 'cosmico';

export interface Glow {
  id: GlowId;
  name: string;
  rarity: 'Común' | 'Raro' | 'Épico' | 'Legendario' | 'Mítico';
  /** 1 a 5: más nivel, más suspenso, más luz y más sonido. */
  level: 1 | 2 | 3 | 4 | 5;
  /** Colores del brillo, del más claro al más intenso. */
  colors: string[];
  /** Probabilidad relativa. */
  weight: number;
  emoji: string;
}

export const GLOWS: Glow[] = [
  { id: 'plata', name: 'Plateado', rarity: 'Común', level: 1, colors: ['#ffffff', '#e4e0ff', '#b9b3df'], weight: 34, emoji: '🤍' },
  { id: 'oro', name: 'Dorado', rarity: 'Raro', level: 2, colors: ['#fff6c2', '#ffd23d', '#ffa51f'], weight: 26, emoji: '💛' },
  { id: 'rosa', name: 'Rosa neón', rarity: 'Raro', level: 2, colors: ['#ffd6f2', '#ff6ad5', '#e040fb'], weight: 14, emoji: '🩷' },
  { id: 'amatista', name: 'Amatista', rarity: 'Épico', level: 3, colors: ['#f0dcff', '#b26bff', '#8040ff'], weight: 14, emoji: '💜' },
  { id: 'holo', name: 'Holográfico', rarity: 'Legendario', level: 4, colors: ['#ffd6f2', '#fff6c2', '#e2ffc9', '#e6d9ff'], weight: 8, emoji: '🌈' },
  { id: 'cosmico', name: 'Cósmico', rarity: 'Mítico', level: 5, colors: ['#fff6c2', '#ffd23d', '#ff6ad5', '#b26bff'], weight: 4, emoji: '🌟' },
];

export const GLOW_BY_ID = Object.fromEntries(GLOWS.map((g) => [g.id, g])) as Record<GlowId, Glow>;

export interface PackRoll {
  d: PackDesignId;
  g: GlowId;
}

/** Probabilidad (0 a 1) de cada brillo. */
export const glowChance = (g: Glow) => g.weight / GLOWS.reduce((s, x) => s + x.weight, 0);

/**
 * Sortea el sobre de cada jugador. Recibe solo los ids y si la categoría es de terror: nunca el
 * rol. En rondas de terror sale más el sobre de Terror; en las demás casi nunca.
 */
export function rollPacks(ids: string[], horror: boolean, rng: Rng = makeRng()): Record<string, PackRoll> {
  const out: Record<string, PackRoll> = {};
  for (const id of ids) {
    const d = rng.weighted(PACK_DESIGNS, (x) => (x.horror ? (horror ? 6 : 0.4) : 1)).id;
    const g = rng.weighted(GLOWS, (x) => x.weight).id;
    out[id] = { d, g };
  }
  return out;
}

/** Sobre de respaldo para rondas guardadas antes de que existieran (no usa nada secreto). */
export function fallbackPack(n: number, order: string[], id: string): PackRoll {
  let h = 2166136261;
  for (const ch of `${n}|${order.join(',')}|${id}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return rollPacks([id], false, makeRng(h >>> 0))[id];
}
