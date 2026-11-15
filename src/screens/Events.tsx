import { AnimatePresence, motion } from 'framer-motion';
import { Emo } from '../components/Emo';
import { useMemo, useState, type CSSProperties } from 'react';
import { sfx } from '../audio/sfx';
import { EventCard } from '../components/EventCard';
import { EventOverlay } from '../components/EventOverlay';
import { Button, Sheet, TopBar } from '../components/ui';
import { KIND_META, MISSIONS, TURN_EVENTS, type ChallengeKind } from '../data/challenges';
import { INTENSITY } from '../engine/challenges';
import { CURSED_WORDS, EVENT_LIST, MX_ACCENTS, MYSTERY, type EventId, type GameEvent } from '../engine/events';
import { PTS } from '../engine/scoring';
import { useGame, type Player } from '../store/game';

const DEMO: Player = { id: 'demo', name: 'Tu amigo', color: '#2ee6ff', avatar: '🦊' };
const KINDS = (Object.keys(KIND_META) as ChallengeKind[]).filter((k) => TURN_EVENTS.some((c) => c.kind === k));
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        sfx.select();
        onChange(!on);
      }}
      style={{ padding: 6, margin: -6 }}
    >
      <span className={`switch ${on ? 'on' : ''}`} style={{ display: 'block' }} />
    </button>
  );
}

/**
 * Catálogo de eventos: se ve exactamente cómo aparece cada uno en la partida y se apagan los
 * que no le gusten a la mesa.
 */
export function Events() {
  const { settings, setSettings, players, go } = useGame();
  const [preview, setPreview] = useState<GameEvent | 'mystery' | null>(null);
  const [demo, setDemo] = useState<string | null>(null);
  const [missionSeed, setMissionSeed] = useState(0);
  const lvl = INTENSITY[settings.intensity];
  const n = players.length;

  const sample = useMemo(() => ({ word: pick(CURSED_WORDS), accent: pick(MX_ACCENTS).id }), [preview]);
  const missions = useMemo(() => {
    const pool = MISSIONS.filter((m) => settings.adult || !m.adult);
    const out = new Set<string>();
    while (out.size < Math.min(3, pool.length)) out.add(pick(pool).id);
    return pool.filter((m) => out.has(m.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionSeed, settings.adult]);

  const toggleEvent = (id: EventId, on: boolean) => setSettings({ eventsOff: on ? settings.eventsOff.filter((e) => e !== id) : [...settings.eventsOff, id] });
  const toggleKind = (k: ChallengeKind, on: boolean) => setSettings({ kindsOff: on ? settings.kindsOff.filter((e) => e !== k) : [...settings.kindsOff, k] });
  const showDemo = (k: ChallengeKind) => {
    const pool = TURN_EVENTS.filter((c) => c.kind === k && (settings.adult || !c.adult));
    if (pool.length) setDemo(pick(pool).id);
  };

  return (
    <div className="screen">
      <TopBar title="⚡ Eventos" onBack={() => go('setup')} />
      <div className="scroll content">
        <div className="stack" style={{ gap: 18 }}>
          <div className="dim" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            Toca un evento para ver cómo aparece en la partida. Apaga los que no quieran. Con la frecuencia <b style={{ color: '#fff' }}>{lvl.emoji} {lvl.label}</b>:{' '}
            {Math.round(lvl.event * 100)} % de las rondas traen evento y en cada turno hay {Math.round(lvl.turn * 100)} % de que te toque uno.
          </div>

          <section className="stack" style={{ gap: 8 }}>
            <div className="row">
              <div className="label grow">🎡 Eventos de ronda</div>
              {!settings.events && <div className="label" style={{ color: '#ff5470' }}>Apagados</div>}
            </div>
            {EVENT_LIST.map((e, i) => {
              const on = !settings.eventsOff.includes(e.id);
              const locked = n > 0 && n < (e.minPlayers ?? 0);
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: on && settings.events ? 1 : 0.45, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                  className="event-row"
                  style={{ '--ev': e.color } as CSSProperties}
                  onClick={() => {
                    sfx.select();
                    setPreview(e);
                  }}
                >
                  <span className="event-row-icon">
                    <Emo e={e.emoji} />
                  </span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <b>{e.title}</b>
                    <small>{e.desc}</small>
                    <span className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {e.secret && <span className="tag">🤫 Siempre secreto</span>}
                      {e.canHide && <span className="tag">❓ A veces secreto</span>}
                      {e.minPlayers && <span className="tag" style={locked ? { color: '#ffb547' } : undefined}>{e.minPlayers}+ jugadores</span>}
                    </span>
                  </span>
                  <Switch on={on} onChange={(v) => toggleEvent(e.id, v)} label={`Activar ${e.title}`} />
                </motion.div>
              );
            })}
            <Button variant="ghost" small onClick={() => setPreview('mystery')}>
              ❓ Ver cómo se anuncia un evento secreto
            </Button>
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <div className="row">
              <div className="label grow">🎙️ Eventos especiales de turno</div>
              {!settings.challenges && <div className="label" style={{ color: '#ff5470' }}>Apagados</div>}
            </div>
            {KINDS.map((k) => {
              const meta = KIND_META[k];
              const on = !settings.kindsOff.includes(k);
              const count = TURN_EVENTS.filter((c) => c.kind === k && (settings.adult || !c.adult)).length;
              return (
                <motion.div
                  key={k}
                  animate={{ opacity: on && settings.challenges ? 1 : 0.45 }}
                  className="event-row"
                  style={{ '--ev': meta.color } as CSSProperties}
                  onClick={() => {
                    sfx.select();
                    showDemo(k);
                  }}
                >
                  <span className="event-row-icon">
                    <Emo e={meta.emoji} />
                  </span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <b>{meta.label}</b>
                    <small>
                      {count} eventos · Ej.: {meta.example}
                    </small>
                  </span>
                  <Switch on={on} onChange={(v) => toggleKind(k, v)} label={`Activar ${meta.label}`} />
                </motion.div>
              );
            })}
            <div className="dim" style={{ fontSize: 12, lineHeight: 1.45 }}>
              Toca un tipo para ver un ejemplo tal como sale en la partida. Valen +{PTS.challengeDone} si se cumplen y {PTS.challengeFail} si no.
            </div>
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <div className="row">
              <div className="label grow">🤫 Misiones secretas</div>
              {!settings.missions && <div className="label" style={{ color: '#ff5470' }}>Apagadas</div>}
            </div>
            <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
              Llegan escritas en tu carta ({Math.round(lvl.mission * 100)} % por jugador) y nadie más sabe que la tienes. Valen +{PTS.missionDone}. Algunos ejemplos:
            </div>
            <AnimatePresence mode="popLayout">
              {missions.map((m) => (
                <motion.div key={m.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="mission" style={{ fontSize: 13.5, padding: '10px 12px' }}>
                  {m.text}
                </motion.div>
              ))}
            </AnimatePresence>
            <Button variant="ghost" small onClick={() => setMissionSeed((s) => s + 1)}>
              🎲 Ver otras
            </Button>
          </section>

          <div className="panel" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            <b>💚 Hechos para reírse, no para arriesgarse.</b>
            <div className="dim" style={{ marginTop: 4 }}>
              Ningún evento pide alcohol, golpes, correr ni exponer la vida privada de nadie. {settings.adult ? 'El modo +18 está activo: solo agrega groserías, y van para la carta.' : 'El modo +18 está apagado: no saldrá ninguna grosería.'}
            </div>
          </div>
        </div>
      </div>

      <Sheet open={!!preview} onClose={() => setPreview(null)}>
        <div className="label">Así se anuncia después de la ruleta</div>
        {preview && (
          <EventCard
            event={preview === 'mystery' ? MYSTERY : preview}
            cursedWord={preview !== 'mystery' && preview.id === 'cursed' ? sample.word : undefined}
            accent={preview !== 'mystery' && preview.id === 'mexican' ? sample.accent : undefined}
            adult={settings.adult}
          />
        )}
        <Button small onClick={() => setPreview(null)}>
          Cerrar
        </Button>
      </Sheet>

      <AnimatePresence>{demo && <EventOverlay key={demo} player={DEMO} challengeId={demo} onAccept={() => setDemo(null)} />}</AnimatePresence>
    </div>
  );
}
