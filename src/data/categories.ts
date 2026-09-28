import type { Category, CategoryId } from './types';

export const CATEGORIES: Category[] = [
  { id: 'memes', name: 'Memes y virales', emoji: '🐸', color: '#39ff88', color2: '#0b8f5a', tagline: 'Lo que rompió internet' },
  { id: 'creepy', name: 'Creepypastas y leyendas', emoji: '🩸', color: '#ff2e4d', color2: '#4a0010', tagline: 'No leas esto de noche', horror: true },
  { id: 'scp', name: 'Fundación SCP', emoji: '🔒', color: '#e8e2d0', color2: '#3b3528', tagline: 'Asegurar. Contener. Proteger.', horror: true },
  { id: 'horror', name: 'Terror de cine', emoji: '🔪', color: '#c21f3a', color2: '#1a0006', tagline: '¿Quién está detrás de ti?', horror: true },
  { id: 'cartoons', name: 'Caricaturas', emoji: '📺', color: '#ffd23d', color2: '#ff7a00', tagline: 'Tu infancia en la tele' },
  { id: 'animated', name: 'Cine animado', emoji: '🎞️', color: '#48c6ff', color2: '#2e4bff', tagline: 'Disney, Pixar, DreamWorks…' },
  { id: 'anime', name: 'Anime', emoji: '🍥', color: '#ff5fc8', color2: '#7a1fff', tagline: 'Poder de la amistad' },
  { id: 'movies', name: 'Personajes de cine', emoji: '🎬', color: '#ffb547', color2: '#8a3b00', tagline: 'Luces, cámara, mentira' },
  { id: 'heroes', name: 'Héroes y villanos', emoji: '🦸', color: '#ff4b4b', color2: '#2d2dff', tagline: 'Con gran poder…' },
  { id: 'games', name: 'Videojuegos', emoji: '🎮', color: '#7c5cff', color2: '#00d0ff', tagline: 'Press start' },
  { id: 'series', name: 'Series', emoji: '🍿', color: '#ff8a3d', color2: '#b0003a', tagline: 'Un capítulo más' },
  { id: 'famous', name: 'Famosos y streamers', emoji: '⭐', color: '#ffe066', color2: '#d4006e', tagline: 'Todos los conocen' },
  { id: 'objects', name: 'Objetos', emoji: '🧸', color: '#9ae6b4', color2: '#2f855a', tagline: 'Lo que tienes en casa' },
  { id: 'food', name: 'Comida', emoji: '🍕', color: '#ffa94d', color2: '#d9480f', tagline: 'Da hambre solo de verlo' },
  { id: 'animals', name: 'Animales', emoji: '🦊', color: '#8ce99a', color2: '#1971c2', tagline: 'Reino animal' },
];

/** Categoría con las cartas que crean los jugadores ("Mis cartas"). */
export const CUSTOM_CAT: Category = {
  id: 'custom',
  name: 'Mis cartas',
  emoji: '✍️',
  color: '#ff9ad5',
  color2: '#7a1fff',
  tagline: 'Hechas por ustedes',
};

export const CAT: Record<CategoryId, Category> = Object.fromEntries([...CATEGORIES, CUSTOM_CAT].map((c) => [c.id, c])) as Record<
  CategoryId,
  Category
>;

export const HORROR_CATS: CategoryId[] = CATEGORIES.filter((c) => c.horror).map((c) => c.id);
