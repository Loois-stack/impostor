import type { EventId } from './events';

export interface RoundOutcome {
  players: string[];
  impostors: string[];
  accused: string[];
  nobodyVote: boolean;
  /** impostor atrapado -> ¿adivinó la palabra de los civiles? */
  guessed: Record<string, boolean>;
  /** jugador -> ¿cumplió su evento de turno? */
  challenges: Record<string, boolean>;
  /** jugador -> ¿cumplió su misión secreta? */
  missions?: Record<string, boolean>;
  /** jugadores que dijeron la palabra maldita */
  cursed: string[];
  event?: EventId;
  /** Civil que juega del lado del impostor (evento "cómplice"). */
  accomplice?: string;
  /** Civil que gana si lo acusan (evento "bufón"). */
  jester?: string;
  /** Los impostores juegan en equipo: si sobrevive uno, ganan todos. */
  team?: boolean;
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
  /** Modo eliminación: cada inocente que echaron por error le resta esto al premio de los civiles. */
  civPerMistake: 25,
  civMin: 25,
  impSurvive: 250,
  impSurviveBlind: 300,
  impGuess: 150,
  impNobodyVote: 300,
  /** Modo equipo: impostor atrapado cuyo equipo sobrevivió. */
  impTeamWin: 100,
  /** Por cada inocente eliminado gracias al impostor (modo eliminación). */
  impPerInnocent: 50,
  nobodyFound: 150,
  accompliceWin: 200,
  jesterWin: 200,
  challengeDone: 50,
  challengeFail: -25,
  missionDone: 100,
  missionFail: -25,
  cursed: -50,
  /** Evento "ronda dorada": todo vale doble. */
  bountyMult: 2,
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
    const innocentsOut = o.accused.filter((a) => !o.impostors.includes(a)).length;
    winner = caught.length === o.impostors.length ? 'civ' : caught.length ? 'partial' : 'imp';
    for (const p of o.players) {
      if (p === o.accomplice) {
        if (o.nobodyVote || caught.length < o.impostors.length) {
          lines[p].base += PTS.accompliceWin;
          lines[p].reasons.push('Su impostor sobrevivió (cómplice)');
        }
      } else if (o.impostors.includes(p)) {
        if (o.nobodyVote) {
          lines[p].base += PTS.impNobodyVote;
          lines[p].reasons.push('Los convenció de que no había impostor');
        } else if (!caught.includes(p)) {
          const pts = o.event === 'blind' ? PTS.impSurviveBlind : PTS.impSurvive;
          lines[p].base += pts;
          lines[p].reasons.push(o.event === 'blind' ? 'Sobrevivió sin saber que era impostor' : 'Sobrevivió como impostor');
          if (innocentsOut) {
            lines[p].base += PTS.impPerInnocent * innocentsOut;
            lines[p].reasons.push(`Hizo caer a ${innocentsOut} inocente${innocentsOut > 1 ? 's' : ''}`);
          }
        } else {
          if (o.team && caught.length < o.impostors.length) {
            lines[p].base += PTS.impTeamWin;
            lines[p].reasons.push('Cayó, pero su equipo sobrevivió');
          }
          if (o.guessed[p]) {
            lines[p].base += PTS.impGuess;
            lines[p].reasons.push('Atrapado, pero adivinó la carta');
          }
        }
      } else if (caught.length === o.impostors.length) {
        const mistakes = innocentsOut - (o.jester && o.accused.includes(o.jester) ? 1 : 0);
        lines[p].base += Math.max(PTS.civMin, PTS.civCatchAll - PTS.civPerMistake * mistakes);
        lines[p].reasons.push(mistakes ? `Atraparon al impostor (tras ${mistakes} error${mistakes > 1 ? 'es' : ''})` : 'Atraparon al impostor');
      } else if (caught.length) {
        // Premio parcial proporcional a los impostores atrapados (de 5 en 5).
        lines[p].base += Math.round((PTS.civCatchAll * caught.length) / o.impostors.length / 5) * 5;
        lines[p].reasons.push(`Atraparon ${caught.length} de ${o.impostors.length} impostores`);
      }
    }
  }

  if (o.jester && lines[o.jester] && o.accused.includes(o.jester)) {
    lines[o.jester].base += PTS.jesterWin;
    lines[o.jester].reasons.push('Logró que lo acusaran (bufón)');
  }

  for (const [p, done] of Object.entries(o.challenges)) {
    if (!lines[p]) continue;
    lines[p].bonus += done ? PTS.challengeDone : PTS.challengeFail;
    lines[p].reasons.push(done ? 'Cumplió su evento' : 'Falló su evento');
  }
  for (const [p, done] of Object.entries(o.missions ?? {})) {
    if (!lines[p]) continue;
    lines[p].bonus += done ? PTS.missionDone : PTS.missionFail;
    lines[p].reasons.push(done ? 'Cumplió su misión secreta' : 'Falló su misión secreta');
  }
  for (const p of o.cursed) {
    if (!lines[p]) continue;
    lines[p].bonus += PTS.cursed;
    lines[p].reasons.push('Dijo la palabra maldita');
  }
  if (o.event === 'bounty')
    for (const l of Object.values(lines)) {
      if (!l.base && !l.bonus) continue;
      l.base *= PTS.bountyMult;
      l.bonus *= PTS.bountyMult;
      l.reasons.push('Ronda dorada x2');
    }
  return { winner, lines: Object.values(lines) };
}

/** Racha: rondas seguidas ganando puntos base. x1, x1.25, x1.5 … hasta x2. */
export const streakMult = (streak: number) => Math.min(2, 1 + 0.25 * Math.max(0, streak - 1));

export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(xp / 60)) + 1;
export const xpForLevel = (lvl: number) => (lvl - 1) ** 2 * 60;
