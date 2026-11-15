import { BY_ID } from '../data';
import type { CardNote, CardRole } from '../components/GameCard';
import type { Item } from '../data/types';
import { EVENTS, MYSTERY, type EventId } from '../engine/events';
import type { Round } from './game';

/** Nota de rol especial que aparece en la carta de un jugador. */
export function noteFor(round: Round, playerId: string, nameOf: (id: string) => string): CardNote | undefined {
  if (round.team && round.impostors.includes(playerId)) {
    const mates = round.impostors.filter((id) => id !== playerId).map(nameOf);
    const list = mates.length > 1 ? `${mates.slice(0, -1).join(', ')} y ${mates[mates.length - 1]}` : mates[0];
    return { kind: 'team', text: `Tu equipo: ${list}. Tienen la misma carta que tú. Si sobrevive uno, ganan todos.` };
  }
  if (round.accomplice === playerId) {
    const names = round.impostors.map(nameOf).join(' y ');
    return { kind: 'accomplice', text: `El impostor es ${names}. Ayúdalo a sobrevivir sin que te descubran: si gana, tú también.` };
  }
  if (round.detective === playerId && round.detectiveKnows)
    return { kind: 'detective', text: `Sabes que ${nameOf(round.detectiveKnows)} es inocente. Úsalo con astucia.` };
  if (round.jester === playerId) return { kind: 'jester', text: 'Tu carta es la de los civiles, pero tú ganas si te acusan. Hazte el sospechoso… sin que se note.' };
  return undefined;
}

/** Carta y rol que ve un jugador al repartir. */
export function cardFor(round: Round, playerId: string): { item: Item | null; role: CardRole } {
  const civil = BY_ID[round.civil];
  if (!round.impostors.includes(playerId)) return { item: civil, role: 'civil' };
  const id = round.decoys?.[playerId] ?? round.decoy;
  const decoy = id ? BY_ID[id] : null;
  if (round.event === 'blind') return { item: decoy, role: 'civil' };
  if (!decoy) return { item: null, role: 'imp-classic' };
  return { item: decoy, role: 'imp' };
}

export interface ShownEvent {
  /** Indefinido cuando es un "evento secreto": no se sabe cuál es. */
  id?: EventId;
  title: string;
  emoji: string;
  color: string;
  desc: string;
  rule?: string;
}

/** Lo que la mesa sabe del evento de la ronda (los ocultos no se delatan). */
export function shownEvent(round: Round): ShownEvent | undefined {
  if (!round.event || round.hidden === 'silent') return undefined;
  if (round.hidden === 'mystery') return MYSTERY;
  return EVENTS[round.event];
}

/** El evento ya dejó de ser secreto (se usa al revelar la verdad). */
export const secretEvent = (round: Round) => (round.event && round.hidden ? EVENTS[round.event] : undefined);
