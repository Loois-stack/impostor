import { motion } from 'framer-motion';
import { haptic, sfx } from '../audio/sfx';
import { Button, Segmented, Toggle, TopBar } from '../components/ui';
import { BY_CAT } from '../data';
import { CATEGORIES } from '../data/categories';
import type { CategoryId } from '../data/types';
import { useGame } from '../store/game';

const SIM_DESC = {
  close: 'El impostor casi siempre tendrá algo muy parecido: podrá camuflarse fácil. Rondas tensas.',
  mixed: 'A veces casi igual, a veces tendrá que jugársela. La experiencia recomendada.',
  far: 'El impostor tendrá algo más distinto: tendrá que improvisar mucho. Más fácil para los civiles.',
};

export function Setup() {
  const { settings, setSettings, players, session, go, startRound, newSession } = useGame();
  const allOn = settings.cats.length === CATEGORIES.length;
  const canTwo = players.length >= 6;

  const toggleCat = (id: CategoryId) => {
    const on = settings.cats.includes(id);
    if (on && settings.cats.length === 1) return;
    sfx.select();
    haptic(8);
    setSettings({ cats: on ? settings.cats.filter((c) => c !== id) : [...settings.cats, id] });
  };

  const start = (fresh: boolean) => {
    if (fresh) newSession();
    if (!canTwo && settings.impostors === 2) setSettings({ impostors: 1 });
    sfx.whoosh();
    startRound();
  };

  return (
    <div className="screen">
      <TopBar title="Configurar" onBack={() => go('players')} />
      <div className="scroll content">
        <div className="stack" style={{ gap: 20 }}>
          <section className="stack" style={{ gap: 10 }}>
            <div className="row">
              <div className="label grow">Categorías · {settings.cats.length}</div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="label"
                style={{ color: 'var(--accent)', padding: 6 }}
                onClick={() => {
                  sfx.select();
                  setSettings({ cats: allOn ? ['memes'] : CATEGORIES.map((c) => c.id) });
                }}
              >
                {allOn ? 'Quitar todas' : '🎲 Aleatorio total'}
              </motion.button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {CATEGORIES.map((c, i) => {
                const on = settings.cats.includes(c.id);
                return (
                  <motion.button
                    key={c.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0, scale: on ? 1 : 0.97 }}
                    transition={{ delay: i * 0.02, type: 'spring', stiffness: 400, damping: 28 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => toggleCat(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 10px',
                      borderRadius: 16,
                      textAlign: 'left',
                      minHeight: 56,
                      background: on ? `linear-gradient(135deg, ${c.color}33, ${c.color2}44)` : 'var(--panel)',
                      border: `1.5px solid ${on ? c.color : 'var(--line)'}`,
                      boxShadow: on ? `0 0 20px ${c.color}33` : 'none',
                      opacity: on ? 1 : 0.55,
                      transition: 'background .25s, border-color .25s, opacity .25s',
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{c.emoji}</span>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ display: 'block', fontSize: 13.5, lineHeight: 1.15 }}>{c.name}</b>
                      <small className="dim" style={{ fontSize: 11 }}>
                        {BY_CAT[c.id].length} cartas
                      </small>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <div className="label">Parecido de la carta del impostor</div>
            <Segmented
              id="sim"
              value={settings.similarity}
              onChange={(similarity) => setSettings({ similarity })}
              options={[
                { value: 'close', label: 'Casi igual' },
                { value: 'mixed', label: 'Mixto' },
                { value: 'far', label: 'Distinto' },
              ]}
            />
            <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
              {SIM_DESC[settings.similarity]}
            </div>
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <div className="label">¿Qué ve el impostor?</div>
            <Segmented
              id="mode"
              value={settings.mode}
              onChange={(mode) => setSettings({ mode })}
              options={[
                { value: 'similar', label: 'Carta parecida' },
                { value: 'classic', label: 'Nada (clásico)' },
              ]}
            />
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <section className="stack" style={{ gap: 8 }}>
              <div className="label">Impostores</div>
              <Segmented
                id="imp"
                value={canTwo ? settings.impostors : 1}
                onChange={(impostors) => (canTwo || impostors === 1) && setSettings({ impostors })}
                options={[
                  { value: 1, label: '1' },
                  { value: 2, label: canTwo ? '2' : '2 🔒' },
                ]}
              />
            </section>
            <section className="stack" style={{ gap: 8 }}>
              <div className="label">Vueltas de pistas</div>
              <Segmented
                id="laps"
                value={settings.laps}
                onChange={(laps) => setSettings({ laps })}
                options={[
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                  { value: 3, label: '3' },
                ]}
              />
            </section>
          </div>

          <section className="stack" style={{ gap: 8 }}>
            <div className="label">Tiempo por turno</div>
            <Segmented
              id="timer"
              value={settings.timer}
              onChange={(timer) => setSettings({ timer })}
              options={[
                { value: 0, label: 'Libre' },
                { value: 20, label: '20 s' },
                { value: 30, label: '30 s' },
                { value: 45, label: '45 s' },
              ]}
            />
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <Toggle
              emoji="🎭"
              on={settings.challenges}
              onChange={(challenges) => setSettings({ challenges })}
              title="Retos entre turnos"
              desc="Al jugador en turno le puede tocar un reto: voz ridícula, traicionar, mímica…"
            />
            <Toggle
              emoji="⚡"
              on={settings.events}
              onChange={(events) => setSettings({ events })}
              title="Eventos sorpresa"
              desc="Doble impostor, impostor a ciegas, ronda de terror, palabra maldita… y algo más."
            />
          </section>
        </div>
      </div>

      <div className="stack content" style={{ paddingTop: 12, gap: 8 }}>
        {session.round > 0 ? (
          <>
            <Button onClick={() => start(false)}>Siguiente ronda ➜</Button>
            <Button variant="ghost" small onClick={() => start(true)}>
              Nueva partida (reiniciar puntos)
            </Button>
          </>
        ) : (
          <Button onClick={() => start(true)} style={{ minHeight: 68, fontSize: 32 }}>
            ¡A jugar!
          </Button>
        )}
      </div>
    </div>
  );
}
