import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { Avatar, Button, Glitch } from '../components/ui';
import { burst, flash } from '../fx/fx';
import { leaveRoom } from '../net/net';
import { useSeat } from '../net/state';
import { useGame, type Player, type SessionStat } from '../store/game';

const SUPERLATIVES: { key: keyof SessionStat; emoji: string; title: string; unit: string }[] = [
  { key: 'impWins', emoji: '🦎', title: 'Mejor mentiroso', unit: 'sobrevivió como impostor' },
  { key: 'civWins', emoji: '🐕‍🦺', title: 'Sabueso', unit: 'atrapó al impostor' },
  { key: 'accused', emoji: '🎯', title: 'Siempre sospechoso', unit: 'fue acusado' },
  { key: 'challenges', emoji: '🎭', title: 'Alma de la fiesta', unit: 'eventos y misiones cumplidos' },
  { key: 'allyWins', emoji: '🤝', title: 'Traidor de confianza', unit: 'ganó como cómplice' },
  { key: 'cursed', emoji: '☠️', title: 'Boca floja', unit: 'dijo la palabra maldita' },
];

/** Orden visual izquierda → derecha: 2.º, 1.º, 3.º (place 0 = primer lugar). */
const PODIUM = [
  { place: 1, h: 110, color: '#d6d6e6', medal: '🥈' },
  { place: 0, h: 150, color: '#ffd23d', medal: '🥇' },
  { place: 2, h: 80, color: '#e0915a', medal: '🥉' },
];

export function Awards() {
  const { players, session, startRound, newSession, go } = useGame();
  const { online, host } = useSeat();
  const ranked = [...players].sort((a, b) => (session.scores[b.id] ?? 0) - (session.scores[a.id] ?? 0));
  const top = [ranked[1], ranked[0], ranked[2]];

  const awards = SUPERLATIVES.map((s) => {
    const best = Math.max(0, ...players.map((p) => session.stats[p.id]?.[s.key] ?? 0));
    const winners = best > 0 ? players.filter((p) => (session.stats[p.id]?.[s.key] ?? 0) === best) : [];
    return { ...s, best, winners };
  }).filter((a) => a.winners.length);

  useEffect(() => {
    sfx.drumroll(1.4);
    const t1 = setTimeout(() => {
      sfx.fanfare();
      flash('#ffd23d', 600, 0.4);
      burst({ kind: 'confetti', count: 160, colors: ['#ffd23d', '#fff', '#ff5fc8', '#2ee6ff'], y: window.innerHeight * 0.4 });
      haptic([40, 40, 40, 40, 200]);
    }, 1500);
    const t2 = awards.map((_, i) => setTimeout(() => sfx.coin(), 2400 + i * 350));
    return () => {
      clearTimeout(t1);
      t2.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen" style={{ '--accent': '#ffb547' } as React.CSSProperties}>
      <div className="center content" style={{ gap: 4, marginBottom: 8 }}>
        <div className="label">Después de {session.round} rondas…</div>
        <div className="h1" style={{ fontSize: 'clamp(40px, 12vw, 58px)', color: '#ffd23d', textShadow: '0 0 30px #ffd23d88' }}>
          <Glitch text="Premios de la noche" />
        </div>
      </div>

      <div className="scroll content">
        <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          {PODIUM.map(({ place, h, color, medal }, i) => {
            const p: Player | undefined = top[i];
            if (!p) return <div key={i} style={{ width: 96 }} />;
            return (
              <div key={p.id} className="center" style={{ width: 100, gap: 6 }}>
                <motion.div
                  initial={{ opacity: 0, y: -40, scale: 0.4 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 1.5 + (2 - place) * 0.25, type: 'spring', stiffness: 300, damping: 14 }}
                  className="center"
                  style={{ gap: 4 }}
                >
                  {place === 0 && (
                    <motion.div animate={{ rotate: [-8, 8, -8] }} transition={{ repeat: Infinity, duration: 2 }} style={{ fontSize: 30 }}>
                      👑
                    </motion.div>
                  )}
                  <Avatar player={p} size={place === 0 ? 70 : 56} />
                  <b style={{ fontSize: 14, maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</b>
                  <span className="display" style={{ fontSize: 22, color }}>
                    {session.scores[p.id] ?? 0}
                  </span>
                </motion.div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: h }}
                  transition={{ delay: 0.3 + (2 - place) * 0.2, type: 'spring', stiffness: 120, damping: 16 }}
                  style={{
                    width: '100%',
                    borderRadius: '14px 14px 4px 4px',
                    background: `linear-gradient(180deg, ${color}, ${color}33)`,
                    boxShadow: `0 0 30px ${color}55`,
                    display: 'grid',
                    placeItems: 'start center',
                    paddingTop: 8,
                    fontSize: 28,
                  }}
                >
                  {medal}
                </motion.div>
              </div>
            );
          })}
        </div>

        <div className="stack" style={{ gap: 8, marginTop: 18 }}>
          {awards.map((a, i) => (
            <motion.div
              key={a.key}
              initial={{ opacity: 0, rotateX: 90, y: 20 }}
              animate={{ opacity: 1, rotateX: 0, y: 0 }}
              transition={{ delay: 2.4 + i * 0.35, type: 'spring', stiffness: 220, damping: 18 }}
              className="panel row"
              style={{ padding: '12px 14px', gap: 12 }}
            >
              <div style={{ fontSize: 34 }}>{a.emoji}</div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="display" style={{ fontSize: 22 }}>
                  {a.title}
                </div>
                <div className="dim" style={{ fontSize: 12 }}>
                  {a.best}× · {a.unit}
                </div>
              </div>
              <div className="row" style={{ gap: 4 }}>
                {a.winners.slice(0, 3).map((p) => (
                  <Avatar key={p.id} player={p} size={34} />
                ))}
                <b style={{ fontSize: 14 }}>{a.winners.length === 1 ? a.winners[0].name : 'Empate'}</b>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="stack content" style={{ paddingTop: 12, gap: 8 }}>
        {host ? (
          <>
            <Button onClick={() => startRound()}>🔁 Seguir jugando</Button>
            <Button
              variant="ghost"
              small
              onClick={() => {
                newSession();
                go(online ? 'lobby' : 'home');
              }}
            >
              🏁 Terminar la noche
            </Button>
          </>
        ) : (
          <Button variant="ghost" small onClick={() => void leaveRoom()}>
            🚪 Salir de la sala
          </Button>
        )}
      </div>
    </div>
  );
}
