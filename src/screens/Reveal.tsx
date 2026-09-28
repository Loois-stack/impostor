import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { MiniCard } from '../components/MiniCard';
import { Avatar, Button, Glitch } from '../components/ui';
import { BY_ID, decoyCandidates } from '../data';
import { CHALLENGES, KIND_META } from '../data/challenges';
import { makeRng } from '../engine/rng';
import { burst, flash, shake } from '../fx/fx';
import { useGame, type Player } from '../store/game';

type Phase = 'suspense' | 'verdict' | 'truth' | 'guess' | 'challenges';

const LEVEL_TXT = { 1: '🔥 Casi idénticas', 2: '⚖️ Parecidas', 3: '🎲 Lejanas' } as const;

function Stamp({ good, text, delay = 0 }: { good: boolean; text: string; delay?: number }) {
  return (
    <motion.div
      initial={{ scale: 4, opacity: 0, rotate: -25 }}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      transition={{ delay, type: 'spring', stiffness: 500, damping: 18 }}
      className="display"
      style={{
        fontSize: 'clamp(44px, 14vw, 64px)',
        padding: '4px 18px',
        border: `5px solid ${good ? '#ff2e4d' : '#2ee6ff'}`,
        color: good ? '#ff2e4d' : '#2ee6ff',
        borderRadius: 14,
        textShadow: `0 0 24px ${good ? '#ff2e4d' : '#2ee6ff'}`,
        boxShadow: `0 0 40px ${good ? '#ff2e4d55' : '#2ee6ff55'}, inset 0 0 20px ${good ? '#ff2e4d33' : '#2ee6ff33'}`,
        background: 'rgba(0,0,0,.4)',
      }}
    >
      {text}
    </motion.div>
  );
}

export function Reveal() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const { setGuess, setChallengeResult, finishRound } = useGame();
  const [phase, setPhase] = useState<Phase>('suspense');
  const [guessIdx, setGuessIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const P = (id: string) => players.find((p) => p.id === id)!;
  const civil = BY_ID[round.civil];
  const decoy = round.decoy ? BY_ID[round.decoy] : null;
  const caught = round.impostors.filter((i) => round.accused.includes(i));
  const escaped = round.impostors.filter((i) => !round.accused.includes(i));
  const challengePlayers = Object.keys(round.challenges);
  const correctNobody = round.nobodyVote && round.impostors.length === 0;

  const options = useMemo(() => {
    const rng = makeRng(round.n * 7919 + round.civil.length);
    const c = decoyCandidates(civil);
    const pool = [...rng.shuffle(c[1]), ...rng.shuffle(c[2]), ...rng.shuffle(c[3])].filter((i) => i.id !== round.decoy);
    return rng.shuffle([civil, ...pool.slice(0, 5)]);
  }, [round.n, round.civil, round.decoy, civil]);

  // Suspenso -> veredicto
  useEffect(() => {
    if (phase !== 'suspense') return;
    sfx.drumroll(2.2);
    const beats = [0, 700, 1400].map((t) => setTimeout(() => haptic(30), t));
    const t = setTimeout(() => {
      setPhase('verdict');
      if (round.nobodyVote) {
        if (correctNobody) {
          sfx.fanfare();
          burst({ kind: 'confetti', colors: ['#39ff88', '#2ee6ff', '#fff', '#ffd23d'], count: 140 });
          flash('#39ff88', 500, 0.4);
        } else {
          sfx.impostor();
          flash('#ff2e4d', 600, 0.7);
          shake(20, 700);
        }
      } else if (caught.length) {
        sfx.impostor();
        haptic([100, 50, 200]);
        flash('#ff2e4d', 600, 0.75);
        shake(22, 700);
        burst({ kind: 'sparks', colors: ['#ff2e4d', '#fff', '#ffb3c0'], count: 90, power: 1.4 });
      } else {
        sfx.stamp();
        setTimeout(() => sfx.fail(), 200);
        flash('#2ee6ff', 500, 0.4);
        shake(10, 400);
      }
    }, 2300);
    return () => {
      clearTimeout(t);
      beats.forEach(clearTimeout);
    };
  }, [phase, caught.length, correctNobody, round.nobodyVote]);

  const goTruth = () => {
    setPhase('truth');
    if (escaped.length || (round.impostors.length === 0 && !round.nobodyVote)) {
      sfx.riser(0.8);
      setTimeout(() => {
        sfx.impostor();
        flash(escaped.length ? '#ff2e4d' : '#7c5cff', 500, 0.6);
        shake(16, 500);
        burst({ kind: 'shards', colors: ['#ff2e4d', '#fff'], count: 50 });
      }, 800);
    } else {
      sfx.reveal();
    }
  };

  const afterTruth = () => {
    if (caught.length && !round.nobodyVote) return setPhase('guess');
    if (challengePlayers.length) return setPhase('challenges');
    finishRound();
  };

  const guesser = caught[guessIdx];
  const onGuess = (id: string) => {
    if (picked) return;
    setPicked(id);
    const ok = id === civil.id;
    setGuess(guesser, ok);
    if (ok) {
      sfx.fanfare();
      burst({ kind: 'confetti', colors: ['#ff2e4d', '#ffd23d', '#fff'], count: 120 });
      haptic([40, 40, 40, 40, 120]);
    } else {
      sfx.fail();
      shake(12, 400);
      haptic([200]);
    }
  };
  const nextGuess = () => {
    setPicked(null);
    if (guessIdx + 1 < caught.length) setGuessIdx(guessIdx + 1);
    else if (challengePlayers.length) setPhase('challenges');
    else finishRound();
  };

  const verdictList = (list: string[]) => (
    <div className="row" style={{ justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
      {list.map((id, i) => (
        <PlayerStamp key={id} player={P(id)} good={round.impostors.includes(id)} delay={i * 0.6} />
      ))}
    </div>
  );

  return (
    <div className="screen">
      <AnimatePresence mode="wait">
        {phase === 'suspense' && (
          <motion.div key="s" className="grow center content" style={{ gap: 20 }} exit={{ opacity: 0, scale: 1.3 }}>
            <div className="label">{round.nobodyVote ? 'Votaron que…' : 'Acusaron a…'}</div>
            <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 0.7 }} className="row" style={{ gap: 18 }}>
              {round.nobodyVote ? (
                <div style={{ fontSize: 110 }}>🫥</div>
              ) : (
                round.accused.map((id) => (
                  <div key={id} className="center" style={{ gap: 10 }}>
                    <Avatar player={P(id)} size={120} />
                    <b className="display" style={{ fontSize: 40 }}>
                      {P(id).name}
                    </b>
                  </div>
                ))
              )}
            </motion.div>
            {round.nobodyVote && <div className="h2">…no hay impostor</div>}
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.7 }} className="display" style={{ fontSize: 30 }}>
              ¿Es… el impostor?
            </motion.div>
          </motion.div>
        )}

        {phase === 'verdict' && (
          <motion.div key="v" className="grow center content" style={{ gap: 24 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -60 }}>
            {round.nobodyVote ? (
              <>
                <div style={{ fontSize: 100 }}>{correctNobody ? '🎉' : '😈'}</div>
                <Stamp good={!correctNobody} text={correctNobody ? '¡CORRECTO!' : '¡ERROR!'} />
                <div style={{ fontSize: 18, fontWeight: 700, maxWidth: 320 }}>
                  {correctNobody ? 'No había impostor. ¡Nadie los engañó!' : 'Sí había impostor… y se salió con la suya.'}
                </div>
              </>
            ) : (
              verdictList(round.accused)
            )}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} style={{ width: '100%' }}>
              <Button onClick={goTruth}>Ver la verdad 👁️</Button>
            </motion.div>
          </motion.div>
        )}

        {phase === 'truth' && (
          <motion.div key="t" className="grow stack content" style={{ gap: 14, justifyContent: 'center' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                <div className="row" style={{ gap: 16, justifyContent: 'center' }}>
                  {round.impostors.map((id, i) => (
                    <motion.div
                      key={id}
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.8 + i * 0.2, type: 'spring', stiffness: 300, damping: 12 }}
                      className="center"
                      style={{ gap: 6 }}
                    >
                      <Avatar player={P(id)} size={76} style={{ boxShadow: '0 0 0 4px #ff2e4d, 0 0 40px #ff2e4d' }} />
                      <b className="display" style={{ fontSize: 30, color: '#ff5470' }}>
                        {P(id).name}
                      </b>
                    </motion.div>
                  ))}
                </div>
                {round.event === 'blind' && <div className="dim">…¡y ni siquiera sabía que era el impostor! 🙈</div>}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: round.impostors.length ? '1fr auto 1fr' : '1fr', alignItems: 'center', gap: 8, maxWidth: 420, margin: '0 auto', width: '100%' }}>
              <MiniCard item={civil} cat={round.cat} label="Civiles" color="#2ee6ff" delay={1.1} style={round.impostors.length ? undefined : { maxWidth: 220, margin: '0 auto' }} />
              {round.impostors.length > 0 && (
                <>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.5, type: 'spring' }} className="display" style={{ fontSize: 34 }}>
                    VS
                  </motion.div>
                  <MiniCard item={decoy} cat={decoy?.cat ?? round.cat} label="Impostor" color="#ff2e4d" delay={1.3} />
                </>
              )}
            </div>
            {round.level && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }} className="center dim" style={{ fontWeight: 800 }}>
                Similitud: {LEVEL_TXT[round.level]}
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}>
              <Button onClick={afterTruth}>
                {caught.length && !round.nobodyVote ? '🎯 Última oportunidad del impostor' : challengePlayers.length ? '🎭 Revisar retos' : '🏆 Ver puntuación'}
              </Button>
            </motion.div>
          </motion.div>
        )}

        {phase === 'guess' && guesser && (
          <motion.div key={`g${guessIdx}`} className="grow stack content" style={{ gap: 12 }} initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -80 }}>
            <div className="row" style={{ gap: 12 }}>
              <Avatar player={P(guesser)} size={48} />
              <div>
                <div className="label">Dale el teléfono a {P(guesser).name}</div>
                <div className="h2" style={{ fontSize: 28 }}>
                  ¿Cuál era la carta de los civiles?
                </div>
              </div>
            </div>
            <div className="dim" style={{ fontSize: 13 }}>
              Si adivina, gana +150 aunque lo hayan atrapado.
            </div>
            <div className="scroll">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                {options.map((o, i) => (
                  <MiniCard
                    key={o.id}
                    item={o}
                    cat={o.cat}
                    delay={i * 0.06}
                    onClick={picked ? undefined : () => onGuess(o.id)}
                    state={picked ? (o.id === civil.id ? 'right' : o.id === picked ? 'wrong' : 'dim') : undefined}
                  />
                ))}
              </div>
            </div>
            {picked && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="stack" style={{ gap: 10 }}>
                <div className="center display" style={{ fontSize: 34, color: picked === civil.id ? '#39ff88' : '#ff2e4d' }}>
                  {picked === civil.id ? '¡ADIVINÓ! +150' : '¡FALLÓ!'}
                </div>
                <Button onClick={nextGuess}>Continuar ➜</Button>
              </motion.div>
            )}
          </motion.div>
        )}

        {phase === 'challenges' && (
          <motion.div key="c" className="grow stack content" style={{ gap: 12 }} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
            <div className="h2">🎭 ¿Cumplieron sus retos?</div>
            <div className="dim" style={{ fontSize: 13 }}>
              +50 si lo cumplió, −25 si no. Los retos secretos ya se pueden revelar.
            </div>
            <div className="scroll stack" style={{ gap: 10 }}>
              {challengePlayers.map((pid, i) => {
                const ch = CHALLENGES.find((c) => c.id === round.challenges[pid])!;
                const meta = KIND_META[ch.kind];
                const res = round.challengeResults[pid];
                return (
                  <motion.div key={pid} {...{ initial: { opacity: 0, x: -30 }, animate: { opacity: 1, x: 0 }, transition: { delay: i * 0.08 } }} className="panel stack" style={{ gap: 10, borderColor: meta.color + '88' }}>
                    <div className="row">
                      <Avatar player={P(pid)} size={34} />
                      <b className="grow">{P(pid).name}</b>
                      <span className="label" style={{ color: meta.color }}>
                        {meta.emoji} {meta.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.4 }}>{ch.secret ? `🤫 ${ch.text.replace(/^SECRETO:\s*/, '')}` : ch.text}</div>
                    <div className="row" style={{ gap: 8 }}>
                      {[true, false].map((ok) => (
                        <motion.button
                          key={String(ok)}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => {
                            setChallengeResult(pid, ok);
                            if (ok) {
                              sfx.coin();
                              burst({ kind: 'sparks', count: 20, colors: ['#39ff88', '#fff'] });
                            } else sfx.fail();
                          }}
                          className="panel grow"
                          style={{
                            padding: 10,
                            fontWeight: 800,
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
            <Button onClick={() => finishRound()}>🏆 Ver puntuación</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerStamp({ player, good, delay }: { player: Player; good: boolean; delay: number }) {
  return (
    <div className="center" style={{ gap: 12 }}>
      <motion.div initial={{ scale: 1.4 }} animate={{ scale: 1, filter: good ? 'none' : 'grayscale(.6)' }} transition={{ delay }}>
        <Avatar player={player} size={96} />
      </motion.div>
      <b className="display" style={{ fontSize: 34 }}>
        {player.name}
      </b>
      <Stamp good={good} text={good ? 'IMPOSTOR' : 'INOCENTE'} delay={delay + 0.15} />
    </div>
  );
}
