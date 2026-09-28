export type CategoryId =
  | 'memes'
  | 'creepy'
  | 'scp'
  | 'horror'
  | 'cartoons'
  | 'animated'
  | 'anime'
  | 'movies'
  | 'heroes'
  | 'games'
  | 'series'
  | 'famous'
  | 'objects'
  | 'food'
  | 'animals'
  | 'custom';

/** 1 = casi idéntico (el impostor se camufla), 2 = parecido, 3 = relacionado lejano (tiene que jugársela). */
export type Level = 1 | 2 | 3;

export interface Category {
  id: CategoryId;
  name: string;
  emoji: string;
  color: string;
  color2: string;
  tagline: string;
  horror?: boolean;
}

export interface Item {
  id: string;
  name: string;
  cat: CategoryId;
  group: string;
  emoji: string;
  /** Título de Wikipedia. Prefijo "es:" para la Wikipedia en español; alternativas separadas por "|". Vacío = arte propio. */
  wiki: string;
  ctx: string;
  sim: { id: string; level: Level }[];
  /** Foto propia (data URL) de las cartas creadas por los jugadores. */
  img?: string;
}

/** [id, nombre, grupo, emoji, wiki, contexto, similares "id:nivel,id:nivel"] */
export type Row = [string, string, string, string, string, string, string?];

export function mk(cat: CategoryId, rows: Row[]): Item[] {
  return rows.map(([id, name, group, emoji, wiki, ctx, sim]) => ({
    id,
    name,
    cat,
    group: `${cat}.${group}`,
    emoji,
    wiki,
    ctx,
    sim: (sim ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [sid, lvl] = s.split(':');
        return { id: sid, level: (Number(lvl) || 2) as Level };
      }),
  }));
}
