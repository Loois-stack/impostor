import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type CSSProperties } from 'react';
import { setVibration, sfx, type MusicMood } from './audio/sfx';
import { screenAnim } from './components/ui';
import { CAT } from './data/categories';
import { THEME_BY_ID } from './data/themes';
import { Backdrop, type Mood } from './fx/Backdrop';
import { FxLayer } from './fx/fx';
import { Awards } from './screens/Awards';
import { Custom } from './screens/Custom';
import { Deal } from './screens/Deal';
import { Discuss } from './screens/Discuss';
import { Home } from './screens/Home';
import { HowTo } from './screens/HowTo';
import { Intro } from './screens/Intro';
import { Players } from './screens/Players';
import { Reveal } from './screens/Reveal';
import { Score } from './screens/Score';
import { SettingsScreen } from './screens/Settings';
import { Setup } from './screens/Setup';
import { Vote } from './screens/Vote';
import { useGame, type Screen } from './store/game';

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
};

const IN_ROUND: Screen[] = ['intro', 'deal', 'discuss', 'vote', 'reveal'];

export function App() {
  const screen = useGame((s) => s.screen);
  const round = useGame((s) => s.round);
  const sound = useGame((s) => s.settings.sound);
  const vibration = useGame((s) => s.settings.vibration);
  const music = useGame((s) => s.settings.music);

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

  // En la ruleta no se tiñe el fondo: delataría la categoría antes de que aterrice.
  const showCat = round && IN_ROUND.includes(screen) && screen !== 'intro';
  const theme = showCat && round.theme ? THEME_BY_ID[round.theme] : undefined;
  // En Mezcla los colores y el ambiente dependen del tema, nunca de la carta civil (delataría su categoría).
  const cat = !showCat ? null : theme ? { color: theme.color, color2: '#2a1a4a', horror: !!theme.horror } : CAT[round.cat];
  const horror = !!cat?.horror || round?.event === 'terror';
  const inRound = IN_ROUND.includes(screen);

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
  const Current = SCREENS[screen] ?? Home;

  return (
    <div className="app" style={{ '--accent': cat?.color ?? '#7c5cff', '--accent2': cat?.color2 ?? '#2ee6ff' } as CSSProperties}>
      <Backdrop c1={cat?.color ?? '#7c5cff'} c2={cat?.color2 ?? '#ff2e4d'} mood={mood} />
      <AnimatePresence mode="wait">
        <motion.div key={screen} {...screenAnim} style={{ position: 'absolute', inset: 0 }}>
          <Current />
        </motion.div>
      </AnimatePresence>
      <FxLayer />
    </div>
  );
}
