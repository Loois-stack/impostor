import { AnimatePresence, motion } from 'framer-motion';
import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { setVibration, sfx, type MusicMood } from './audio/sfx';
import { ConnectionLost } from './components/ConnectionLost';
import { LeaveFab } from './components/LeaveGame';
import { VoiceFab } from './components/Voice';
import { JoinNotice } from './components/Spectate';
import { screenAnim } from './components/ui';
import { CAT } from './data/categories';
import { THEME_BY_ID } from './data/themes';
import { Backdrop, type Mood } from './fx/Backdrop';
import { FxLayer } from './fx/fx';
import { ReactionLayer } from './fx/reactions';
import { RainLayer, ReactFab, Scene, SceneCard, sceneFor, type SceneTitle } from './fx/scene';
import { SKINS, skinVars } from './fx/skins';
import { inviteOnce, react } from './net/net';
import { useNet } from './net/state';
import { Awards } from './screens/Awards';
import { Custom } from './screens/Custom';
import { Deal } from './screens/Deal';
import { Discuss } from './screens/Discuss';
import { Events } from './screens/Events';
import { Home } from './screens/Home';
import { HowTo } from './screens/HowTo';
import { Intro } from './screens/Intro';
import { Lobby } from './screens/Lobby';
import { Online } from './screens/Online';
import { Players } from './screens/Players';
import { Reveal } from './screens/Reveal';
import { Score } from './screens/Score';
import { SettingsScreen } from './screens/Settings';
import { Setup } from './screens/Setup';
import { Vote } from './screens/Vote';
import { applyUpdate, useUpdate } from './services/update';
import { keepAwake } from './services/wake';
import { IN_ROUND, useGame, type Screen } from './store/game';
import { usePrefs } from './store/prefs';

const SCREENS: Record<Screen, () => React.JSX.Element | null> = {
  home: Home,
  players: Players,
  setup: Setup,
  intro: Intro,
  deal: Deal,
  discuss: Discuss,
  vote: Vote,
  reveal: Reveal,
  score: Score,
  settings: SettingsScreen,
  howto: HowTo,
  custom: Custom,
  awards: Awards,
  events: Events,
  online: Online,
  lobby: Lobby,
};

/** Pantallas donde se puede reaccionar con emojis. */
const REACT_ON: Screen[] = ['discuss', 'vote', 'reveal', 'score', 'awards', 'lobby'];

/** En sala, pantallas de la partida con botón para salir (las pistas lo tienen en su menú). */
const LEAVE_ON: Screen[] = ['intro', 'deal', 'vote', 'reveal'];
/** Sala: la llamada de voz está a la mano en la sala de espera y en toda la partida. */
const VOICE_ON: Screen[] = ['lobby', 'intro', 'deal', 'discuss', 'vote', 'reveal', 'score', 'awards'];

/** Pantallas que necesitan una ronda en curso para dibujarse. */
const NEEDS_ROUND: Screen[] = [...IN_ROUND, 'score'];

/**
 * Red de seguridad para cada pantalla. Al salir de una sala, la partida se borra mientras la
 * pantalla anterior todavía hace su animación de salida: si esa pantalla falla, se deja de
 * dibujar en vez de tumbar toda la app.
 */
class ScreenGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    // Sin ronda es lo esperado (la pantalla iba de salida); cualquier otro error sí se reporta.
    if (useGame.getState().round) console.error(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Una pantalla de ronda deja de dibujarse en cuanto ya no hay ronda (p. ej. al salir de la sala). */
function RoundOnly({ children }: { children: ReactNode }) {
  const round = useGame((s) => s.round);
  return round ? children : null;
}

/** Aviso fijo cuando se cae la conexión con la sala. */
function NetBanner() {
  const status = useNet((s) => s.status);
  const role = useNet((s) => s.role);
  const show = role !== 'off' && (status === 'reconnecting' || status === 'connecting');
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="net-banner" initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}>
          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} style={{ display: 'inline-block' }}>
            📡
          </motion.span>
          {status === 'connecting' ? 'Conectando con la sala…' : 'Se cortó la conexión. Reconectando…'}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Pantallas donde se puede recargar sin cortar una ronda. */
const CALM: Screen[] = ['home', 'players', 'setup', 'settings', 'howto', 'custom', 'events', 'online', 'lobby', 'score', 'awards'];

/**
 * Aviso de versión nueva. En el menú se instala sola; en la sala o el marcador se ofrece un
 * botón (recargar reconecta solo). A media ronda espera a que termine.
 */
function UpdateBanner({ screen, online }: { screen: Screen; online: boolean }) {
  const { ready, applying } = useUpdate();
  const calm = CALM.includes(screen);
  const auto = calm && !online && (screen === 'home' || screen === 'settings' || screen === 'howto');
  useEffect(() => {
    if (!ready || !auto) return;
    const t = setTimeout(applyUpdate, 1800);
    return () => clearTimeout(t);
  }, [ready, auto]);
  return (
    <AnimatePresence>
      {ready && calm && (
        <motion.div className="update-banner" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}>
          <span style={{ fontSize: 22 }}>✨</span>
          <span className="grow">
            <b>{applying || auto ? 'Actualizando el juego…' : 'Hay una versión nueva'}</b>
            {!applying && !auto && <small>Tarda un segundo. {online ? 'La sala se reconecta sola.' : 'No se pierde nada.'}</small>}
          </span>
          {!applying && !auto && (
            <button className="update-btn" onClick={applyUpdate}>
              Actualizar
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function App() {
  const screen = useGame((s) => s.screen);
  const round = useGame((s) => s.round);
  const online = useGame((s) => s.online);
  const { sound, vibration, music, skin } = usePrefs();
  const sk = SKINS[skin];

  useEffect(() => {
    sfx.enabled = sound;
    sfx.musicOn = music;
    if (!sound) sfx.stopDrone();
    sfx.applyMusic();
  }, [sound, music]);
  useEffect(() => {
    setVibration(vibration);
  }, [vibration]);

  // El audio solo puede arrancar tras un gesto del usuario.
  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    return () => window.removeEventListener('pointerdown', unlock, { capture: true });
  }, []);

  const inRound = IN_ROUND.includes(screen);
  // La pantalla no se apaga mientras se juega (ni en la sala, donde se perdería la conexión).
  useEffect(() => {
    keepAwake(inRound || online);
  }, [inRound, online]);

  // En la ruleta no se tiñe el fondo: delataría la categoría antes de que aterrice.
  const showCat = round && inRound && screen !== 'intro';
  const theme = showCat && round.theme ? THEME_BY_ID[round.theme] : undefined;
  // En Mezcla los colores y el ambiente dependen del tema, nunca de la carta civil (delataría su categoría).
  const cat = !showCat ? null : theme ? { color: theme.color, color2: '#2a1a4a', horror: !!theme.horror } : CAT[round.cat];
  const horror = !!cat?.horror || round?.event === 'terror';

  useEffect(() => {
    if (horror && inRound && screen !== 'intro') sfx.startDrone();
    else sfx.stopDrone();
  }, [horror, inRound, screen]);

  const mood: Mood = screen === 'vote' ? 'danger' : horror && inRound ? 'horror' : 'calm';

  // Pista musical según la fase. En la ruleta y la revelación manda el efecto dramático.
  const musicMood: MusicMood | null =
    screen === 'intro' || screen === 'reveal' ? null : screen === 'vote' ? 'tension' : inRound ? (horror ? 'horror' : 'game') : 'menu';
  useEffect(() => {
    sfx.setMusic(musicMood);
  }, [musicMood]);

  // Se abrió con el enlace de una sala: a entrar, salvo que haya una ronda en juego en este teléfono.
  useEffect(() => {
    const g = useGame.getState();
    if (!g.online && !IN_ROUND.includes(g.screen) && inviteOnce()) g.go('online');
  }, []);

  // Una pantalla de ronda sin ronda (p. ej. un invitado que recarga) cae al menú o a la sala.
  const safe: Screen = NEEDS_ROUND.includes(screen) && !round ? (online ? 'lobby' : 'home') : screen;
  const Current = SCREENS[safe] ?? Home;

  // Escena de fondo: según la fase, la categoría (ya revelada) o el evento de la ronda.
  const scene = sceneFor({
    screen: safe,
    cat: showCat && !theme ? round.cat : undefined,
    themeEmoji: theme?.emoji,
    event: showCat && round.event && !round.hidden ? round.event : undefined,
  });

  // Título que barre la pantalla al entrar a una fase nueva.
  const [title, setTitle] = useState<SceneTitle | null>(null);
  const prev = useRef<Screen>(safe);
  useEffect(() => {
    const from = prev.current;
    prev.current = safe;
    if (from === safe || !round) return;
    const t: Omit<SceneTitle, 'key'> | null =
      safe === 'discuss' && from === 'deal'
        ? { text: '¡A dar pistas!', emoji: '🗣️', color: cat?.color ?? sk.c1 }
        : safe === 'discuss' && from === 'reveal'
          ? { text: '¡Sigan buscando!', emoji: '🔎', color: '#ffb547' }
          : safe === 'vote'
            ? { text: '¡A votar!', emoji: '🗳️', color: '#ff2e4d' }
            : safe === 'score'
              ? { text: 'Resultados', emoji: '🏆', color: '#d9a400' }
              : null;
    if (!t) return;
    setTitle({ ...t, key: `${safe}-${round.n}-${round.talks}-${round.voteN}` });
    const id = setTimeout(() => setTitle(null), 1400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safe]);
  const c1 = cat?.color ?? sk.c1;
  const c2 = cat?.color2 ?? sk.c2;

  return (
    <div className={`app skin-${skin}`} style={{ ...skinVars(skin), '--accent': cat?.color ?? sk.c1, '--accent2': cat?.color2 ?? sk.c2 } as CSSProperties}>
      <Backdrop c1={c1} c2={c2} mood={mood} skin={skin} />
      <Scene emojis={scene} faint={!inRound && safe !== 'score' && safe !== 'awards'} />
      <AnimatePresence mode="wait">
        {/* Cada ronda nueva vuelve a montar la ruleta, aunque ya se estuviera en ella. */}
        <motion.div key={safe === 'intro' ? `intro-${round?.n}-${round?.civil}` : safe} {...screenAnim} style={{ position: 'absolute', inset: 0 }}>
          <ScreenGuard>
            {NEEDS_ROUND.includes(safe) ? (
              <RoundOnly>
                <Current />
              </RoundOnly>
            ) : (
              <Current />
            )}
          </ScreenGuard>
        </motion.div>
      </AnimatePresence>
      {online && LEAVE_ON.includes(safe) && <LeaveFab />}
      {online && VOICE_ON.includes(safe) && <VoiceFab />}
      <NetBanner />
      <ConnectionLost />
      {online && <JoinNotice />}
      <UpdateBanner screen={safe} online={online} />
      <SceneCard title={title} />
      {REACT_ON.includes(safe) && (safe !== 'lobby' || online) && <ReactFab key={safe} onReact={react} />}
      <ReactionLayer />
      <RainLayer />
      <FxLayer />
    </div>
  );
}
