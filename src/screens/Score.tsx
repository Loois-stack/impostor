import { AnimatePresence, animate, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { Avatar, Button, Glitch } from '../components/ui';
import { ACHIEVEMENTS } from '../engine/achievements';
import { levelFromXp, xpForLevel } from '../engine/scoring';
import { burst } from '../fx/fx';
import { useGame } from '../store/game';

const WIN_TXT = {
  civ: { t: '¡Ganan los civiles!', e: '🛡️', c: '#2ee6ff' },
  partial: { t: '¡Victoria a medias!', e: '⚖️', c: '#ffd23d' },
  imp: { t: '¡Gana el impostor!', e: '🔪', c: '#ff2e4d' },
  'nobody-found': { t: '¡Nadie los engañó!', e: '🧠', c: '#39ff88' },
  'nobody-missed': { t: '¡Los engañó el juego!', e: '🫥', c: '#7c5cff' },
} as const;

function CountUp({ to, delay }: { to: number; delay: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration: 1, delay, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [to, delay]);
  return <>{v}</>;
}

export function Score() {
  const round = useGame((s) => s.round);
  const { players, session, profiles, startRound, go, newSession } = useGame();
  const [toasts, setToasts] = useState<{ key: string; text: string; emoji: string }[]>([]);
  const result = round?.result;

  useEffect(() => {
    if (!result) return;
    const w = WIN_TXT[result.winner];
    (result.winner === 'imp' || result.winner === 'nobody-missed' ? sfx.impostor : sfx.fanfare).call(sfx);
    burst({ kind: 'confetti', colors: [w.c, '#fff', '#ffd23d'], count: 120, y: 120 });
    haptic([30, 30, 30, 30, 80]);
    const list = [
      ...result.levelUps.map((id) => {
        const p = players.find((x) => x.id === id);
        return { key: `lvl-${id}`, emoji: '⬆️', text: `${p?.name} subió a nivel ${levelFromXp(profiles[id]?.xp ?? 0)}` };
      }),
      ...result.newAch.map(({ player, ach }) => {
        const a = ACHIEVEMENTS.find((x) => x.id === ach)!;
        const p = players.find((x) => x.id === player);
        return { key: `ach-${player}-${ach}`, emoji: a.emoji, text: `${p?.name}: logro “${a.name}”` };
      }),
    ];
    const timers = list.map((t, i) =>
      setTimeout(() => {
        setToasts((s) => [...s, t]);
        sfx.levelUp();
        setTimeout(() => setToasts((s) => s.filter((x) => x.key !== t.key)), 2600);
      }, 1600 + i * 900),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!result) return null;
  const w = WIN_TXT[result.winner];
  const ranked = [...players].sort((a, b) => (session.scores[b.id] ?? 0) - (session.scores[a.id] ?? 0));

  return (
    <div className="screen">
      <div className="center content" style={{ gap: 4, marginBottom: 14 }}>
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }} style={{ fontSize: 60 }}>
          {w.e}
        </motion.div>
        <div className="h1" style={{ fontSize: 'clamp(38px, 11vw, 54px)', color: w.c, textShadow: `0 0 30px ${w.c}88` }}>
          <Glitch text={w.t} />
        </div>
        <div className="label">Ronda {round!.n} · Marcador</div>
      </div>

      <div className="scroll content">
        <motion.div layout className="stack" style={{ gap: 8 }}>
          {ranked.map((p, i) => {
            const line = result.lines.find((l) => l.player === p.id)!;
            const xp = profiles[p.id]?.xp ?? 0;
            const lvl = levelFromXp(xp);
            const prog = (xp - xpForLevel(lvl)) / (xpForLevel(lvl + 1) - xpForLevel(lvl));
            return (
              <motion.div
                layout
                key={p.id}
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.07, type: 'spring', stiffness: 300, damping: 26 }}
                className="panel"
                style={{
                  padding: '10px 12px',
                  borderColor: i === 0 ? '#ffd23d88' : undefined,
                  background: i === 0 ? 'linear-gradient(90deg, rgba(255,210,61,.14), rgba(255,255,255,.04))' : undefined,
                }}
              >
                <div className="row">
                  <div className="display" style={{ width: 26, fontSize: 26, color: i === 0 ? '#ffd23d' : 'var(--dim)' }}>
                    {i === 0 ? '👑' : i + 1}
                  </div>
                  <Avatar player={p} size={40} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <b style={{ fontSize: 16 }}>{p.name}</b>
                      {line.streak >= 2 && (
                        <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} style={{ fontSize: 12, fontWeight: 900, color: '#ff8a3d' }}>
                          🔥x{line.mult}
                        </motion.span>
                      )}
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,.1)', borderRadius: 4, marginTop: 4, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(3, prog * 100)}%` }}
                        transition={{ delay: 0.8 + i * 0.07, duration: 0.8 }}
                        style={{ height: '100%', background: p.color }}
                      />
                    </div>
                    <div className="dim" style={{ fontSize: 11, marginTop: 3 }}>
                      Nv {lvl} · {line.reasons.join(' · ') || 'Sin puntos esta ronda'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="display" style={{ fontSize: 28 }}>
                      <CountUp to={session.scores[p.id] ?? 0} delay={0.5 + i * 0.07} />
                    </div>
                    {line.total !== 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.5 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 1 + i * 0.1, type: 'spring' }}
                        style={{ fontSize: 12, fontWeight: 900, color: line.total > 0 ? '#39ff88' : '#ff2e4d' }}
                      >
                        {line.total > 0 ? '+' : ''}
                        {line.total}
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <div className="stack content" style={{ paddingTop: 12, gap: 8 }}>
        <Button
          onClick={() => {
            sfx.whoosh();
            startRound();
          }}
          style={{ minHeight: 66, fontSize: 32 }}
        >
          🔁 Otra ronda
        </Button>
        <div className="row" style={{ gap: 8 }}>
          <Button variant="ghost" small onClick={() => go('setup')}>
            ⚙️ Ajustes
          </Button>
          <Button variant="ghost" small onClick={() => go('players')}>
            👥 Jugadores
          </Button>
          <Button
            variant="ghost"
            small
            onClick={() => {
              newSession();
              go('home');
            }}
          >
            🏁 Terminar
          </Button>
        </div>
      </div>

      <div style={{ position: 'fixed', top: 'calc(var(--safe-t) + 12px)', left: 16, right: 16, zIndex: 45, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.key}
              initial={{ y: -80, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              className="panel row"
              style={{ padding: '10px 16px', background: 'linear-gradient(90deg, #3b2a00, #1b1430)', borderColor: '#ffd23d', boxShadow: '0 10px 40px rgba(255,210,61,.35)' }}
            >
              <span style={{ fontSize: 24 }}>{t.emoji}</span>
              <b style={{ fontSize: 14 }}>{t.text}</b>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
