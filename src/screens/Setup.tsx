import { motion } from 'framer-motion';
import { Emo } from '../components/Emo';
import { useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { Button, Segmented, Sheet, Toggle, TopBar } from '../components/ui';
import { BY_CAT, MIN_CUSTOM } from '../data';
import { CATEGORIES, CUSTOM_CAT } from '../data/categories';
import type { CategoryId } from '../data/types';
import { INTENSITY, type Intensity } from '../engine/challenges';
import { balanceOf, maxImpostors, recommendedImpostors, resolveImpostors, type Balance } from '../engine/roles';
import { useSeat } from '../net/state';
import { useGame } from '../store/game';

const MIX_DESC = {
  off: 'Cada ronda sale de una de las categorías elegidas.',
  on: 'Temas que cruzan categorías: Payasos (Pennywise, el Joker, Krusty…), Robots, Calvos legendarios… El impostor puede tener un personaje de OTRA categoría.',
  mixed: 'A veces categoría normal, a veces un tema de Mezcla. Nunca sabes qué viene.',
};

const SIM_DESC = {
  close: 'El impostor casi siempre tendrá algo muy parecido: podrá camuflarse fácil. Rondas tensas.',
  mixed: 'A veces casi igual, a veces tendrá que jugársela. La experiencia recomendada.',
  far: 'El impostor tendrá algo más distinto: tendrá que improvisar mucho. Más fácil para los civiles.',
};

const VOTE_DESC = {
  group: 'Discuten y deciden juntos; uno toca la pantalla por todos.',
  secret: 'El teléfono pasa de mano en mano y cada quien vota sin que lo vean. Si hay empate, nadie sale.',
};

const pct = (p: number) => `${Math.round(p * 100)} %`;

const BALANCE: Record<Balance, { t: string; c: string }> = {
  easy: { t: 'Fácil para los civiles', c: '#2ee6ff' },
  fair: { t: 'Equilibrado', c: '#39ff88' },
  hard: { t: 'Difícil para los civiles', c: '#ffb547' },
  brutal: { t: 'Los impostores tienen ventaja', c: '#ff2e4d' },
};

/** Elegir cuántos impostores: automático según los jugadores o un número fijo. */
function ImpostorPicker() {
  const { settings, setSettings, players } = useGame();
  const n = players.length;
  const max = maxImpostors(n);
  const rec = recommendedImpostors(n);
  const k = resolveImpostors(settings.impostors, n);
  const auto = settings.impostors === 0;
  const bal = BALANCE[balanceOf(k, n)];
  const set = (v: number) => {
    sfx.select();
    haptic(8);
    setSettings({ impostors: Math.max(1, Math.min(max, v)) });
  };
  return (
    <section className="stack" style={{ gap: 10 }}>
      <div className="label">🔪 Impostores</div>
      <div className="imp-picker">
        <motion.button whileTap={{ scale: 0.85 }} className="icon-btn" disabled={k <= 1} onClick={() => set(k - 1)} aria-label="Menos impostores">
          −
        </motion.button>
        <div className="imp-count">
          <div className="imp-knives" aria-hidden>
            {Array.from({ length: k }, (_, i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }}>
                🔪
              </motion.span>
            ))}
          </div>
          <motion.div key={k} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="display" style={{ fontSize: 44, lineHeight: 1 }}>
            {k}
          </motion.div>
          <small className="dim">
            {n} jugadores · {n - k} civiles
          </small>
        </div>
        <motion.button whileTap={{ scale: 0.85 }} className="icon-btn" disabled={k >= max} onClick={() => set(k + 1)} aria-label="Más impostores">
          +
        </motion.button>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <motion.button
          whileTap={{ scale: 0.94 }}
          className="chip"
          onClick={() => {
            sfx.select();
            setSettings({ impostors: auto ? k : 0 });
          }}
          style={{ borderColor: auto ? 'var(--accent)' : undefined, background: auto ? 'color-mix(in srgb, var(--accent) 22%, transparent)' : undefined }}
        >
          {auto ? '✓ ' : ''}🤖 Automático ({rec})
        </motion.button>
        <span className="chip" style={{ borderColor: bal.c }}>
          <span className="dot" style={{ background: bal.c }} /> {bal.t}
        </span>
        <span className="chip dim">Máximo con {n}: {max}</span>
      </div>
      <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
        {k === 1
          ? 'Un solo impostor contra todos. El clásico.'
          : settings.impTeam
            ? `Los ${k} impostores se conocen, tienen la misma carta y ganan juntos si sobrevive al menos uno.`
            : `Cada impostor tiene una carta distinta y no sabe quiénes son los otros: ni entre ellos pueden confiarse.`}
        {k >= 3 && !settings.elimination && ' Con tantos impostores conviene activar la Eliminación: se acusa de uno en uno.'}
      </div>
      {k > 1 && (
        <Toggle
          emoji="👥"
          on={settings.impTeam}
          onChange={(impTeam) => setSettings({ impTeam })}
          title="Los impostores se conocen"
          desc="Juegan en equipo: ven quiénes son sus compañeros y comparten carta. Si cae uno, los demás pueden salvar la ronda."
        />
      )}
    </section>
  );
}

export function Setup() {
  const { settings, setSettings, session, go, startRound, newSession, customCards } = useGame();
  const { online } = useSeat();
  const [askAdult, setAskAdult] = useState(false);
  const allOn = CATEGORIES.every((c) => settings.cats.includes(c.id));
  const customOn = settings.cats.includes('custom') && customCards.length >= MIN_CUSTOM;
  const lvl = INTENSITY[settings.intensity];
  const anyEvents = settings.events || settings.challenges || settings.missions;

  const toggleCat = (id: CategoryId) => {
    const on = settings.cats.includes(id);
    if (on && settings.cats.filter((c) => c !== 'custom' || customOn).length === 1) return;
    sfx.select();
    haptic(8);
    setSettings({ cats: on ? settings.cats.filter((c) => c !== id) : [...settings.cats, id] });
  };

  const start = (fresh: boolean) => {
    if (fresh) newSession();
    sfx.whoosh();
    startRound();
  };

  return (
    <div className="screen">
      <TopBar title="Reglas" onBack={() => go(online ? 'lobby' : 'players')} />
      <div className="scroll content">
        <div className="stack" style={{ gap: 20 }}>
          <ImpostorPicker />

          <section className="stack" style={{ gap: 10 }}>
            <div className="row">
              <div className="label grow">Categorías · {settings.cats.filter((c) => c !== 'custom' || customOn).length}</div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="label"
                style={{ color: 'var(--accent)', padding: 6 }}
                onClick={() => {
                  sfx.select();
                  const keep = settings.cats.includes('custom') ? (['custom'] as CategoryId[]) : [];
                  setSettings({ cats: allOn ? (keep.length ? keep : ['memes']) : [...CATEGORIES.map((c) => c.id), ...keep] });
                }}
              >
                {allOn ? 'Quitar todas' : '🎲 Todas'}
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
                    className="cat-tile"
                    style={{
                      background: on ? `linear-gradient(135deg, ${c.color}33, ${c.color2}44)` : 'var(--panel)',
                      borderColor: on ? c.color : 'var(--line)',
                      boxShadow: on ? `0 0 20px ${c.color}33` : 'none',
                      opacity: on ? 1 : 0.55,
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{on ? <Emo e={c.emoji} /> : c.emoji}</span>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ display: 'block', fontSize: 13.5, lineHeight: 1.15 }}>{c.name}</b>
                      <small className="dim" style={{ fontSize: 11 }}>
                        {BY_CAT[c.id].length} cartas
                      </small>
                    </span>
                    {on && <span className="cat-check">✓</span>}
                  </motion.button>
                );
              })}
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                sfx.select();
                go('custom');
              }}
              className="panel row"
              style={{
                padding: '12px 14px',
                textAlign: 'left',
                borderColor: customOn ? CUSTOM_CAT.color : undefined,
                background: customOn ? `linear-gradient(135deg, ${CUSTOM_CAT.color}33, ${CUSTOM_CAT.color2}44)` : undefined,
              }}
            >
              <span style={{ fontSize: 26 }}>{CUSTOM_CAT.emoji}</span>
              <span className="grow">
                <b style={{ display: 'block' }}>Mis cartas</b>
                <small className="dim">
                  {customCards.length
                    ? `${customCards.length} cartas · ${customOn ? 'incluidas en la partida' : 'toca para crear o incluir'}`
                    : 'Crea cartas propias con fotos de tus amigos, chistes internos…'}
                </small>
              </span>
              <span style={{ fontSize: 20 }}>›</span>
            </motion.button>
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <div className="label">⚡ Eventos</div>
            <Segmented
              id="intensity"
              value={settings.intensity}
              onChange={(intensity: Intensity) => setSettings({ intensity })}
              options={(Object.keys(INTENSITY) as Intensity[]).map((k) => ({ value: k, label: `${INTENSITY[k].emoji} ${INTENSITY[k].label}` }))}
            />
            <div className="odds" style={{ opacity: anyEvents ? 1 : 0.4 }}>
              <div>
                <b>{settings.events ? pct(lvl.event) : '—'}</b>
                <small>de las rondas traen evento</small>
              </div>
              <div>
                <b>{settings.challenges ? pct(lvl.turn) : '—'}</b>
                <small>por turno de que te toque uno</small>
              </div>
              <div>
                <b>{settings.missions ? pct(lvl.mission) : '—'}</b>
                <small>por jugador de misión secreta</small>
              </div>
            </div>
            <Toggle
              emoji="🎡"
              on={settings.events}
              onChange={(events) => setSettings({ events })}
              title="Eventos de ronda"
              desc="Cambian las reglas para todos: doble impostor, fiesta mexicana, cine mudo, ronda dorada… y a veces uno secreto."
            />
            <Toggle
              emoji="🎙️"
              on={settings.challenges}
              onChange={(challenges) => setSettings({ challenges })}
              title="Eventos especiales de turno"
              desc="Al jugador en turno le puede tocar una voz, un acento, mímica… Se avisa a quién le tocó y se quita al pasar el turno."
            />
            <Toggle
              emoji="🤫"
              on={settings.missions}
              onChange={(missions) => setSettings({ missions })}
              title="Misiones secretas"
              desc="Llegan con tu carta y solo tú las conoces. Se revelan al final de la ronda."
            />
            <Toggle
              emoji="🌶️"
              on={settings.adult}
              onChange={(adult) => (adult ? setAskAdult(true) : setSettings({ adult: false }))}
              title="Modo +18"
              desc="Agrega eventos con groserías y picardía mexicana. Solo palabras: nada de retos peligrosos."
            />
            <Button variant="ghost" small onClick={() => go('events')}>
              👁️ Ver y elegir eventos
            </Button>
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <Toggle
              emoji="💀"
              on={settings.elimination}
              onChange={(elimination) => setSettings({ elimination })}
              title="Eliminación"
              desc="Si acusan a un inocente, sale del juego y siguen buscando con menos tiempo. Cada error baja el premio; si quedan solo 2, gana el impostor."
            />
            {!online && (
              <>
                <div className="label" style={{ marginTop: 6 }}>
                  🗳️ Votación
                </div>
                <Segmented
                  id="vote"
                  value={settings.voteStyle}
                  onChange={(voteStyle) => setSettings({ voteStyle })}
                  options={[
                    { value: 'group', label: 'En grupo' },
                    { value: 'secret', label: 'Voto secreto' },
                  ]}
                />
                <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                  {VOTE_DESC[settings.voteStyle]}
                </div>
              </>
            )}
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <div className="label">🔀 Modo Mezcla</div>
            <Segmented
              id="mix"
              value={settings.mix}
              onChange={(mix) => setSettings({ mix })}
              options={[
                { value: 'off', label: 'Categorías' },
                { value: 'on', label: 'Mezcla' },
                { value: 'mixed', label: 'Ambos' },
              ]}
            />
            <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
              {MIX_DESC[settings.mix]}
            </div>
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <div className="label">⏱️ Tiempo de la ronda</div>
            <Segmented
              id="roundTime"
              value={settings.roundTime}
              onChange={(roundTime) => setSettings({ roundTime })}
              options={[
                { value: 0, label: 'Libre' },
                { value: 120, label: '2 min' },
                { value: 180, label: '3 min' },
                { value: 300, label: '5 min' },
                { value: 480, label: '8 min' },
              ]}
            />
            <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
              El reloj corre durante las pistas. Pueden votar cuando quieran; al acabarse el tiempo, se vota sí o sí.
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

          <section className="stack" style={{ gap: 8 }}>
            <div className="label">Vueltas de pistas</div>
            <Segmented
              id="laps"
              value={settings.laps}
              onChange={(laps) => setSettings({ laps })}
              options={[
                { value: 0, label: '∞ Libre' },
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
              ]}
            />
          </section>

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
        </div>
      </div>

      <div className="stack content" style={{ paddingTop: 12, gap: 8 }}>
        {online ? (
          <Button onClick={() => go('lobby')}>Listo ✔</Button>
        ) : session.round > 0 ? (
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

      <Sheet open={askAdult} onClose={() => setAskAdult(false)}>
        <div className="h2">🌶️ Modo +18</div>
        <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>
          Se agregan eventos con <b>groserías mexicanas y albures</b>: hablar como chilango malhablado, regañar a tu carta como mamá enojada…
        </div>
        <div className="dim" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Actívalo solo si todos en la mesa son mayores de edad y están de acuerdo. Las groserías van para la carta, nunca para insultar a alguien. No hay
          retos de alcohol ni nada peligroso.
        </div>
        <Button
          variant="danger"
          onClick={() => {
            setSettings({ adult: true });
            setAskAdult(false);
          }}
        >
          Somos adultos, actívalo
        </Button>
        <Button variant="ghost" small onClick={() => setAskAdult(false)}>
          Mejor no
        </Button>
      </Sheet>
    </div>
  );
}
