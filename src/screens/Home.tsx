import { motion } from 'framer-motion';
import { haptic, sfx } from '../audio/sfx';
import { CardBack } from '../components/GameCard';
import { Button, Glitch, IconButton, stagger } from '../components/ui';
import { CATEGORIES } from '../data/categories';
import { ITEMS } from '../data';
import { burst, flash } from '../fx/fx';
import { useGame } from '../store/game';

const FAN = [
  { r: -16, x: -70, y: 14, d: 0 },
  { r: 0, x: 0, y: 0, d: 0.1 },
  { r: 16, x: 70, y: 14, d: 0.2 },
];

export function Home() {
  const go = useGame((s) => s.go);
  const round = useGame((s) => s.round);
  const players = useGame((s) => s.players);
  const canResume = round && !round.result;
  const resume = () => {
    if (!round) return;
    if (round.dealIdx < players.length) go('deal');
    else if (!round.accused.length && !round.nobodyVote) go(round.lap > round.laps ? 'vote' : 'discuss');
    else go('reveal');
  };

  const logoTap = (e: React.MouseEvent) => {
    sfx.impostor();
    haptic([30, 30, 60]);
    flash('#ff2e4d', 350, 0.35);
    burst({ x: e.clientX, y: e.clientY, kind: 'sparks', colors: ['#ff2e4d', '#fff', '#ff7a90'], count: 40 });
  };

  return (
    <div className="screen">
      <div className="topbar content" style={{ justifyContent: 'flex-end' }}>
        <IconButton label="Cómo jugar" onClick={() => go('howto')}>
          ?
        </IconButton>
        <IconButton label="Ajustes" onClick={() => go('settings')}>
          ⚙️
        </IconButton>
      </div>

      <div className="grow center content" style={{ gap: 18 }}>
        <div style={{ position: 'relative', height: 200, width: 280 }}>
          {FAN.map((f, i) => (
            <motion.div
              key={i}
              initial={{ y: 200, rotate: 0, opacity: 0 }}
              animate={{ y: f.y, x: f.x, rotate: f.r, opacity: 1 }}
              transition={{ delay: 0.15 + f.d, type: 'spring', stiffness: 160, damping: 16 }}
              style={{ position: 'absolute', left: 85, top: 0, width: 110, height: 154 }}
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
                className="face back"
                style={{ position: 'absolute', inset: 0, borderRadius: 16, transform: 'none', fontSize: 9 }}
              >
                <div style={{ transform: 'scale(.42)', transformOrigin: 'center' }}>
                  <CardBack />
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        <motion.div {...stagger(2)} onClick={logoTap} style={{ cursor: 'pointer' }}>
          <div className="label" style={{ letterSpacing: '.5em', marginBottom: 4 }}>
            ¿Quién miente?
          </div>
          <h1 className="h1" style={{ fontSize: 'clamp(64px, 20vw, 104px)', textShadow: '0 0 40px rgba(255,46,77,.55)' }}>
            <Glitch text="IMPOSTOR" />
          </h1>
        </motion.div>
        <motion.p {...stagger(3)} className="dim" style={{ margin: 0, maxWidth: 320, lineHeight: 1.5, fontSize: 15 }}>
          Todos tienen la misma carta… menos uno. Tiene algo <b style={{ color: '#fff' }}>parecido</b>. ¿Lo descubrirán?
        </motion.p>
        <motion.div {...stagger(4)} className="row dim" style={{ fontSize: 12, fontWeight: 700, gap: 14 }}>
          <span>🃏 {ITEMS.length} cartas</span>
          <span>🗂️ {CATEGORIES.length} categorías</span>
        </motion.div>
      </div>

      <div className="stack content">
        {canResume && (
          <motion.div {...stagger(5)}>
            <Button variant="ghost" onClick={resume}>
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
        </motion.div>
      </div>
    </div>
  );
}
