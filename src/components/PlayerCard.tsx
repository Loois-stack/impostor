import { THEME_BY_ID } from '../data/themes';
import { useGame } from '../store/game';
import { cardFor, noteFor } from '../store/view';
import { CardFront } from './GameCard';
import { HoldToReveal } from './HoldToReveal';

/** La carta secreta de un jugador: se ve solo mientras se mantiene presionada. */
export function PlayerCard({ playerId, onSeen, hint }: { playerId: string; onSeen?: () => void; hint?: string }) {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const { item, role } = cardFor(round, playerId);
  const note = noteFor(round, playerId, (id) => players.find((p) => p.id === id)?.name ?? '?');
  const theme = round.theme ? THEME_BY_ID[round.theme] : undefined;
  return (
    <HoldToReveal
      front={
        <CardFront
          item={item}
          // Sin carta (modo clásico) en Mezcla no se muestra la categoría real: delataría la carta civil.
          cat={item?.cat ?? (theme ? 'custom' : round.cat)}
          role={role}
          note={note}
          topic={theme?.name}
          mission={round.missions[playerId]}
        />
      }
      onSeen={onSeen}
      hint={hint ?? 'Mantén presionado para ver'}
    />
  );
}
