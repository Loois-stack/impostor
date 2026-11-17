import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { useSeat } from '../net/state';
import { useVoice } from '../net/voice';
import { IN_ROUND, useGame } from '../store/game';
import { Avatar } from './ui';

/**
 * Sala: ¿este teléfono solo está mirando la ronda? `waiting` si entró con la ronda empezada (juega
 * en la siguiente) y `out` si a todos los de este teléfono ya los eliminaron.
 */
export function useSpectator(): 'waiting' | 'out' | null {
  const round = useGame((s) => s.round);
  const { online, seats } = useSeat();
  if (!online || !round || round.result) return null;
  const inRound = seats.filter((id) => round.order.includes(id));
  if (!inRound.length) return 'waiting';
  const left = round.left ?? [];
  return inRound.every((id) => round.accused.includes(id) || left.includes(id)) ? 'out' : null;
}

const TEXT = {
  waiting: { emoji: '👀', title: 'Modo espectador', sub: 'Entraste con la ronda empezada: juegas en la siguiente.' },
  out: { emoji: '💀', title: 'Te eliminaron · modo espectador', sub: 'Sigue mirando la partida hasta que termine.' },
};

/** Aviso para quien solo está mirando (puede hablar por la llamada y reaccionar). */
export function SpectatorCard({ kind }: { kind: 'waiting' | 'out' }) {
  const joined = useVoice((s) => s.joined);
  const t = TEXT[kind];
  return (
    <motion.div className={`spectator ${kind}`} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <span style={{ fontSize: 26 }}>{t.emoji}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <b>{t.title}</b>
        <small>
          {t.sub} {joined ? 'Estás en la llamada: puedes opinar.' : 'Puedes hablar con la llamada 📞 y reaccionar.'}
        </small>
      </div>
    </motion.div>
  );
}

interface Notice {
  key: string;
  id: string;
  name: string;
}

/** Sala: aviso para todos cuando alguien entra con la ronda empezada (mira y juega en la siguiente). */
export function JoinNotice() {
  const players = useGame((s) => s.players);
  const round = useGame((s) => s.round);
  const screen = useGame((s) => s.screen);
  const online = useGame((s) => s.online);
  const prev = useRef<string[] | null>(null);
  const [notes, setNotes] = useState<Notice[]>([]);

  useEffect(() => {
    const ids = players.map((p) => p.id);
    const before = prev.current;
    prev.current = ids;
    // La primera vez (o al entrar a la sala) no se avisa de quienes ya estaban.
    if (!before || !before.length || !online) return;
    const playing = round && !round.result && IN_ROUND.includes(screen);
    if (!playing) return;
    const fresh = players.filter((p) => !before.includes(p.id) && !round.order.includes(p.id));
    if (!fresh.length) return;
    sfx.coin();
    haptic([20, 40, 20]);
    const add = fresh.map((p) => ({ key: `${p.id}-${Date.now()}`, id: p.id, name: p.name }));
    setNotes((n) => [...n, ...add]);
    for (const a of add) setTimeout(() => setNotes((n) => n.filter((x) => x.key !== a.key)), 4200);
  }, [players, round, screen, online]);

  return (
    <div className="join-notes">
      <AnimatePresence>
        {notes.map((n) => {
          const p = players.find((x) => x.id === n.id);
          return (
            <motion.div
              key={n.key}
              className="join-note"
              initial={{ y: -40, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              {p ? <Avatar player={p} size={30} still /> : <span>👋</span>}
              <div className="grow" style={{ minWidth: 0 }}>
                <b>👋 {n.name} quiere jugar</b>
                <small>Mira como espectador y entra en la siguiente ronda.</small>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
