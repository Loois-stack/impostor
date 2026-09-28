import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { CHALLENGES, KIND_META } from '../data/challenges';
import { burst, flash, shake } from '../fx/fx';
import type { Player } from '../store/game';
import { Avatar, Button, Glitch } from './ui';

/** Carta de reto que irrumpe en pantalla. Los retos secretos solo se ven manteniendo presionado. */
export function ChallengeOverlay({ player, challengeId, onAccept }: { player: Player; challengeId: string; onAccept: () => void }) {
  const ch = CHALLENGES.find((c) => c.id === challengeId)!;
  const meta = KIND_META[ch.kind];
  const [peek, setPeek] = useState(false);
  const [peeked, setPeeked] = useState(!ch.secret);
  const holdTimer = useRef(0);

  useEffect(() => {
    sfx.challenge();
    haptic([50, 30, 50, 30, 100]);
    flash(ch.secret ? '#ff2e4d' : meta.color, 500, 0.5);
    shake(14, 550);
    setTimeout(() => burst({ kind: 'shards', colors: [meta.color, '#fff'], count: 40 }), 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const secretText = ch.text.replace(/^SECRETO:\s*/, '');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgba(5,3,10,.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px calc(var(--safe-b) + 16px)',
        gap: 18,
      }}
    >
      <motion.div
        initial={{ scale: 3, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: -3 }}
        transition={{ type: 'spring', stiffness: 300, damping: 14 }}
        className="h1"
        style={{ color: meta.color, textShadow: `0 0 30px ${meta.color}` }}
      >
        <Glitch text="¡RETO!" hard />
      </motion.div>

      <motion.div
        initial={{ y: 200, rotateX: 60, opacity: 0 }}
        animate={{ y: 0, rotateX: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 18 }}
        style={{
          width: '100%',
          maxWidth: 360,
          borderRadius: 26,
          padding: 22,
          background: `linear-gradient(160deg, ${meta.color}44, #120e1c 70%)`,
          border: `2px solid ${meta.color}`,
          boxShadow: `0 30px 80px rgba(0,0,0,.6), 0 0 50px ${meta.color}55`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          alignItems: 'center',
          textAlign: 'center',
          perspective: 800,
        }}
      >
        <div className="row">
          <Avatar player={player} size={38} />
          <b style={{ fontSize: 18 }}>{player.name}</b>
        </div>
        <div className="label" style={{ color: meta.color }}>
          {meta.emoji} {meta.label} {ch.round ? '· toda la ronda' : '· este turno'}
        </div>

        {ch.secret ? (
          <div
            onPointerDown={() => {
              holdTimer.current = window.setTimeout(() => {
                setPeek(true);
                setPeeked(true);
                haptic(20);
              }, 250);
            }}
            onPointerUp={() => {
              clearTimeout(holdTimer.current);
              setPeek(false);
            }}
            onPointerCancel={() => setPeek(false)}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              width: '100%',
              minHeight: 130,
              borderRadius: 18,
              background: 'rgba(0,0,0,.45)',
              border: '1px dashed rgba(255,255,255,.3)',
              display: 'grid',
              placeItems: 'center',
              padding: 14,
              touchAction: 'none',
            }}
          >
            {peek ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ fontSize: 18, lineHeight: 1.4, fontWeight: 700 }}>
                {secretText}
              </motion.div>
            ) : (
              <div className="stack" style={{ alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 40 }}>🤫</div>
                <b>Reto secreto</b>
                <span className="dim" style={{ fontSize: 13 }}>
                  Solo {player.name}: mantén presionado para leerlo
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 21, lineHeight: 1.35, fontWeight: 800 }}>{ch.text}</div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} style={{ width: '100%', maxWidth: 360 }}>
        <Button disabled={!peeked} onClick={onAccept} style={{ '--accent': meta.color } as React.CSSProperties}>
          {peeked ? 'Acepto el reto 😤' : 'Léelo primero'}
        </Button>
      </motion.div>
    </motion.div>
  );
}
