export interface Stats {
  rounds: number;
  impRounds: number;
  impWins: number;
  civWins: number;
  guessWins: number;
  challengesDone: number;
  betrayalsDone: number;
  blindWins: number;
  bestStreak: number;
}

export const emptyStats = (): Stats => ({
  rounds: 0,
  impRounds: 0,
  impWins: 0,
  civWins: 0,
  guessWins: 0,
  challengesDone: 0,
  betrayalsDone: 0,
  blindWins: 0,
  bestStreak: 0,
});

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  test: (s: Stats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: 'Primera sangre', emoji: '🩸', desc: 'Juega tu primera ronda', test: (s) => s.rounds >= 1 },
  { id: 'chameleon', name: 'Camaleón', emoji: '🦎', desc: 'Sobrevive 3 veces como impostor', test: (s) => s.impWins >= 3 },
  { id: 'hound', name: 'Sabueso', emoji: '🐕‍🦺', desc: 'Atrapa al impostor 5 veces', test: (s) => s.civWins >= 5 },
  { id: 'mastermind', name: 'Mente maestra', emoji: '🧠', desc: 'Te atrapan pero adivinas la carta', test: (s) => s.guessWins >= 1 },
  { id: 'traitor', name: 'Traidor profesional', emoji: '🗡️', desc: 'Cumple 3 retos de traición', test: (s) => s.betrayalsDone >= 3 },
  { id: 'brave', name: 'Sin vergüenza', emoji: '🎤', desc: 'Cumple 10 retos', test: (s) => s.challengesDone >= 10 },
  { id: 'blind', name: 'Ignorancia feliz', emoji: '🙈', desc: 'Gana siendo impostor a ciegas', test: (s) => s.blindWins >= 1 },
  { id: 'fire', name: 'En llamas', emoji: '🔥', desc: 'Racha de 4 rondas ganando', test: (s) => s.bestStreak >= 4 },
  { id: 'veteran', name: 'Veterano', emoji: '🎖️', desc: 'Juega 50 rondas', test: (s) => s.rounds >= 50 },
  { id: 'legend', name: 'Leyenda del engaño', emoji: '👑', desc: 'Sobrevive 10 veces como impostor', test: (s) => s.impWins >= 10 },
];
