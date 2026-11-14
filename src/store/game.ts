import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CATEGORIES, HORROR_CATS } from '../data/categories';
import { CH_BY_ID, type ChallengeKind } from '../data/challenges';
import { BY_ID, CUSTOM_GROUP, playable, setCustomItems } from '../data';
import type { CategoryId, Item, Level } from '../data/types';
import { ACHIEVEMENTS, emptyStats, type Stats } from '../engine/achievements';
import { dealMissions, INTENSITY, maybeChallenge, type ChallengeState, type Intensity } from '../engine/challenges';
import { CURSED_WORDS, MX_ACCENTS, rollEvent, rollHidden, type EventId, type Hidden } from '../engine/events';
import { makeRng } from '../engine/rng';
import { pickImpostors, turnOrder } from '../engine/roles';
import { levelFromXp, scoreRound, streakMult, type ScoreLine, type Winner } from '../engine/scoring';
import { commitRound, emptyHistory, pickCategory, pickCivil, pickDecoy, pickFromTheme, pickTheme, type History, type Similarity } from '../engine/selector';
import { NOBODY, tally } from '../engine/vote';
import { link, type NetAction } from '../net/link';

export type Screen =
  | 'home' | 'players' | 'setup' | 'intro' | 'deal' | 'discuss' | 'vote' | 'reveal' | 'score'
  | 'settings' | 'howto' | 'custom' | 'awards' | 'events' | 'online' | 'lobby';

export const IN_ROUND: Screen[] = ['intro', 'deal', 'discuss', 'vote', 'reveal'];

export interface Player {
  id: string;
  name: string;
  color: string;
  avatar: string;
}

export interface Profile {
  xp: number;
  stats: Stats;
  achievements: string[];
}

export interface CustomCard {
  id: string;
  name: string;
  ctx: string;
  emoji: string;
  img?: string;
}

export interface Settings {
  cats: CategoryId[];
  similarity: Similarity;
  mode: 'similar' | 'classic';
  impostors: 1 | 2;
  /** 0 = vueltas infinitas (se juega hasta que acabe el tiempo o decidan votar). */
  laps: 0 | 1 | 2 | 3;
  /** Segundos por turno (0 = libre). */
  timer: 0 | 20 | 30 | 45;
  /** Duración total de la ronda de pistas en segundos (0 = sin límite). */
  roundTime: 0 | 120 | 180 | 300 | 480;
  /** Modo Mezcla: temas que cruzan categorías. 'mixed' = a veces. */
  mix: 'off' | 'on' | 'mixed';
  /** Si votan a un inocente, sale y la ronda sigue hasta atrapar al impostor o quedar 2. */
  elimination: boolean;
  /** Eventos especiales de turno (voces, acentos, actuación…). */
  challenges: boolean;
  /** Misiones secretas que se reparten con la carta. */
  missions: boolean;
  /** Eventos de ronda. */
  events: boolean;
  /** Qué tan seguido salen eventos. */
  intensity: Intensity;
  /** Modo +18: agrega eventos con groserías. */
  adult: boolean;
  /** Eventos de ronda apagados en el catálogo. */
  eventsOff: EventId[];
  /** Tipos de evento de turno apagados en el catálogo. */
  kindsOff: ChallengeKind[];
  /** 'group': deciden juntos y uno toca. 'secret': cada quien vota en privado. */
  voteStyle: 'group' | 'secret';
}

export interface ResultLine extends ScoreLine {
  mult: number;
  total: number;
  streak: number;
}

export type RoundPhase = 'deal' | 'discuss' | 'vote' | 'reveal';
/** Paso de la revelación. Vive en el store para que todos los teléfonos vayan a la par. */
export type Step = 'verdict' | 'truth' | 'guess' | 'challenges';

export interface Round {
  n: number;
  cat: CategoryId;
  civil: string;
  decoy: string | null;
  level: Level | null;
  impostors: string[];
  order: string[];
  laps: number;
  timer: number;
  roundTime: number;
  /** Segundos del reloj en la fase de pistas actual (se acorta tras cada eliminación). */
  clock: number;
  /** Cuándo empezó la fase de pistas actual (ms). */
  startedAt?: number;
  /** Modo Mezcla: id del tema de la ronda. */
  theme?: string;
  event?: EventId;
  /** El evento se juega oculto: 'mystery' avisa que hay algo; 'silent' no avisa nada. */
  hidden?: Hidden;
  cursedWord?: string;
  /** Evento "fiesta mexicana": acento de la ronda. */
  accent?: string;
  /** Evento "cómplice": civil que conoce al impostor y juega de su lado. */
  accomplice?: string;
  /** Evento "detective": civil que sabe que `detectiveKnows` es inocente. */
  detective?: string;
  detectiveKnows?: string;
  /** Evento "bufón": civil que gana si lo acusan. */
  jester?: string;
  phase: RoundPhase;
  dealIdx: number;
  /** Multijugador: quiénes ya vieron su carta. */
  ready: string[];
  lap: number;
  turn: number;
  /** Fases de pistas jugadas en la ronda (sube con cada "seguir buscando"). */
  talks: number;
  ch: ChallengeState;
  /** jugador -> id de su evento de turno */
  challenges: Record<string, string>;
  /** Jugadores cuyo evento de turno ya se quitó (terminó su turno). */
  expired: string[];
  pendingChallenge?: string;
  /** jugador -> id de su misión secreta */
  missions: Record<string, string>;
  /** Todos los acusados/eliminados de la ronda (acumulado). */
  accused: string[];
  /** Acusados en la última votación. */
  lastVote?: string[];
  /** Votación individual en curso: votante -> jugador o NOBODY. */
  votes: Record<string, string>;
  /** Resultado de la última votación individual. */
  lastTally?: { counts: Record<string, number>; tie: boolean };
  /** Votaciones hechas en la ronda. */
  voteN: number;
  /** Modo eliminación activo en esta ronda. */
  elimination: boolean;
  nobodyVote: boolean;
  step: Step;
  guessIdx: number;
  /** Carta que eligió el impostor atrapado en su última oportunidad. */
  guessPick?: string;
  guessed: Record<string, boolean>;
  challengeResults: Record<string, boolean>;
  missionResults: Record<string, boolean>;
  cursed: string[];
  result?: { winner: Winner; lines: ResultLine[]; levelUps: string[]; newAch: { player: string; ach: string }[] };
}

export interface SessionStat {
  accused: number;
  impWins: number;
  civWins: number;
  challenges: number;
  cursed: number;
  allyWins: number;
}

export interface Session {
  round: number;
  stats: Record<string, SessionStat>;
  scores: Record<string, number>;
  impCounts: Record<string, number>;
  streaks: Record<string, number>;
  lastImpostors: string[];
  lastStarter?: string;
  lastEvent?: EventId;
  /** Quien sostiene el teléfono y toca "Siguiente" durante las pistas. */
  moderator?: string;
}

interface State {
  screen: Screen;
  players: Player[];
  profiles: Record<string, Profile>;
  settings: Settings;
  history: History;
  session: Session;
  round: Round | null;
  customCards: CustomCard[];
  /** Hay una sala abierta: cada jugador usa su propio teléfono. */
  online: boolean;
  /** Jugadores del modo "un solo teléfono", guardados mientras hay sala. */
  benched?: Player[];

  go(screen: Screen): void;
  addPlayer(name: string): void;
  removePlayer(id: string): void;
  movePlayer(id: string, dir: -1 | 1): void;
  setAvatar(id: string, avatar: string): void;
  setSettings(p: Partial<Settings>): void;
  newSession(): void;
  startRound(): void;
  dealNext(): void;
  markReady(player: string): void;
  beginDiscuss(): void;
  /** Pasa el turno. `result` califica el evento de turno del jugador que termina. */
  nextTurn(result?: boolean): void;
  dismissChallenge(): void;
  toggleCursed(player: string): void;
  openVote(): void;
  vote(accused: string[], nobody: boolean, tallyInfo?: Round['lastTally']): void;
  castVote(voter: string, target: string): void;
  closeVote(): void;
  setStep(step: Step): void;
  guess(id: string): void;
  nextGuess(): void;
  setChallengeResult(player: string, ok: boolean): void;
  setMissionResult(player: string, ok: boolean): void;
  finishRound(): void;
  clearHistory(): void;
  setModerator(id: string): void;
  continueRound(): void;
  saveCustom(card: CustomCard): void;
  removeCustom(id: string): void;
  openRoom(me: { id: string; name: string }): void;
  closeRoom(): void;
  /** Un teléfono entra a la sala. Devuelve false si ya no cabe. */
  joinPlayer(id: string, name: string): boolean;
  /** Acción pedida por un invitado; el anfitrión la valida antes de aplicarla. */
  remote(from: string, a: NetAction): void;
}

export const MAX_PLAYERS = 15;
export const PLAYER_COLORS = [
  '#ff2e4d', '#2ee6ff', '#ffd23d', '#39ff88', '#ff5fc8', '#7c5cff', '#ff8a3d', '#48c6ff',
  '#c6ff3d', '#ff9ad5', '#9d7bff', '#00e0b0', '#ffb547', '#6ea8ff', '#e8e2d0',
];
export const AVATARS = ['🦊', '🐸', '👽', '🤖', '🐙', '👻', '🦄', '🐼', '🦖', '🐯', '🧟', '🐵', '🦉', '🐺', '🤡'];
/** Opciones extra para quien quiera cambiar su avatar. */
export const AVATAR_CHOICES = [...AVATARS, '🐶', '🐱', '🦁', '🐷', '🐔', '🦈', '🐲', '🦋', '🌵', '🌮', '🔥', '💀', '👑', '😈', '🥷', '🧙', '🧛', '🤠', '🥸', '😎', '🤓', '🎃', '🍄', '⚡', '🪩'];

const emptySession = (): Session => ({ round: 0, stats: {}, scores: {}, impCounts: {}, streaks: {}, lastImpostors: [] });
const emptySessionStat = (): SessionStat => ({ accused: 0, impWins: 0, civWins: 0, challenges: 0, cursed: 0, allyWins: 0 });
const newProfile = (): Profile => ({ xp: 0, stats: emptyStats(), achievements: [] });

const toItem = (c: CustomCard): Item => ({
  id: c.id,
  name: c.name,
  cat: 'custom',
  group: CUSTOM_GROUP,
  emoji: c.emoji || '✍️',
  wiki: '',
  ctx: c.ctx || 'Carta creada por ustedes.',
  sim: [],
  img: c.img,
});
export const syncCustom = (cards: CustomCard[]) => setCustomItems(cards.map(toItem));

export const defaultSettings: Settings = {
  cats: CATEGORIES.map((c) => c.id),
  similarity: 'mixed',
  mode: 'similar',
  impostors: 1,
  laps: 0,
  timer: 0,
  roundTime: 180,
  mix: 'off',
  elimination: true,
  challenges: true,
  missions: true,
  events: true,
  intensity: 'normal',
  adult: false,
  eventsOff: [],
  kindsOff: [],
  voteStyle: 'group',
};

const uid = () => Math.random().toString(36).slice(2, 9);

export interface RoundStatus {
  alive: string[];
  aliveImps: number;
  aliveCivs: number;
  /** La ronda terminó (se revela todo y se puntúa). */
  over: boolean;
  /** Terminó porque los impostores igualaron a los civiles vivos. */
  impParity: boolean;
}

/** Quién sigue en juego y si la ronda ya terminó. */
export function roundStatus(r: Pick<Round, 'order' | 'accused' | 'impostors' | 'elimination' | 'nobodyVote'>): RoundStatus {
  const alive = r.order.filter((id) => !r.accused.includes(id));
  const aliveImps = alive.filter((id) => r.impostors.includes(id)).length;
  const aliveCivs = alive.length - aliveImps;
  const impParity = r.impostors.length > 0 && aliveImps > 0 && aliveImps >= aliveCivs;
  const over =
    !r.elimination ||
    r.nobodyVote ||
    (r.impostors.length > 0 && aliveImps === 0) ||
    impParity ||
    (r.impostors.length === 0 && alive.length <= 2);
  return { alive, aliveImps, aliveCivs, over, impParity };
}

/** A cuántos sospechosos se acusa en cada votación. */
export function suspectsNeeded(r: Pick<Round, 'elimination' | 'event' | 'hidden'>, players: number, impostors: number): number {
  if (r.elimination) return 1;
  if (r.event === 'double' && !r.hidden) return 2;
  return Math.min(impostors, Math.max(1, players - 2));
}

/** Siguiente turno a partir de (lap, turn) saltando eliminados. */
export function advance(r: Pick<Round, 'order' | 'accused'>, lap: number, turn: number): { lap: number; turn: number } {
  for (let i = 0; i < r.order.length; i++) {
    turn++;
    if (turn >= r.order.length) {
      turn = 0;
      lap++;
    }
    if (!r.accused.includes(r.order[turn])) break;
  }
  return { lap, turn };
}

/** ¿El turno actual es el último antes de votar? (cuenta bien aunque el último de la lista esté eliminado) */
export const isLastTurn = (r: Round) => r.laps > 0 && advance(r, r.lap, r.turn).lap > r.laps;

/** Segundos del reloj en cada fase de pistas: tras una eliminación ya hay menos que discutir. */
export const clockFor = (roundTime: number, talks: number) =>
  roundTime > 0 && talks > 1 ? Math.max(60, Math.round((roundTime * 0.6) / 30) * 30) : roundTime;

/** Eventos de ronda que chocan con ciertos eventos de turno. */
const TURN_BLOCK: Partial<Record<EventId, ChallengeKind[] | 'all'>> = {
  mime: 'all',
  sudden: 'all',
  mexican: ['voz', 'mx'],
  whisper: ['voz', 'mx'],
  oneword: ['restriccion'],
};

/** Evento de turno que está activo ahora mismo para un jugador (ya aceptado y sin expirar). */
export function activeTurnEvent(r: Round, player: string) {
  const id = r.challenges[player];
  if (!id || r.expired.includes(player)) return undefined;
  return CH_BY_ID[id];
}

/** Lo que falta calificar al final de la ronda. */
export function pendingJudgments(r: Round): { player: string; id: string; mission: boolean }[] {
  return [
    ...Object.entries(r.missions).map(([player, id]) => ({ player, id, mission: true })),
    ...Object.entries(r.challenges)
      .filter(([player]) => r.challengeResults[player] === undefined)
      .map(([player, id]) => ({ player, id, mission: false })),
  ];
}

/** Tira el dado de evento para quien empieza turno. */
function rollTurnChallenge(r: Round, h: History, s: Settings): { r: Round; h: History } {
  const block = r.event ? TURN_BLOCK[r.event] : undefined;
  if (!s.challenges || block === 'all') return { r, h };
  const player = r.order[r.turn];
  const usedKinds = Object.values(r.challenges).map((id) => CH_BY_ID[id].kind);
  const c = maybeChallenge(player, r.ch, h.challengeLast, h.round, makeRng(), usedKinds, {
    intensity: s.intensity,
    adult: s.adult,
    kindsOff: [...s.kindsOff, ...(block ?? [])],
  });
  if (!c) {
    if (!r.ch.given.includes(player)) r = { ...r, ch: { ...r.ch, sinceLast: r.ch.sinceLast + 1 } };
    return { r, h };
  }
  return {
    r: {
      ...r,
      challenges: { ...r.challenges, [player]: c.id },
      ch: { ...r.ch, given: [...r.ch.given, player], sinceLast: 0 },
      pendingChallenge: player,
    },
    h: { ...h, challengeLast: { ...h.challengeLast, [c.id]: h.round } },
  };
}

function freeLook(players: Player[]) {
  const used = new Set(players.map((p) => p.color));
  const idx = PLAYER_COLORS.findIndex((c) => !used.has(c));
  const i = idx < 0 ? players.length % PLAYER_COLORS.length : idx;
  const taken = new Set(players.map((p) => p.avatar));
  return { color: PLAYER_COLORS[i], avatar: taken.has(AVATARS[i]) ? AVATARS.find((a) => !taken.has(a)) ?? AVATARS[i] : AVATARS[i] };
}

export const useGame = create<State>()(
  persist(
    (set, get) => ({
      screen: 'home',
      players: [],
      profiles: {},
      settings: defaultSettings,
      history: emptyHistory(),
      session: emptySession(),
      round: null,
      customCards: [],
      online: false,

      go: (screen) => set({ screen }),

      addPlayer(name) {
        const { players, profiles } = get();
        const n = name.trim().slice(0, 16);
        if (!n || players.length >= MAX_PLAYERS || players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return;
        const p: Player = { id: uid(), name: n, ...freeLook(players) };
        set({ players: [...players, p], profiles: { ...profiles, [p.id]: newProfile() } });
      },

      removePlayer(id) {
        const { players, profiles, online } = get();
        const next = { ...profiles };
        // En sala se conserva el perfil: ese teléfono puede volver a entrar.
        if (!online) delete next[id];
        set({ players: players.filter((p) => p.id !== id), profiles: next });
      },

      movePlayer(id, dir) {
        const players = [...get().players];
        const i = players.findIndex((p) => p.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= players.length) return;
        [players[i], players[j]] = [players[j], players[i]];
        set({ players });
      },

      setAvatar: (id, avatar) => set({ players: get().players.map((p) => (p.id === id ? { ...p, avatar } : p)) }),

      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),

      newSession: () => set({ session: { ...emptySession(), moderator: get().session.moderator }, round: null }),

      startRound() {
        if (link.guest) return;
        const { players, settings, session } = get();
        let { history } = get();
        const rng = makeRng();
        const ids = players.map((p) => p.id);
        if (ids.length < 3) return;
        const chosen = settings.cats.filter(playable);
        const allowed = chosen.length ? chosen : CATEGORIES.map((c) => c.id);
        const horror = allowed.filter((c) => HORROR_CATS.includes(c));
        const maxImp = Math.min(settings.impostors, Math.max(1, ids.length - 2));
        const event = rollEvent(
          {
            enabled: settings.events,
            sessionRound: session.round + 1,
            players: ids.length,
            impostors: maxImp,
            horrorAvailable: horror.length > 0,
            lastEvent: session.lastEvent,
            intensity: settings.intensity,
            off: settings.eventsOff,
          },
          rng,
        );
        const hidden = event ? rollHidden(event, rng) : undefined;

        const impCount = event === 'nobody' ? 0 : event === 'double' ? 2 : maxImp;
        const needsDecoy = impCount > 0 && (settings.mode === 'similar' || event === 'blind');
        const mixRound = event !== 'terror' && (settings.mix === 'on' || (settings.mix === 'mixed' && rng.chance(0.35)));
        const theme = mixRound ? pickTheme(history, rng) : undefined;
        let civil;
        let d: { decoy: ReturnType<typeof pickCivil>; level: Level } | null;
        if (theme) {
          const pick = pickFromTheme(theme, history, rng);
          civil = pick.civil;
          d = needsDecoy ? { decoy: pick.decoy, level: pick.level } : null;
        } else {
          civil = pickCivil(pickCategory(event === 'terror' ? horror : allowed, history, rng), history, rng);
          d = needsDecoy ? pickDecoy(civil, settings.similarity, history, rng) : null;
        }
        const cat = civil.cat;
        const impostors = pickImpostors(ids, impCount, session.impCounts, session.lastImpostors, rng);
        const order = turnOrder(ids, impostors, session.lastStarter, rng);
        const civilians = ids.filter((id) => !impostors.includes(id));
        const one = (on: boolean) => (on && civilians.length > 1 ? rng.pick(civilians) : undefined);
        const accomplice = one(event === 'accomplice');
        const detective = one(event === 'detective');
        const detectiveKnows = detective ? rng.pick(civilians.filter((id) => id !== detective)) : undefined;
        const jester = one(event === 'jester');
        const missions = dealMissions(ids, event === 'blind' ? [] : impostors, history.challengeLast, history.round, rng, {
          enabled: settings.missions,
          intensity: settings.intensity,
          adult: settings.adult,
          kindsOff: settings.kindsOff,
        });
        history = commitRound(history, cat, civil, d?.decoy ?? null, theme?.id);
        if (Object.keys(missions).length)
          history = { ...history, challengeLast: { ...history.challengeLast, ...Object.fromEntries(Object.values(missions).map((m) => [m, history.round])) } };

        const roundTime = event === 'sudden' ? 60 : settings.roundTime;
        const round: Round = {
          n: session.round + 1,
          cat,
          civil: civil.id,
          decoy: d?.decoy.id ?? null,
          level: d?.level ?? null,
          impostors,
          order,
          laps: event === 'sudden' ? 1 : settings.laps,
          timer: event === 'sudden' ? 10 : settings.timer,
          roundTime,
          clock: roundTime,
          theme: theme?.id,
          event,
          hidden,
          cursedWord: event === 'cursed' ? rng.pick(CURSED_WORDS) : undefined,
          accent: event === 'mexican' ? rng.pick(MX_ACCENTS).id : undefined,
          accomplice,
          detective,
          detectiveKnows,
          jester,
          phase: 'deal',
          dealIdx: 0,
          ready: [],
          lap: 1,
          turn: 0,
          talks: 1,
          ch: { given: [], sinceLast: 0, max: INTENSITY[settings.intensity].turnMax(ids.length) },
          challenges: {},
          expired: [],
          missions,
          accused: [],
          votes: {},
          voteN: 0,
          elimination: settings.elimination,
          nobodyVote: false,
          step: 'verdict',
          guessIdx: 0,
          guessed: {},
          challengeResults: {},
          missionResults: {},
          cursed: [],
        };
        set({ round, history, screen: 'intro' });
      },

      dealNext() {
        const { round, players } = get();
        if (!round || link.guest) return;
        const dealIdx = round.dealIdx + 1;
        if (dealIdx < players.length) return set({ round: { ...round, dealIdx } });
        get().beginDiscuss();
      },

      markReady(player) {
        if (link.guest) return link.send({ a: 'ready' });
        const { round } = get();
        if (!round || round.phase !== 'deal' || round.ready.includes(player) || !round.order.includes(player)) return;
        const ready = [...round.ready, player];
        set({ round: { ...round, ready } });
        if (round.order.every((id) => ready.includes(id))) get().beginDiscuss();
      },

      beginDiscuss() {
        const { round, players, history, settings } = get();
        if (!round || link.guest || round.phase !== 'deal') return;
        const { r, h } = rollTurnChallenge({ ...round, phase: 'discuss', dealIdx: players.length, startedAt: Date.now() }, history, settings);
        set({ round: r, history: h, screen: 'discuss' });
      },

      nextTurn(result) {
        if (link.guest) return link.send({ a: 'next' });
        const { round, history, settings } = get();
        if (!round || round.phase !== 'discuss') return;
        // El evento de turno se quita al pasar al siguiente jugador.
        const pid = round.order[round.turn];
        const ending = activeTurnEvent(round, pid);
        let cur: Round = { ...round, pendingChallenge: undefined };
        if (ending && !ending.round) {
          cur = { ...cur, expired: [...cur.expired, pid] };
          if (result !== undefined) cur = { ...cur, challengeResults: { ...cur.challengeResults, [pid]: result } };
        }
        const { lap, turn } = advance(cur, cur.lap, cur.turn);
        if (cur.laps > 0 && lap > cur.laps) return set({ round: { ...cur, phase: 'vote', votes: {} }, screen: 'vote' });
        const { r, h } = rollTurnChallenge({ ...cur, lap, turn }, history, settings);
        set({ round: r, history: h });
      },

      dismissChallenge() {
        if (link.guest) return link.send({ a: 'accept' });
        const { round } = get();
        if (round) set({ round: { ...round, pendingChallenge: undefined } });
      },

      toggleCursed(player) {
        if (link.guest) return link.send({ a: 'cursed', player });
        const { round } = get();
        if (!round) return;
        const cursed = round.cursed.includes(player) ? round.cursed.filter((p) => p !== player) : [...round.cursed, player];
        set({ round: { ...round, cursed } });
      },

      openVote() {
        const { round } = get();
        if (!round || link.guest || round.result) return;
        set({ round: { ...round, phase: 'vote', votes: {}, pendingChallenge: undefined }, screen: 'vote' });
      },

      vote(accused, nobody, tallyInfo) {
        const { round } = get();
        if (!round || link.guest) return;
        set({
          round: {
            ...round,
            accused: [...round.accused, ...accused],
            lastVote: accused,
            nobodyVote: nobody,
            lastTally: tallyInfo,
            votes: {},
            voteN: round.voteN + 1,
            phase: 'reveal',
            step: 'verdict',
            guessIdx: 0,
            guessPick: undefined,
          },
          screen: 'reveal',
        });
      },

      castVote(voter, target) {
        if (link.guest) return link.send({ a: 'vote', target });
        const { round, online } = get();
        if (!round || round.phase !== 'vote') return;
        const { alive } = roundStatus(round);
        if (!alive.includes(voter) || (target !== NOBODY && !alive.includes(target))) return;
        const votes = { ...round.votes, [voter]: target };
        set({ round: { ...round, votes } });
        // En sala, cuando ya votaron todos se cierra sola.
        if (online && alive.every((id) => votes[id])) get().closeVote();
      },

      closeVote() {
        const { round, players, settings } = get();
        if (!round || link.guest || round.phase !== 'vote') return;
        const t = tally(round.votes, suspectsNeeded(round, players.length, settings.impostors));
        get().vote(t.accused, t.nobody, { counts: t.counts, tie: t.tie });
      },

      setStep(step) {
        const { round } = get();
        if (round && !link.guest) set({ round: { ...round, step, guessIdx: 0, guessPick: undefined } });
      },

      guess(id) {
        if (link.guest) return link.send({ a: 'guess', id });
        const { round } = get();
        if (!round || round.step !== 'guess' || round.guessPick) return;
        const guesser = round.impostors.filter((i) => round.accused.includes(i))[round.guessIdx];
        if (!guesser) return;
        set({ round: { ...round, guessPick: id, guessed: { ...round.guessed, [guesser]: id === round.civil } } });
      },

      nextGuess() {
        const { round } = get();
        if (!round || link.guest) return;
        const caught = round.impostors.filter((i) => round.accused.includes(i));
        if (round.guessIdx + 1 < caught.length) return set({ round: { ...round, guessIdx: round.guessIdx + 1, guessPick: undefined } });
        if (pendingJudgments(round).length) return set({ round: { ...round, step: 'challenges', guessPick: undefined } });
        get().finishRound();
      },

      continueRound() {
        const { round, history, settings } = get();
        if (!round || link.guest) return;
        // Nueva fase de pistas con los que quedan: vuelve a empezar la vuelta y el reloj (más corto).
        const start = advance(round, 1, -1);
        const talks = round.talks + 1;
        const caughtOne = round.impostors.some((i) => round.accused.includes(i));
        const next: Round = {
          ...round,
          phase: 'discuss',
          lap: 1,
          turn: start.turn,
          talks,
          clock: clockFor(round.roundTime, talks),
          lastVote: undefined,
          lastTally: undefined,
          startedAt: Date.now(),
          pendingChallenge: undefined,
          // Si ya cayó uno de dos impostores, el "doble impostor" dejó de ser secreto.
          hidden: round.event === 'double' && caughtOne ? undefined : round.hidden,
        };
        const { r, h } = rollTurnChallenge(next, history, settings);
        set({ round: r, history: h, screen: 'discuss' });
      },

      setChallengeResult(player, ok) {
        const { round } = get();
        if (round && !link.guest) set({ round: { ...round, challengeResults: { ...round.challengeResults, [player]: ok } } });
      },

      setMissionResult(player, ok) {
        const { round } = get();
        if (round && !link.guest) set({ round: { ...round, missionResults: { ...round.missionResults, [player]: ok } } });
      },

      finishRound() {
        if (link.guest) return;
        const { round, players, session, profiles } = get();
        if (!round || round.result) return set({ screen: 'score' });
        const ids = players.map((p) => p.id);
        const { winner, lines } = scoreRound({
          players: ids,
          impostors: round.impostors,
          accused: round.accused,
          nobodyVote: round.nobodyVote,
          guessed: round.guessed,
          challenges: round.challengeResults,
          missions: round.missionResults,
          cursed: round.cursed,
          event: round.event,
          accomplice: round.accomplice,
          jester: round.jester,
        });

        const scores = { ...session.scores };
        const streaks = { ...session.streaks };
        const impCounts = { ...session.impCounts };
        const nextProfiles = { ...profiles };
        const stats = { ...session.stats };
        const levelUps: string[] = [];
        const newAch: { player: string; ach: string }[] = [];
        const civTeamWon = winner === 'civ' || winner === 'partial' || winner === 'nobody-found';

        const result: ResultLine[] = lines.map((l) => {
          // Quien entró a media ronda (sala) no jugó: ni suma ni pierde racha.
          const played = round.order.includes(l.player);
          const streak = !played ? streaks[l.player] ?? 0 : l.base > 0 ? (streaks[l.player] ?? 0) + 1 : 0;
          const mult = l.base > 0 ? streakMult(streak) : 1;
          const total = Math.round(l.base * mult) + l.bonus;
          streaks[l.player] = streak;
          scores[l.player] = (scores[l.player] ?? 0) + total;
          if (!played) return { ...l, mult, total, streak };

          const prof = nextProfiles[l.player] ?? newProfile();
          const s = { ...prof.stats };
          const isImp = round.impostors.includes(l.player);
          const caught = round.accused.includes(l.player);
          const done = (round.challengeResults[l.player] ? 1 : 0) + (round.missionResults[l.player] ? 1 : 0);
          s.rounds++;
          if (isImp) {
            s.impRounds++;
            if (!caught || round.nobodyVote) {
              s.impWins++;
              if (round.event === 'blind') s.blindWins++;
            } else if (round.guessed[l.player]) s.guessWins++;
          } else if (civTeamWon && l.player !== round.accomplice) s.civWins++;
          s.challengesDone += done;
          if (round.missionResults[l.player]) s.betrayalsDone++;
          s.bestStreak = Math.max(s.bestStreak, streak);
          const xp = prof.xp + Math.max(0, total) + 10;
          if (levelFromXp(xp) > levelFromXp(prof.xp)) levelUps.push(l.player);
          const achievements = [...prof.achievements];
          for (const a of ACHIEVEMENTS)
            if (!achievements.includes(a.id) && a.test(s)) {
              achievements.push(a.id);
              newAch.push({ player: l.player, ach: a.id });
            }
          nextProfiles[l.player] = { xp, stats: s, achievements };

          const ss = { ...(stats[l.player] ?? emptySessionStat()) };
          if (caught) ss.accused++;
          if (isImp && (!caught || round.nobodyVote)) ss.impWins++;
          if (!isImp && l.player !== round.accomplice && civTeamWon) ss.civWins++;
          if (l.player === round.accomplice && l.base > 0) ss.allyWins++;
          ss.challenges += done;
          if (round.cursed.includes(l.player)) ss.cursed++;
          stats[l.player] = ss;
          return { ...l, mult, total, streak };
        });

        for (const i of round.impostors) impCounts[i] = (impCounts[i] ?? 0) + 1;
        set({
          profiles: nextProfiles,
          session: {
            round: session.round + 1,
            stats,
            scores,
            streaks,
            impCounts,
            lastImpostors: round.impostors,
            lastStarter: round.order[0],
            lastEvent: round.event,
            moderator: session.moderator,
          },
          round: { ...round, result: { winner, lines: result, levelUps, newAch } },
          screen: 'score',
        });
      },

      clearHistory: () => set({ history: emptyHistory() }),

      setModerator(id) {
        const { round, session } = get();
        // Si se elige al inicio de la ronda, el reloj arranca desde ese momento.
        const fresh = round && round.phase === 'discuss' && round.lap === 1 && round.talks === 1 && round.turn === advance(round, 1, -1).turn;
        set({ session: { ...session, moderator: id }, round: fresh ? { ...round, startedAt: Date.now() } : round });
      },

      saveCustom(card) {
        const list = get().customCards;
        const customCards = list.some((c) => c.id === card.id) ? list.map((c) => (c.id === card.id ? card : c)) : [...list, card];
        syncCustom(customCards);
        set({ customCards });
      },

      removeCustom(id) {
        const customCards = get().customCards.filter((c) => c.id !== id);
        syncCustom(customCards);
        set({ customCards });
      },

      openRoom(me) {
        const { players, profiles, online } = get();
        if (online) return set({ screen: 'lobby' });
        const host: Player = { id: me.id, name: me.name.trim().slice(0, 16) || 'Anfitrión', color: PLAYER_COLORS[0], avatar: AVATARS[0] };
        set({
          online: true,
          benched: players,
          players: [host],
          profiles: { ...profiles, [host.id]: profiles[host.id] ?? newProfile() },
          session: emptySession(),
          round: null,
          screen: 'lobby',
        });
      },

      closeRoom() {
        const { benched, online } = get();
        if (!online) return;
        set({ online: false, players: benched ?? [], benched: undefined, session: emptySession(), round: null, screen: 'home' });
      },

      joinPlayer(id, name) {
        const { players, profiles } = get();
        const clean = name.trim().slice(0, 16) || 'Jugador';
        const existing = players.find((p) => p.id === id);
        const taken = (n: string) => players.some((p) => p.id !== id && p.name.toLowerCase() === n.toLowerCase());
        let unique = clean;
        for (let k = 2; taken(unique); k++) unique = `${clean.slice(0, 14)} ${k}`;
        if (existing) {
          if (existing.name !== unique) set({ players: players.map((p) => (p.id === id ? { ...p, name: unique } : p)) });
          return true;
        }
        if (players.length >= MAX_PLAYERS) return false;
        const p: Player = { id, name: unique, ...freeLook(players) };
        set({ players: [...players, p], profiles: { ...profiles, [id]: profiles[id] ?? newProfile() } });
        return true;
      },

      remote(from, a) {
        const { round, screen } = get();
        if (!round || link.guest || !round.order.includes(from)) return;
        const s = get();
        switch (a.a) {
          case 'ready':
            return screen === 'deal' ? s.markReady(from) : undefined;
          case 'next':
            // Solo quien tiene el turno puede pasarlo (el anfitrión lo hace desde su teléfono).
            return screen === 'discuss' && round.order[round.turn] === from && !round.pendingChallenge ? s.nextTurn() : undefined;
          case 'accept':
            return round.pendingChallenge === from ? s.dismissChallenge() : undefined;
          case 'vote':
            return screen === 'vote' ? s.castVote(from, a.target) : undefined;
          case 'guess': {
            const guesser = round.impostors.filter((i) => round.accused.includes(i))[round.guessIdx];
            return screen === 'reveal' && guesser === from && BY_ID[a.id] ? s.guess(a.id) : undefined;
          }
          case 'cursed':
            return round.cursedWord && round.order.includes(a.player) && !round.cursed.includes(a.player) ? s.toggleCursed(a.player) : undefined;
        }
      },
    }),
    {
      name: 'impostor-v1',
      version: 2,
      // Un invitado refleja la partida del anfitrión: eso no debe pisar lo guardado en su teléfono.
      storage: createJSONStorage(() => {
        const ls = localStorage; // si no existe (pruebas en Node) esto lanza y zustand desactiva el guardado
        return {
          getItem: (k) => ls.getItem(k),
          setItem: (k, v) => {
            if (!link.guest) ls.setItem(k, v);
          },
          removeItem: (k) => ls.removeItem(k),
        };
      }),
      partialize: (s) => ({
        screen: s.screen === 'intro' ? 'deal' : s.screen,
        players: s.players,
        profiles: s.profiles,
        settings: s.settings,
        history: s.history,
        session: s.session,
        round: s.round,
        customCards: s.customCards,
        online: s.online,
        benched: s.benched,
      }),
      migrate: (persisted, version) => {
        const p = persisted as Partial<State>;
        // v1 → v2: las rondas guardadas no tienen fases ni misiones; se descarta la que estaba a medias.
        if (version < 2) {
          p.round = null;
          if (p.screen && !['home', 'players', 'setup', 'settings', 'howto', 'custom'].includes(p.screen)) p.screen = 'home';
        }
        return p;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<State>;
        syncCustom(p.customCards ?? []);
        return {
          ...current,
          ...p,
          settings: { ...defaultSettings, ...p.settings },
          session: { ...emptySession(), ...p.session },
          history: { ...emptyHistory(), ...p.history },
        };
      },
    },
  ),
);

export const playerById = (id: string) => useGame.getState().players.find((p) => p.id === id);

/** Pantalla a la que hay que volver para seguir una ronda a medias. */
export const resumeScreen = (r: Round): Screen => (r.result ? 'score' : r.phase);
