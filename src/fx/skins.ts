import type { CSSProperties } from 'react';
import type { Skin } from '../store/prefs';

export interface SkinDef {
  name: string;
  emoji: string;
  desc: string;
  /** Colores de ambiente cuando no hay una categoría en juego. */
  c1: string;
  c2: string;
  bg: [number, number, number];
  /** Reverso de las cartas: centro, borde y adorno. */
  back: [string, string, string];
  /** Partículas del fondo. */
  dust: 'embers' | 'confetti' | 'gold';
}

/** Temas visuales: cambian el fondo, el reverso de las cartas y los colores del menú. */
export const SKINS: Record<Skin, SkinDef> = {
  neon: { name: 'Neón', emoji: '🌌', desc: 'Luces moradas y brasas', c1: '#7c5cff', c2: '#ff2e4d', bg: [7, 6, 11], back: ['#2b2150', '#0c0914', '#ff2e4d'], dust: 'embers' },
  fiesta: { name: 'Fiesta', emoji: '🎉', desc: 'Papel picado y confeti', c1: '#ff3d81', c2: '#ff9d00', bg: [20, 6, 15], back: ['#b3175f', '#2b0620', '#ffc83d'], dust: 'confetti' },
  noir: { name: 'Casino', emoji: '🎰', desc: 'Negro, oro y polvo dorado', c1: '#e8b84a', c2: '#8a1024', bg: [5, 5, 5], back: ['#2a251b', '#000000', '#e8b84a'], dust: 'gold' },
};

export const SKIN_IDS = Object.keys(SKINS) as Skin[];

/** Variables CSS de un tema (también sirven para la vista previa de cada uno). */
export const skinVars = (skin: Skin): CSSProperties =>
  ({
    '--back1': SKINS[skin].back[0],
    '--back2': SKINS[skin].back[1],
    '--back-accent': SKINS[skin].back[2],
    '--bg': `rgb(${SKINS[skin].bg.join(',')})`,
  }) as CSSProperties;
