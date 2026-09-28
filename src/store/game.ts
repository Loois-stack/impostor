import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CATEGORIES, HORROR_CATS } from '../data/categories';
import { CHALLENGES } from '../data/challenges';
import type { CategoryId, Level } from '../data/types';
import { ACHIEVEMENTS, emptyStats, type Stats } from '../engine/achievements';
import { maybeChallenge, type ChallengeState } from '../engine/challenges';
import { CURSED_WORDS, rollEvent, type EventId } from '../engine/events';
import { makeRng } from '../engine/rng';
import { pickImpostors, turnOrder } from '../engine/roles';
import { levelFromXp, scoreRound, streakMult, type ScoreLine, type Winner } from '../engine/scoring';
import { commitRound, emptyHistory, pickCategory, pickCivil, pickDecoy, type History, type Similarity } from '../engine/selector';

export type Screen =
  | 'home' | 'players' | 'setup' | 'intro' | 'deal' | 'discuss' | 'vote' | 'reveal' | 'score' | 'settings' | 'howto';

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

export interface Settings {
  cats: CategoryId[];
  similarity: Similarity;
  mode: 'similar' | 'classic';
  impostors: 1 | 2;
  laps: 1 | 2 | 3;
  timer: 0 | 20 | 30 | 45;
  challenges: boolean;
  events: boolean;
  sound: boolean;
  vibration: boolean;
}

export interface ResultLine extends ScoreLine {
  mult: number;
  total: number;
  streak: number;
}

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
  event?: EventId;
  cursedWord?: string;
  dealIdx: number;
  lap: number;
  turn: number;
  ch: ChallengeState;
  /** jugador -> id de reto */
  challenges: Record<string, string>;
  pendingChallenge?: string;
  accused: string[];
  nobodyVote: boolean;
  guessed: Record<string, boolean>;
  challengeResults: Record<string, boolean>;
  cursed: string[];
  result?: { winner: Winner; lines: ResultLine[]; levelUps: string[]; newAch: { player: string; ach: string }[] };
}

export interface Session {
  round: number;
  scores: Record<string, number>;
  impCounts: Record<string, number>;
  streaks: Record<string, number>;
  lastImpostors: string[];
  lastStarter?: string;
  lastEvent?: EventId;
}

interface State {
  screen: Screen;
  players: Player[];
  profiles: Record<string, Profile>;
  settings: Settings;
  history: History;
  session: Session;
  round: Round | null;

  go(screen: Screen): void;
  addPlayer(name: string): void;
  removePlayer(id: string): void;
  movePlayer(id: string, dir: -1 | 1): void;
  setSettings(p: Partial<Settings>): void;
  newSession(): void;
  startRound(): void;
  dealNext(): void;
  nextTurn(): void;
  dismissChallenge(): void;
  toggleCursed(player: string): void;
  vote(accused: string[], nobody: boolean): void;
  setGuess(imp: string, ok: boolean): void;
  setChallengeResult(player: string, ok: boolean): void;
  finishRound(): void;
  clearHistory(): void;
}

export const PLAYER_COLORS = [
  '#ff2e4d', '#2ee6ff', '#ffd23d', '#39ff88', '#ff5fc8', '#7c5cff', '#ff8a3d', '#48c6ff',
  '#c6ff3d', '#ff9ad5', '#9d7bff', '#00e0b0', '#ffb547', '#6ea8ff', '#e8e2d0',
];
export const AVATARS = ['🦊', '🐸', '👽', '🤖', '🐙', '👻', '🦄', '🐼', '🦖', '🐯', '🧟', '🐵', '🦉', '🐺', '🤡'];

const emptySession = (): Session => ({ round: 0, scores: {}, impCounts: {}, streaks: {}, lastImpostors: [] });

const defaultSettings: Settings = {
  cats: CATEGORIES.map((c) => c.id),
  similarity: 'mixed',
  mode: 'similar',
  impostors: 1,
  laps: 2,
  timer: 0,
  challenges: true,
  events: true,
  sound: true,
  vibration: true,
};

const uid = () => Math.random().toString(36).slice(2, 9);

/** Tira el dado de reto para quien empieza turno. */
function rollTurnChallenge(r: Round, h: History, enabled: boolean): { r: Round; h: History } {
  if (!enabled) return { r, h };
  const player = r.order[r.turn];
  const c = maybeChallenge(player, r.ch, h.challengeLast, h.round, makeRng());
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

      go: (screen) => set({ screen }),

      addPlayer(name) {
        const { players, profiles } = get();
        const n = name.trim().slice(0, 16);
        if (!n || players.length >= 15 || players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return;
        const used = new Set(players.map((p) => p.color));
        const idx = PLAYER_COLORS.findIndex((c) => !used.has(c));
        const i = idx < 0 ? players.length % PLAYER_COLORS.length : idx;
        const p: Player = { id: uid(), name: n, color: PLAYER_COLORS[i], avatar: AVATARS[i] };
        set({ players: [...players, p], profiles: { ...profiles, [p.id]: { xp: 0, stats: emptyStats(), achievements: [] } } });
      },

      removePlayer(id) {
        const profiles = { ...get().profiles };
        delete profiles[id];
        set({ players: get().players.filter((p) => p.id !== id), profiles });
      },

      movePlayer(id, dir) {
        const players = [...get().players];
        const i = players.findIndex((p) => p.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= players.length) return;
        [players[i], players[j]] = [players[j], players[i]];
        set({ players });
      },

      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),

      newSession: () => set({ session: emptySession(), round: null }),

      startRound() {
        const { players, settings, session } = get();
        let { history } = get();
        const rng = makeRng();
        const ids = players.map((p) => p.id);
        const allowed = settings.cats.length ? settings.cats : CATEGORIES.map((c) => c.id);
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
          },
          rng,
        );

        const cat = pickCategory(event === 'terror' ? horror : allowed, history, rng);
        const civil = pickCivil(cat, history, rng);
        const impCount = event === 'nobody' ? 0 : event === 'double' ? 2 : maxImp;
        const needsDecoy = impCount > 0 && (settings.mode === 'similar' || event === 'blind');
        const d = needsDecoy ? pickDecoy(civil, settings.similarity, history, rng) : null;
        const impostors = pickImpostors(ids, impCount, session.impCounts, session.lastImpostors, rng);
        const order = turnOrder(ids, impostors, session.lastStarter, rng);
        history = commitRound(history, cat, civil, d?.decoy ?? null);

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
          event,
          cursedWord: event === 'cursed' ? rng.pick(CURSED_WORDS) : undefined,
          dealIdx: 0,
          lap: 1,
          turn: 0,
          ch: { given: [], sinceLast: 0, max: Math.ceil(ids.length / 2) },
          challenges: {},
          accused: [],
          nobodyVote: false,
          guessed: {},
          challengeResults: {},
          cursed: [],
        };
        set({ round, history, screen: 'intro' });
      },

      dealNext() {
        const { round, players, history, settings } = get();
        if (!round) return;
        const dealIdx = round.dealIdx + 1;
        if (dealIdx < players.length) return set({ round: { ...round, dealIdx } });
        const { r, h } = rollTurnChallenge({ ...round, dealIdx }, history, settings.challenges);
        set({ round: r, history: h, screen: 'discuss' });
      },

      nextTurn() {
        const { round, history, settings } = get();
        if (!round) return;
        let { lap, turn } = round;
        turn++;
        if (turn >= round.order.length) {
          turn = 0;
          lap++;
        }
        if (lap > round.laps) return set({ round: { ...round, pendingChallenge: undefined }, screen: 'vote' });
        const { r, h } = rollTurnChallenge({ ...round, lap, turn, pendingChallenge: undefined }, history, settings.challenges);
        set({ round: r, history: h });
      },

      dismissChallenge() {
        const { round } = get();
        if (round) set({ round: { ...round, pendingChallenge: undefined } });
      },

      toggleCursed(player) {
        const { round } = get();
        if (!round) return;
        const cursed = round.cursed.includes(player) ? round.cursed.filter((p) => p !== player) : [...round.cursed, player];
        set({ round: { ...round, cursed } });
      },

      vote(accused, nobody) {
        const { round } = get();
        if (round) set({ round: { ...round, accused, nobodyVote: nobody }, screen: 'reveal' });
      },

      setGuess(imp, ok) {
        const { round } = get();
        if (round) set({ round: { ...round, guessed: { ...round.guessed, [imp]: ok } } });
      },

      setChallengeResult(player, ok) {
        const { round } = get();
        if (round) set({ round: { ...round, challengeResults: { ...round.challengeResults, [player]: ok } } });
      },

      finishRound() {
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
          cursed: round.cursed,
          event: round.event,
        });

        const scores = { ...session.scores };
        const streaks = { ...session.streaks };
        const impCounts = { ...session.impCounts };
        const nextProfiles = { ...profiles };
        const levelUps: string[] = [];
        const newAch: { player: string; ach: string }[] = [];

        const result: ResultLine[] = lines.map((l) => {
          const streak = l.base > 0 ? (streaks[l.player] ?? 0) + 1 : 0;
          const mult = l.base > 0 ? streakMult(streak) : 1;
          const total = Math.round(l.base * mult) + l.bonus;
          streaks[l.player] = streak;
          scores[l.player] = (scores[l.player] ?? 0) + total;

          const prof = nextProfiles[l.player] ?? { xp: 0, stats: emptyStats(), achievements: [] };
          const s = { ...prof.stats };
          const isImp = round.impostors.includes(l.player);
          const caught = round.accused.includes(l.player);
          s.rounds++;
          if (isImp) {
            s.impRounds++;
            if (!caught || round.nobodyVote) {
              s.impWins++;
              if (round.event === 'blind') s.blindWins++;
            } else if (round.guessed[l.player]) s.guessWins++;
          } else if (winner === 'civ' || winner === 'partial' || winner === 'nobody-found') s.civWins++;
          if (round.challengeResults[l.player]) {
            s.challengesDone++;
            if (CHALLENGES.find((c) => c.id === round.challenges[l.player])?.kind === 'traicion') s.betrayalsDone++;
          }
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
          return { ...l, mult, total, streak };
        });

        for (const i of round.impostors) impCounts[i] = (impCounts[i] ?? 0) + 1;
        set({
          profiles: nextProfiles,
          session: {
            round: session.round + 1,
            scores,
            streaks,
            impCounts,
            lastImpostors: round.impostors,
            lastStarter: round.order[0],
            lastEvent: round.event,
          },
          round: { ...round, result: { winner, lines: result, levelUps, newAch } },
          screen: 'score',
        });
      },

      clearHistory: () => set({ history: emptyHistory() }),
    }),
    {
      name: 'impostor-v1',
      version: 1,
      partialize: (s) => ({
        screen: s.screen === 'intro' ? 'deal' : s.screen,
        players: s.players,
        profiles: s.profiles,
        settings: s.settings,
        history: s.history,
        session: s.session,
        round: s.round,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<State>;
        return { ...current, ...p, settings: { ...defaultSettings, ...p.settings } };
      },
    },
  ),
);

export const playerById = (id: string) => useGame.getState().players.find((p) => p.id === id);
