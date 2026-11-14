/** Voto por "no hay impostor". */
export const NOBODY = 'nobody';

export interface Tally {
  /** objetivo (id de jugador o NOBODY) -> votos */
  counts: Record<string, number>;
  accused: string[];
  nobody: boolean;
  /** Hubo empate en lo más alto y no se acusa a nadie. */
  tie: boolean;
}

/**
 * Cuenta los votos individuales. Se acusa a los `need` más votados; si hay empate en el
 * límite, nadie de los empatados cae (como en una votación real: sin mayoría no hay culpable).
 */
export function tally(votes: Record<string, string>, need = 1): Tally {
  const counts: Record<string, number> = {};
  for (const t of Object.values(votes)) counts[t] = (counts[t] ?? 0) + 1;
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { counts, accused: [], nobody: false, tie: true };

  const top = ranked[0][1];
  const leaders = ranked.filter(([, n]) => n === top).map(([id]) => id);
  if (leaders.includes(NOBODY)) {
    return leaders.length === 1 ? { counts, accused: [], nobody: true, tie: false } : { counts, accused: [], nobody: false, tie: true };
  }

  const people = ranked.filter(([id]) => id !== NOBODY);
  const want = Math.min(need, people.length);
  // Mayor k ≤ want en el que el corte no parte un empate.
  let k = want;
  while (k > 0 && k < people.length && people[k - 1][1] === people[k][1]) k--;
  return { counts, accused: people.slice(0, k).map(([id]) => id), nobody: false, tie: k === 0 };
}
