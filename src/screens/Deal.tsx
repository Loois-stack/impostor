import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { CardFront, type CardRole } from '../components/GameCard';
import { HoldToReveal } from '../components/HoldToReveal';
import { Avatar, Button } from '../components/ui';
import { BY_ID } from '../data';
import { CAT } from '../data/categories';
import type { Item } from '../data/types';
import { useGame, type Round } from '../store/game';

export function cardFor(round: Round, playerId: string): { item: Item | null; role: CardRole } {
  const civil = BY_ID[round.civil];
  if (!round.impostors.includes(playerId)) return { item: civil, role: 'civil' };
  const decoy = round.decoy ? BY_ID[round.decoy] : null;
  if (round.event === 'blind') return { item: decoy, role: 'civil' };
  if (!decoy) return { item: null, role: 'imp-classic' };
  return { item: decoy, role: 'imp' };
}

export function Deal() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const dealNext = useGame((s) => s.dealNext);
  const [phase, setPhase] = useState<'pass' | 'card'>('pass');
  const [seen, setSeen] = useState(false);
  const player = players[round.dealIdx];
  if (!player) return null;
  const { item, role } = cardFor(round, player.id);
  const last = round.dealIdx === players.length - 1;
  const cat = CAT[round.cat];

  const next = () => {
    sfx.whoosh();
    haptic(15);
    setSeen(false);
    setPhase('pass');
    dealNext();
  };

  return (
    <div className="screen">
      <div className="row content" style={{ justifyContent: 'center', gap: 6, marginBottom: 8 }}>
        {players.map((p, i) => (
          <motion.div
            key={p.id}
            animate={{
              width: i === round.dealIdx ? 26 : 8,
              background: i < round.dealIdx ? cat.color : i === round.dealIdx ? '#fff' : 'rgba(255,255,255,.2)',
            }}
            style={{ height: 8, borderRadius: 8 }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {phase === 'pass' ? (
          <motion.div
            key={`pass-${round.dealIdx}`}
            className="grow center content"
            style={{ gap: 18 }}
            initial={{ x: 120, opacity: 0, rotate: 6 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            exit={{ x: -120, opacity: 0, rotate: -6 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <div className="label">Pasa el teléfono a</div>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 14 }}>
              <Avatar player={player} size={120} />
            </motion.div>
            <div className="h1" style={{ color: player.color, textShadow: `0 0 30px ${player.color}88` }}>
              {player.name}
            </div>
            <div className="dim" style={{ maxWidth: 300, lineHeight: 1.45 }}>
              Que nadie más vea la pantalla. 🤫
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`card-${round.dealIdx}`}
            className="grow center content"
            style={{ gap: 14 }}
            initial={{ y: 80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -300, opacity: 0, rotate: -12, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          >
            <div className="row" style={{ gap: 8 }}>
              <Avatar player={player} size={30} />
              <b>{player.name}</b>
              <span className="dim">· tu carta secreta</span>
            </div>
            <HoldToReveal
              front={<CardFront item={item} cat={round.cat} role={role} />}
              onSeen={() => setSeen(true)}
              hint="Mantén presionado para ver"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="content" style={{ paddingTop: 12 }}>
        {phase === 'pass' ? (
          <Button
            onClick={() => {
              sfx.flip();
              setPhase('card');
            }}
          >
            Soy {player.name} 👀
          </Button>
        ) : (
          <Button disabled={!seen} onClick={next} variant={last ? 'primary' : 'plain'}>
            {!seen ? 'Primero mira tu carta' : last ? '¡Todos listos! 🔥' : 'Listo, pasar ➜'}
          </Button>
        )}
      </div>
    </div>
  );
}
