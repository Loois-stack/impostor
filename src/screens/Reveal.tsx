import { AnimatePresence, motion } from 'framer-motion';
import { EliminationCutscene } from '../components/Elimination';
import { elimFor } from '../data/eliminations';
import { usePrefs } from '../store/prefs';
import { emojiRain } from '../fx/scene';
import { Emo } from '../components/Emo';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { MiniCard } from '../components/MiniCard';
import { Avatar, Button, Glitch } from '../components/ui';
import { BY_ID, decoyCandidates } from '../data';
import { CH_BY_ID, KIND_META } from '../data/challenges';
import { THEME_BY_ID } from '../data/themes';
import { makeRng } from '../engine/rng';
import { PTS } from '../engine/scoring';
import { NOBODY } from '../engine/vote';
import { burst, flash, shake } from '../fx/fx';
import { useSeat } from '../net/state';
import { guessersOf, pendingJudgments, roundStatus, useGame, type Player } from '../store/game';
import { secretEvent } from '../store/view';
import { LastChance } from './LastChance';

const LEVEL_TXT = { 1: '🔥 Casi idénticas', 2: '⚖️ Parecidas', 3: '🎲 Lejanas' } as const;

function Stamp({ tone, text, delay = 0 }: { tone: 'bad' | 'good' | 'neutral'; text: string; delay?: number }) {
  const color = tone === 'bad' ? '#ff2e4d' : tone === 'good' ? '#2ee6ff' : '#ffd23d';
  return (
    <motion.div
      initial={{ scale: 4, opacity: 0, rotate: -25 }}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      transition={{ delay, type: 'spring', stiffness: 500, damping: 18 }}
      className="display"
      style={{
        fontSize: 'clamp(44px, 14vw, 64px)',
        padding: '4px 18px',
        border: `5px solid ${color}`,
        color,
        borderRadius: 14,
        textShadow: `0 0 24px ${color}`,
        boxShadow: `0 0 40px ${color}55, inset 0 0 20px ${color}33`,
        background: 'rgba(0,0,0,.4)',
      }}
    >
      {text}
    </motion.div>
  );
}

/** Barras con el conteo de una votación individual. */
function TallyBars({ counts, players }: { counts: Record<string, number>; players: Player[] }) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <div className="stack" style={{ gap: 8, width: '100%', maxWidth: 360 }}>
      {rows.map(([id, n], i) => {
        const p = players.find((x) => x.id === id);
        return (
          <div key={id} className="row" style={{ gap: 8 }}>
            {p ? <Avatar player={p} size={30} /> : <span style={{ width: 30, fontSize: 24, textAlign: 'center' }}>🫥</span>}
            <b style={{ width: 82, textAlign: 'left', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p ? p.name : id === NOBODY ? 'Nadie' : '?'}
            </b>
            <div className="grow" style={{ height: 16, borderRadius: 8, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(n / max) * 100}%` }}
                transition={{ delay: 0.3 + i * 0.25, duration: 0.7, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 8, background: p ? p.color : '#b8c6ff' }}
              />
            </div>
            <motion.b initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 + i * 0.25 }} className="display" style={{ fontSize: 24, width: 18 }}>
              {n}
            </motion.b>
          </div>
        );
      })}
    </div>
  );
}

function Waiting({ text = 'Esperando al anfitrión…' }: { text?: string }) {
  return (
    <div className="dim center" style={{ fontWeight: 700, minHeight: 44 }}>
      {text}
    </div>
  );
}

export function Reveal() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const { setStep, setChallengeResult, setMissionResult, finishRound, continueRound } = useGame();
  const { host } = useSeat();
  // El suspenso es una animación local; el resto de pasos los marca el store (y así van a la par en sala).
  const [suspense, setSuspense] = useState(round.step === 'verdict');
  // Animación de eliminación de cada acusado (una tras otra) antes del veredicto.
  const [cut, setCut] = useState<string[] | null>(null);
  const elimFx = usePrefs((s) => s.elimFx);
  const phase = round.step === 'verdict' && suspense ? 'suspense' : round.step;

  const P = (id: string) => players.find((p) => p.id === id)!;
  const civil = BY_ID[round.civil];
  const decoy = round.decoy ? BY_ID[round.decoy] : null;
  // Cartas distintas que tuvieron los impostores y quién tuvo cada una.
  const decoyIds = [...new Set(Object.values(round.decoys ?? {}))];
  const decoyCards = (decoyIds.length ? decoyIds : round.decoy ? [round.decoy] : []).map((id) => ({
    item: BY_ID[id],
    who: round.impostors.filter((imp) => (round.decoys?.[imp] ?? round.decoy) === id),
  }));
  const avatarSize = round.impostors.length <= 2 ? 76 : round.impostors.length <= 4 ? 58 : 44;
  const caught = round.impostors.filter((i) => round.accused.includes(i));
  const escaped = round.impostors.filter((i) => !round.accused.includes(i));
  const lastVote = round.lastVote ?? round.accused;
  const lastCaught = round.impostors.filter((i) => lastVote.includes(i));
  const status = roundStatus(round);
  const innocentsOut = round.accused.filter((id) => !round.impostors.includes(id));
  const judgments = pendingJudgments(round);
  const correctNobody = round.nobodyVote && round.impostors.length === 0;
  const tie = !round.nobodyVote && lastVote.length === 0;
  const revealed = secretEvent(round);
  const jesterWon = !!round.jester && round.accused.includes(round.jester);

  const options = useMemo(() => {
    const rng = makeRng(round.n * 7919 + round.civil.length);
    const c = decoyCandidates(civil);
    const themed = round.theme ? THEME_BY_ID[round.theme].items.map((id) => BY_ID[id]).filter((i) => i && i.id !== civil.id) : [];
    const pool = [...rng.shuffle(themed), ...rng.shuffle(c[1]), ...rng.shuffle(c[2]), ...rng.shuffle(c[3])].filter(
      (i, idx, arr) => i.id !== round.decoy && !Object.values(round.decoys ?? {}).includes(i.id) && arr.findIndex((x) => x.id === i.id) === idx,
    );
    return rng.shuffle([civil, ...pool.slice(0, 5)]);
  }, [round.n, round.civil, round.decoy, round.decoys, round.theme, civil]);

  const afterCut = useRef<() => void>(() => setSuspense(false));

  // Suspenso -> veredicto (una vez por votación).
  useEffect(() => {
    if (round.step !== 'verdict') return;
    setSuspense(true);
    const long = round.lastTally ? 3400 : 2300;
    sfx.drumroll(long / 1000 - 0.1);
    const beats = [0, 700, 1400].map((t) => setTimeout(() => haptic(30), t));
    const verdict = () => {
      setSuspense(false);
      if (round.nobodyVote) {
        if (correctNobody) {
          sfx.fanfare();
          emojiRain(['🧠', '🎉', '✨']);
          burst({ kind: 'confetti', colors: ['#39ff88', '#2ee6ff', '#fff', '#ffd23d'], count: 140 });
          flash('#39ff88', 500, 0.4);
        } else {
          sfx.impostor();
          flash('#ff2e4d', 600, 0.7);
          shake(20, 700);
          emojiRain(['😈', '🔪', '🫥']);
        }
      } else if (lastCaught.length) {
        sfx.impostor();
        emojiRain(['🎯', '🕵️', '🎉', '🔪'], 30);
        haptic([100, 50, 200]);
        flash('#ff2e4d', 600, 0.75);
        shake(22, 700);
        burst({ kind: 'sparks', colors: ['#ff2e4d', '#fff', '#ffb3c0'], count: 90, power: 1.4 });
      } else {
        sfx.stamp();
        setTimeout(() => sfx.fail(), 200);
        emojiRain(tie ? ['⚖️', '🤷', '❓'] : ['💀', '😬', '🫠'], 18);
        flash(tie ? '#ffd23d' : '#2ee6ff', 500, 0.4);
        shake(10, 400);
      }
    };
    afterCut.current = verdict;
    const t = setTimeout(() => {
      // Antes de saber si era el impostor: la animación de eliminación de cada acusado.
      const victims = !round.nobodyVote && elimFx ? lastVote.slice(0, 3) : [];
      if (victims.length) setCut(victims);
      else verdict();
    }, long);
    return () => {
      clearTimeout(t);
      beats.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.voteN, round.step === 'verdict']);

  // Efectos al llegar a "la verdad".
  useEffect(() => {
    if (round.step !== 'truth') return;
    if (escaped.length || (round.impostors.length === 0 && !round.nobodyVote)) {
      sfx.riser(0.8);
      const t = setTimeout(() => {
        sfx.impostor();
        flash(escaped.length ? '#ff2e4d' : '#7c5cff', 500, 0.6);
        shake(16, 500);
        burst({ kind: 'shards', colors: ['#ff2e4d', '#fff'], count: 50 });
        emojiRain(escaped.length ? ['😈', '🔪', '🩸'] : ['🫥', '😏'], 24);
      }, 800);
      return () => clearTimeout(t);
    }
    sfx.reveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.step]);

  const afterTruth = () => {
    if (judgments.length) return setStep('challenges');
    finishRound();
  };
  // Los impostores atrapados adivinan ANTES de ver la verdad (si no, ya sabrían la respuesta).
  const lastChance = guessersOf(round).length > 0 && !round.nobodyVote;
  const guessPicks = round.guessPicks ?? {};

  const allJudged = judgments.every((j) => (j.mission ? round.missionResults[j.player] : round.challengeResults[j.player]) !== undefined);

  const control = (node: ReactNode, waiting?: string) => (host ? node : <Waiting text={waiting} />);

  return (
    <div className="screen">
      <AnimatePresence>
        {cut && cut.length > 0 && (
          <EliminationCutscene
            key={`${round.voteN}-${cut[0]}`}
            player={P(cut[0])}
            style={elimFor(P(cut[0]).elim, `${round.n}-${round.voteN}-${cut[0]}`)}
            onDone={() => {
              const rest = cut.slice(1);
              setCut(rest.length ? rest : null);
              if (!rest.length) afterCut.current();
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {phase === 'suspense' && (
          <motion.div key={`s${round.voteN}`} className="grow center content" style={{ gap: 20 }} exit={{ opacity: 0, scale: 1.3 }}>
            {round.lastTally ? (
              <>
                <div className="label">Los votos dicen…</div>
                <TallyBars counts={round.lastTally.counts} players={players} />
              </>
            ) : (
              <>
                <div className="label">{round.nobodyVote ? 'Votaron que…' : 'Acusaron a…'}</div>
                <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 0.7 }} className="row" style={{ gap: 18 }}>
                  {round.nobodyVote ? (
                    <div style={{ fontSize: 110 }}>
                      <Emo e="🫥" />
                    </div>
                  ) : (
                    lastVote.map((id) => (
                      <div key={id} className="center" style={{ gap: 10 }}>
                        <Avatar player={P(id)} size={120} mood="scared" />
                        <b className="display" style={{ fontSize: 40 }}>
                          {P(id).name}
                        </b>
                      </div>
                    ))
                  )}
                </motion.div>
                {round.nobodyVote && <div className="h2">…no hay impostor</div>}
              </>
            )}
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.7 }} className="display" style={{ fontSize: 30 }}>
              {round.lastTally ? '¿A quién le tocó?' : '¿Es… el impostor?'}
            </motion.div>
          </motion.div>
        )}

        {phase === 'verdict' && (
          <motion.div key={`v${round.voteN}`} className="grow center content" style={{ gap: 22 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -60 }}>
            {round.nobodyVote ? (
              <>
                <div style={{ fontSize: 100 }}>
                  <Emo e={correctNobody ? '🎉' : '😈'} />
                </div>
                <Stamp tone={correctNobody ? 'good' : 'bad'} text={correctNobody ? '¡CORRECTO!' : '¡ERROR!'} />
                <div style={{ fontSize: 18, fontWeight: 700, maxWidth: 320 }}>
                  {correctNobody ? 'No había impostor. ¡Nadie los engañó!' : 'Sí había impostor… y se salió con la suya.'}
                </div>
              </>
            ) : tie ? (
              <>
                <div style={{ fontSize: 100 }}>
                  <Emo e="⚖️" anim="swing" />
                </div>
                <Stamp tone="neutral" text="¡EMPATE!" />
                <div style={{ fontSize: 18, fontWeight: 700, maxWidth: 320 }}>
                  {status.over ? 'No se pusieron de acuerdo… y eso le conviene a alguien.' : 'Nadie sale esta vez. Sigan discutiendo.'}
                </div>
              </>
            ) : (
              <div className="row" style={{ justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
                {lastVote.map((id, i) => (
                  <PlayerStamp key={id} player={P(id)} impostor={round.impostors.includes(id)} delay={i * 0.6} />
                ))}
              </div>
            )}
            {!status.over && !tie && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="panel center" style={{ gap: 6, maxWidth: 360 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>
                  {lastCaught.length
                    ? `¡Atraparon ${lastCaught.length > 1 ? `a ${lastCaught.length}` : 'a uno'}! Pero ${status.aliveImps === 1 ? 'todavía queda un impostor' : `todavía quedan ${status.aliveImps} impostores`}…`
                    : `💀 ${lastVote.map((id) => P(id).name).join(' y ')} queda fuera del juego`}
                </div>
                <div className="dim" style={{ fontSize: 13.5 }}>
                  Quedan {status.alive.length} jugadores. {round.declared > 1 && !round.hidden
                    ? status.aliveImps === 1
                      ? 'Falta 1 impostor por atrapar…'
                      : `Faltan ${status.aliveImps} impostores por atrapar…`
                    : 'El impostor sigue entre ustedes…'}
                </div>
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} style={{ width: '100%' }}>
              {control(
                status.over ? (
                  lastChance ? (
                    <Button
                      onClick={() => {
                        sfx.whoosh();
                        setStep('guess');
                      }}
                    >
                      🎯 Última oportunidad {guessersOf(round).length > 1 ? 'de los impostores' : 'del impostor'}
                    </Button>
                  ) : (
                    <Button onClick={() => setStep('truth')}>Ver la verdad 👁️</Button>
                  )
                ) : (
                  <Button
                    onClick={() => {
                      sfx.whoosh();
                      continueRound();
                    }}
                  >
                    🔎 Seguir buscando
                  </Button>
                ),
              )}
            </motion.div>
          </motion.div>
        )}

        {phase === 'truth' && (
          <motion.div key="t" className="grow stack content" style={{ gap: 12, minHeight: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="scroll stack" style={{ gap: 12, justifyContent: 'safe center' }}>
            {round.impostors.length === 0 ? (
              <div className="center" style={{ gap: 6 }}>
                <div className="h1">
                  <Glitch text="¡NO HABÍA IMPOSTOR!" hard />
                </div>
                <div className="dim">Todos tenían la misma carta. 😏</div>
              </div>
            ) : (
              <div className="center" style={{ gap: 10 }}>
                <div className="label">{round.impostors.length > 1 ? 'Los impostores eran' : 'El impostor era'}</div>
                <div className="row" style={{ gap: avatarSize > 50 ? 16 : 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {round.impostors.map((id, i) => (
                    <motion.div
                      key={id}
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.8 + i * 0.2, type: 'spring', stiffness: 300, damping: 12 }}
                      className="center"
                      style={{ gap: 6 }}
                    >
                      <Avatar player={P(id)} size={avatarSize} mood={round.accused.includes(id) ? 'scared' : 'happy'} style={{ boxShadow: '0 0 0 4px #ff2e4d, 0 0 40px #ff2e4d' }} />
                      <b className="display" style={{ fontSize: avatarSize > 50 ? 30 : 20, color: round.accused.includes(id) ? '#ff5470' : '#fff' }}>
                        {P(id).name}
                      </b>
                    </motion.div>
                  ))}
                </div>
                {round.team && <div className="chip" style={{ borderColor: '#ff2e4d' }}>👥 Jugaban en equipo</div>}
                {status.impParity && round.elimination && innocentsOut.length > 0 && (
                  <div style={{ fontWeight: 800, color: '#ff5470' }}>
                    ¡Solo quedaban {status.alive.length}! {status.aliveImps > 1 ? 'Los impostores ya eran mayoría.' : 'El impostor ya no podía perder.'}
                  </div>
                )}
                {innocentsOut.length > 0 && (
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span className="dim" style={{ fontSize: 12 }}>
                      Inocentes eliminados:
                    </span>
                    {innocentsOut.map((id) => (
                      <span key={id} className="chip">
                        💀 <b>{P(id).name}</b>
                      </span>
                    ))}
                  </div>
                )}
                {round.event === 'blind' && <div className="dim">…¡y ni siquiera sabía que era el impostor! 🙈</div>}
              </div>
            )}

            <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {revealed && (
                <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1 }} className="chip" style={{ borderColor: revealed.color }}>
                  ❓ El evento secreto era: {revealed.emoji} <b>{revealed.title}</b>
                </motion.div>
              )}
              {round.accomplice && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="chip" style={{ borderColor: '#ff8a3d' }}>
                  🤝 Su cómplice era <Avatar player={P(round.accomplice)} size={22} /> <b>{P(round.accomplice).name}</b>
                </motion.div>
              )}
              {round.jester && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }} className="chip" style={{ borderColor: '#ff5fc8' }}>
                  🃏 El bufón era <Avatar player={P(round.jester)} size={22} /> <b>{P(round.jester).name}</b> {jesterWon ? '· ¡y cayeron!' : '· no lo logró'}
                </motion.div>
              )}
              {round.detective && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }} className="chip" style={{ borderColor: '#39ff88' }}>
                  🔎 El detective era <Avatar player={P(round.detective)} size={22} /> <b>{P(round.detective).name}</b>
                </motion.div>
              )}
              {caught
                .filter((id) => guessPicks[id])
                .map((id, i) => (
                  <motion.div key={id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 + i * 0.1 }} className="chip" style={{ borderColor: round.guessed[id] ? '#39ff88' : '#ff5470' }}>
                    🎯 <b>{P(id).name}</b> {round.guessed[id] ? `adivinó la carta · +${PTS.impGuess}` : `eligió ${BY_ID[guessPicks[id]]?.name ?? '?'}`}
                  </motion.div>
                ))}
            </div>

            {decoyCards.length <= 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: round.impostors.length ? '1fr auto 1fr' : '1fr', alignItems: 'center', gap: 8, maxWidth: 420, margin: '0 auto', width: '100%' }}>
                <MiniCard item={civil} cat={round.cat} label="Civiles" color="#2ee6ff" delay={1.1} style={round.impostors.length ? undefined : { maxWidth: 220, margin: '0 auto' }} />
                {round.impostors.length > 0 && (
                  <>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.5, type: 'spring' }} className="display" style={{ fontSize: 34 }}>
                      VS
                    </motion.div>
                    <MiniCard item={decoy} cat={decoy?.cat ?? round.cat} label={round.impostors.length > 1 ? 'Impostores' : 'Impostor'} color="#ff2e4d" delay={1.3} />
                  </>
                )}
              </div>
            ) : (
              <div className="stack" style={{ gap: 8, maxWidth: 420, margin: '0 auto', width: '100%' }}>
                <MiniCard item={civil} cat={round.cat} label="Civiles" color="#2ee6ff" delay={1.1} style={{ width: '48%', margin: '0 auto' }} />
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.4, type: 'spring' }} className="display center" style={{ fontSize: 28 }}>
                  VS
                </motion.div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${decoyCards.length > 4 ? 3 : 2}, minmax(0, 1fr))`, gap: 8 }}>
                  {decoyCards.map((d, i) => (
                    <MiniCard key={d.item.id} item={d.item} cat={d.item.cat} label={d.who.map((id) => P(id).name).join(', ')} color="#ff2e4d" delay={1.5 + i * 0.12} />
                  ))}
                </div>
              </div>
            )}
            {round.level && decoyCards.length <= 1 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }} className="center dim" style={{ fontWeight: 800 }}>
                Similitud: {LEVEL_TXT[round.level]}
              </motion.div>
            )}
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}>
              {control(
                <Button onClick={afterTruth}>{judgments.length ? '🎭 Revisar eventos y misiones' : '🏆 Ver puntuación'}</Button>,
              )}
            </motion.div>
          </motion.div>
        )}

        {phase === 'guess' && <LastChance key={`g${round.guessIdx}`} options={options} />}

        {phase === 'challenges' && (
          <motion.div key="c" className="grow stack content" style={{ gap: 12, minHeight: 0 }} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
            <div className="h2">🎭 ¿Lo lograron?</div>
            <div className="dim" style={{ fontSize: 13 }}>
              Misión secreta: +{PTS.missionDone} si la cumplió, {PTS.missionFail} si no. Evento: +{PTS.challengeDone} / {PTS.challengeFail}. Decidan entre todos.
            </div>
            <div className="scroll stack" style={{ gap: 10 }}>
              {judgments.map((j, i) => {
                const ch = CH_BY_ID[j.id];
                const meta = j.mission ? { emoji: '🤫', label: 'Misión secreta', color: '#c9a2ff' } : KIND_META[ch.kind];
                const res = j.mission ? round.missionResults[j.player] : round.challengeResults[j.player];
                return (
                  <motion.div
                    key={`${j.player}-${j.id}`}
                    initial={{ opacity: 0, rotateX: -80 }}
                    animate={{ opacity: 1, rotateX: 0 }}
                    transition={{ delay: i * 0.12, type: 'spring', stiffness: 220, damping: 20 }}
                    className="panel stack"
                    style={{ gap: 10, borderColor: meta.color + '88' }}
                  >
                    <div className="row">
                      <Avatar player={P(j.player)} size={34} />
                      <b className="grow">{P(j.player).name}</b>
                      <span className="label" style={{ color: meta.color }}>
                        {meta.emoji} {meta.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.4 }}>{ch.text}</div>
                    <div className="row" style={{ gap: 8 }}>
                      {[true, false].map((ok) => (
                        <motion.button
                          key={String(ok)}
                          whileTap={host ? { scale: 0.92 } : undefined}
                          disabled={!host}
                          onClick={() => {
                            (j.mission ? setMissionResult : setChallengeResult)(j.player, ok);
                            if (ok) {
                              sfx.coin();
                              burst({ kind: 'sparks', count: 20, colors: ['#39ff88', '#fff'] });
                            } else sfx.fail();
                          }}
                          className="panel grow"
                          style={{
                            padding: 10,
                            fontWeight: 800,
                            opacity: !host && res !== ok ? 0.4 : 1,
                            borderColor: res === ok ? (ok ? '#39ff88' : '#ff2e4d') : undefined,
                            background: res === ok ? (ok ? 'rgba(57,255,136,.18)' : 'rgba(255,46,77,.18)') : undefined,
                          }}
                        >
                          {ok ? '✅ Cumplió' : '❌ No cumplió'}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {control(
              <Button onClick={() => finishRound()}>{allJudged ? '🏆 Ver puntuación' : '🏆 Ver puntuación (lo demás no cuenta)'}</Button>,
              'El anfitrión marca quién cumplió…',
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerStamp({ player, impostor, delay }: { player: Player; impostor: boolean; delay: number }) {
  return (
    <div className="center" style={{ gap: 12 }}>
      <motion.div initial={{ scale: 1.4 }} animate={{ scale: 1, filter: impostor ? 'none' : 'grayscale(.6)' }} transition={{ delay }}>
        <Avatar player={player} size={96} mood={impostor ? 'scared' : undefined} still={!impostor} />
      </motion.div>
      <b className="display" style={{ fontSize: 34 }}>
        {player.name}
      </b>
      <Stamp tone={impostor ? 'bad' : 'good'} text={impostor ? 'IMPOSTOR' : 'INOCENTE'} delay={delay + 0.15} />
    </div>
  );
}
