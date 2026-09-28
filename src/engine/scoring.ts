import type { EventId } from './events';

export interface RoundOutcome {
  players: string[];
  impostors: string[];
  accused: string[];
  nobodyVote: boolean;
  /** impostor atrapado -> ¿adivinó la palabra de los civiles? */
  guessed: Record<string, boolean>;
  /** jugador -> ¿cumplió su reto? */
  challenges: Record<string, boolean>;
  /** jugadores que dijeron la palabra maldita */
  cursed: string[];
  event?: EventId;
}

export type Winner = 'civ' | 'imp' | 'partial' | 'nobody-found' | 'nobody-missed';

export interface ScoreLine {
  player: string;
  base: number;
  bonus: number;
  reasons: string[];
}

export const PTS = {
  civCatchAll: 100,
  civCatchSome: 50,
  impSurvive: 250,
  impSurviveBlind: 300,
  impGuess: 150,
  impNobodyVote: 300,
  nobodyFound: 150,
  challengeDone: 50,
  challengeFail: -25,
  cursed: -50,
};

/** Puntos "base" (los que cuentan para la racha) y bonus (retos, penalizaciones). */
export function scoreRound(o: RoundOutcome): { winner: Winner; lines: ScoreLine[] } {
  const lines: Record<string, ScoreLine> = Object.fromEntries(
    o.players.map((p) => [p, { player: p, base: 0, bonus: 0, reasons: [] as string[] }]),
  );
  let winner: Winner;

  if (!o.impostors.length) {
    winner = o.nobodyVote ? 'nobody-found' : 'nobody-missed';
    if (o.nobodyVote)
      for (const p of o.players) {
        lines[p].base += PTS.nobodyFound;
        lines[p].reasons.push('Descubrieron que no había impostor');
      }
  } else {
    const caught = o.impostors.filter((i) => o.accused.includes(i));
    winner = caught.length === o.impostors.length ? 'civ' : caught.length ? 'partial' : 'imp';
    for (const p of o.players) {
      if (o.impostors.includes(p)) {
        if (o.nobodyVote) {
          lines[p].base += PTS.impNobodyVote;
          lines[p].reasons.push('Los convenció de que no había impostor');
        } else if (!caught.includes(p)) {
          const pts = o.event === 'blind' ? PTS.impSurviveBlind : PTS.impSurvive;
          lines[p].base += pts;
          lines[p].reasons.push(o.event === 'blind' ? 'Sobrevivió sin saber que era impostor' : 'Sobrevivió como impostor');
        } else if (o.guessed[p]) {
          lines[p].base += PTS.impGuess;
          lines[p].reasons.push('Atrapado, pero adivinó la carta');
        }
      } else if (caught.length === o.impostors.length) {
        lines[p].base += PTS.civCatchAll;
        lines[p].reasons.push('Atraparon al impostor');
      } else if (caught.length) {
        lines[p].base += PTS.civCatchSome;
        lines[p].reasons.push('Atraparon a un impostor');
      }
    }
  }

  for (const [p, done] of Object.entries(o.challenges)) {
    if (!lines[p]) continue;
    lines[p].bonus += done ? PTS.challengeDone : PTS.challengeFail;
    lines[p].reasons.push(done ? 'Cumplió su reto' : 'Falló su reto');
  }
  for (const p of o.cursed) {
    if (!lines[p]) continue;
    lines[p].bonus += PTS.cursed;
    lines[p].reasons.push('Dijo la palabra maldita');
  }
  return { winner, lines: Object.values(lines) };
}

/** Racha: rondas seguidas ganando puntos base. x1, x1.25, x1.5 … hasta x2. */
export const streakMult = (streak: number) => Math.min(2, 1 + 0.25 * Math.max(0, streak - 1));

export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(xp / 60)) + 1;
export const xpForLevel = (lvl: number) => (lvl - 1) ** 2 * 60;
