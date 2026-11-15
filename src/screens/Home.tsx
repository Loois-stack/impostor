import { motion } from 'framer-motion';
import { Emo } from '../components/Emo';
import { useEffect, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { CardBack } from '../components/GameCard';
import { Button, Glitch, IconButton, stagger } from '../components/ui';
import { CATEGORIES } from '../data/categories';
import { CHALLENGES } from '../data/challenges';
import { ITEMS } from '../data';
import { EVENT_LIST } from '../engine/events';
import { burst, flash } from '../fx/fx';
import { invite } from '../net/net';
import { resumeScreen, useGame } from '../store/game';

const FAN = [
  { r: -16, x: -70, y: 14, d: 0 },
  { r: 0, x: 0, y: 0, d: 0.1 },
  { r: 16, x: 70, y: 14, d: 0.2 },
];

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function Home() {
  const go = useGame((s) => s.go);
  const round = useGame((s) => s.round);
  const connected = useOnline();
  const canResume = round && !round.result;

  // Si la app se abrió desde un enlace de invitación, va directo a entrar a la sala.
  useEffect(() => {
    if (invite) go('online');
  }, [go]);

  const logoTap = (e: React.MouseEvent) => {
    sfx.impostor();
    haptic([30, 30, 60]);
    flash('#ff2e4d', 350, 0.35);
    burst({ x: e.clientX, y: e.clientY, kind: 'sparks', colors: ['#ff2e4d', '#fff', '#ff7a90'], count: 40 });
  };

  return (
    <div className="screen">
      <div className="topbar content">
        {!connected && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="chip" title="El modo de un teléfono funciona sin internet">
            ✈️ <b>Sin conexión</b> <span className="dim">· puedes jugar igual</span>
          </motion.div>
        )}
        <div className="grow" />
        <IconButton label="Cómo jugar" onClick={() => go('howto')}>
          ?
        </IconButton>
        <IconButton label="Ajustes" onClick={() => go('settings')}>
          ⚙️
        </IconButton>
      </div>

      <div className="grow center content" style={{ gap: 16, minHeight: 0 }}>
        <div style={{ position: 'relative', height: 'min(200px, 26dvh)', aspectRatio: '1.4', flexShrink: 0 }}>
          {FAN.map((f, i) => (
            <motion.div
              key={i}
              initial={{ y: 200, rotate: 0, opacity: 0 }}
              animate={{ y: f.y, x: f.x, rotate: f.r, opacity: 1 }}
              transition={{ delay: 0.15 + f.d, type: 'spring', stiffness: 160, damping: 16 }}
              style={{ position: 'absolute', left: '50%', top: 0, height: '78%', aspectRatio: '5 / 7', marginLeft: '-19.9%' }}
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
                className="mini-back"
                style={{ position: 'absolute', inset: 0, borderRadius: 14 }}
              >
                <CardBack small />
              </motion.div>
            </motion.div>
          ))}
        </div>

        <motion.div {...stagger(2)} onClick={logoTap} style={{ cursor: 'pointer' }}>
          <div className="label" style={{ letterSpacing: '.5em', marginBottom: 4 }}>
            ¿Quién miente?
          </div>
          <h1 className="h1" style={{ fontSize: 'clamp(60px, 20vw, 104px)', textShadow: '0 0 40px rgba(255,46,77,.55)' }}>
            <Glitch text="IMPOSTOR" />
          </h1>
        </motion.div>
        <motion.p {...stagger(3)} className="dim" style={{ margin: 0, maxWidth: 320, lineHeight: 1.5, fontSize: 15 }}>
          Todos tienen la misma carta… menos uno. Tiene algo <b style={{ color: '#fff' }}>parecido</b>. ¿Lo descubrirán?
        </motion.p>
        <motion.div {...stagger(4)} className="row dim" style={{ fontSize: 12, fontWeight: 700, gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span>
            <Emo e="🃏" /> {ITEMS.length} cartas
          </span>
          <span>
            <Emo e="🗂️" anim="bob" /> {CATEGORIES.length} categorías
          </span>
          <span>
            <Emo e="⚡" /> {EVENT_LIST.length + CHALLENGES.filter((c) => !c.adult).length} eventos
          </span>
        </motion.div>
      </div>

      <div className="stack content">
        {canResume && (
          <motion.div {...stagger(5)}>
            <Button variant="ghost" onClick={() => go(resumeScreen(round))}>
              ⏯️ Continuar ronda
            </Button>
          </motion.div>
        )}
        <motion.div {...stagger(6)}>
          <Button
            onClick={() => {
              sfx.whoosh();
              go('players');
            }}
            style={{ minHeight: 70, fontSize: 34 }}
          >
            ▶ Jugar
          </Button>
          <div className="dim center" style={{ fontSize: 11.5, marginTop: 6, fontWeight: 700 }}>
            Un solo teléfono que se pasa · funciona sin internet
          </div>
        </motion.div>
        <motion.div {...stagger(7)}>
          <Button
            variant="plain"
            onClick={() => {
              sfx.whoosh();
              go('online');
            }}
          >
            <Emo e="📡" anim="wiggle" /> Varios teléfonos
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
