import { motion } from 'framer-motion';
import { useEffect, type CSSProperties } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { CH_BY_ID, KIND_META } from '../data/challenges';
import { PTS } from '../engine/scoring';
import { burst, flash, shake } from '../fx/fx';
import type { Player } from '../store/game';
import { Avatar, Button, Glitch, Overlay } from './ui';

/**
 * Aviso de evento especial: irrumpe cuando a un jugador le toca uno, para que toda la mesa
 * sepa a quién le cayó y qué tiene que hacer.
 */
export function EventOverlay({
  player,
  challengeId,
  onAccept,
  canAccept = true,
  mine,
}: {
  player: Player;
  challengeId: string;
  onAccept: () => void;
  /** En sala, solo el jugador (o el anfitrión) puede aceptarlo. */
  canAccept?: boolean;
  /** Es mi evento (sala). */
  mine?: boolean;
}) {
  const ch = CH_BY_ID[challengeId];
  const meta = KIND_META[ch.kind];

  useEffect(() => {
    sfx.challenge();
    haptic([50, 30, 50, 30, 100]);
    flash(meta.color, 500, 0.5);
    shake(14, 550);
    const t = setTimeout(() => burst({ kind: 'shards', colors: [meta.color, '#fff'], count: 40 }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Overlay>
      <motion.div
        initial={{ scale: 3, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: -3 }}
        transition={{ type: 'spring', stiffness: 300, damping: 14 }}
        className="h1"
        style={{ color: meta.color, textShadow: `0 0 30px ${meta.color}`, fontSize: 'clamp(38px, 12vw, 58px)' }}
      >
        <Glitch text="¡EVENTO ESPECIAL!" hard />
      </motion.div>

      <motion.div
        initial={{ y: 200, rotateX: 60, opacity: 0 }}
        animate={{ y: 0, rotateX: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 18 }}
        className="turn-event big"
        style={{ '--ev': meta.color } as CSSProperties}
      >
        <div className="center" style={{ gap: 6 }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.45, type: 'spring', stiffness: 320, damping: 12 }}>
            <Avatar player={player} size={64} />
          </motion.div>
          <div className="label" style={{ color: '#fff' }}>
            Le tocó a
          </div>
          <div className="display" style={{ fontSize: 36, color: player.color }}>
            {mine ? '¡A TI!' : player.name}
          </div>
        </div>
        <div className="label" style={{ color: meta.color }}>
          {meta.emoji} {meta.label}
        </div>
        <div style={{ fontSize: 21, lineHeight: 1.35, fontWeight: 800 }}>{ch.text}</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="tag">{ch.round ? '⏳ Dura toda la ronda' : '⏱️ Solo este turno: se quita al pasar'}</span>
          <span className="tag">
            +{PTS.challengeDone} si cumple · {PTS.challengeFail} si no
          </span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} style={{ width: '100%', maxWidth: 360 }}>
        {canAccept ? (
          <Button onClick={onAccept} style={{ '--accent': meta.color } as CSSProperties}>
            {mine ? '¡Va! Acepto 😤' : `¡Va, ${player.name}! 😤`}
          </Button>
        ) : (
          <div className="dim center" style={{ fontWeight: 700 }}>
            Esperando a que {player.name} acepte…
          </div>
        )}
      </motion.div>
    </Overlay>
  );
}
