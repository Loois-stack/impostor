import { motion, useAnimationControls } from 'framer-motion';
import { useRef, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { Avatar, Glitch } from '../components/ui';
import { shake } from '../fx/fx';
import { useGame } from '../store/game';

const HOLD_MS = 1100;

export function Vote() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const settings = useGame((s) => s.settings);
  const vote = useGame((s) => s.vote);
  const need = round.event === 'double' ? 2 : Math.min(settings.impostors, Math.max(1, players.length - 2));
  const [sel, setSel] = useState<string[]>([]);
  const [nobody, setNobody] = useState(false);
  const fill = useAnimationControls();
  const timer = useRef(0);
  const beat = useRef(0);
  const ready = nobody || sel.length === need;

  const pick = (id: string) => {
    sfx.select();
    haptic(12);
    setNobody(false);
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : need === 1 ? [id] : s.length >= need ? [...s.slice(1), id] : [...s, id]));
  };

  const holdStart = () => {
    if (!ready) return;
    haptic(10);
    void fill.start({ scaleX: 1, transition: { duration: HOLD_MS / 1000, ease: 'linear' } });
    sfx.heartbeat();
    beat.current = window.setInterval(() => sfx.heartbeat(), 500);
    timer.current = window.setTimeout(() => {
      clearInterval(beat.current);
      shake(16, 500);
      haptic([80, 40, 120]);
      vote(nobody ? [] : sel, nobody);
    }, HOLD_MS);
  };
  const holdEnd = () => {
    clearTimeout(timer.current);
    clearInterval(beat.current);
    fill.stop();
    void fill.start({ scaleX: 0, transition: { duration: 0.25 } });
  };

  return (
    <div className="screen">
      <div className="center content" style={{ gap: 6, marginBottom: 14 }}>
        <div className="label">Ronda {round.n} · Votación</div>
        <div className="h1" style={{ fontSize: 'clamp(40px, 12vw, 58px)' }}>
          <Glitch text="¿Quién miente?" hard />
        </div>
        <div className="dim" style={{ fontSize: 14 }}>
          Discutan y elijan juntos {need === 1 ? 'a 1 sospechoso' : `a ${need} sospechosos`}.
        </div>
      </div>

      <div className="scroll content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {players.map((p, i) => {
            const on = sel.includes(p.id);
            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, scale: 0.6, rotate: (i % 2 ? 1 : -1) * 8 }}
                animate={{ opacity: 1, scale: on ? 1.04 : 1, rotate: 0 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 350, damping: 20 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => pick(p.id)}
                className="panel center"
                style={{
                  gap: 8,
                  padding: '16px 10px',
                  position: 'relative',
                  borderColor: on ? '#ff2e4d' : undefined,
                  background: on ? 'radial-gradient(circle at 50% 30%, rgba(255,46,77,.35), rgba(255,46,77,.08))' : undefined,
                  boxShadow: on ? '0 0 30px rgba(255,46,77,.45), inset 0 0 0 1px #ff2e4d' : undefined,
                }}
              >
                <Avatar player={p} size={62} />
                <b style={{ fontSize: 16 }}>{p.name}</b>
                {on && (
                  <motion.div
                    initial={{ scale: 3, opacity: 0, rotate: -30 }}
                    animate={{ scale: 1, opacity: 1, rotate: -12 }}
                    style={{ position: 'absolute', top: 8, right: 8, fontSize: 26 }}
                  >
                    🎯
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            sfx.select();
            setNobody((n) => !n);
            setSel([]);
          }}
          className="panel row"
          style={{
            width: '100%',
            marginTop: 10,
            padding: 14,
            justifyContent: 'center',
            borderColor: nobody ? '#fff' : undefined,
            background: nobody ? 'rgba(255,255,255,.14)' : undefined,
            fontWeight: 800,
          }}
        >
          🫥 Creemos que NO hay impostor
        </motion.button>
      </div>

      <div className="content" style={{ paddingTop: 12 }}>
        <div
          onPointerDown={holdStart}
          onPointerUp={holdEnd}
          onPointerLeave={holdEnd}
          onPointerCancel={holdEnd}
          onContextMenu={(e) => e.preventDefault()}
          className="btn danger"
          style={{ opacity: ready ? 1 : 0.35, touchAction: 'none', userSelect: 'none' }}
        >
          <motion.div
            initial={{ scaleX: 0 }}
            animate={fill}
            style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.35)', transformOrigin: 'left' }}
          />
          <span style={{ position: 'relative' }}>{ready ? '✊ Mantén para acusar' : `Elijan ${need - sel.length} más`}</span>
        </div>
      </div>
    </div>
  );
}
