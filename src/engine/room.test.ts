import { beforeEach, describe, expect, it } from 'vitest';
import { BY_ID } from '../data';
import { guessersOf, useGame, voteCallStatus, votersOf, type Round } from '../store/game';

/** Sala con el anfitrión y cuatro teléfonos (g1 lleva además a Beto, que no tiene teléfono). */
describe('sala: pedir votación y salir de la partida', () => {
  const g = () => useGame.getState();
  const round = () => g().round as Round;
  const id = (n: string) => g().players.find((p) => p.name === n)!.id;

  beforeEach(() => {
    useGame.setState({ players: [], profiles: {}, round: null, online: false, benched: undefined, screen: 'home' });
    g().newSession();
    g().clearHistory();
    g().setSettings({ events: false, challenges: false, missions: false, elimination: false, laps: 0, roundTime: 0, impostors: 1, impTeam: false, voteStyle: 'group', mode: 'similar' });
    g().openRoom({ id: 'host', name: 'Luis' });
    for (const [pid, n] of [['g1', 'Mar'], ['g2', 'Paz'], ['g3', 'Sol'], ['g4', 'Uri']]) g().joinPlayer(pid, n);
    g().remote('g1', { a: 'addLocal', name: 'Beto' });
    expect(g().players).toHaveLength(6);
  });

  const toDiscuss = () => {
    g().startRound();
    g().go('deal');
    for (const p of g().players) g().markReady(p.id);
    expect(g().screen).toBe('discuss');
  };
  /** Pasa turnos (como anfitrión) hasta terminar la vuelta actual. */
  const finishLap = () => {
    const lap = round().lap;
    for (let i = 0; i < 10 && g().screen === 'discuss' && round().lap === lap; i++) g().nextTurn();
  };

  it('con mayoría se vota al terminar la vuelta, no antes', () => {
    toDiscuss();
    // 6 jugadores: se necesitan 4.
    expect(voteCallStatus(round()).need).toBe(4);
    g().remote('g2', { a: 'callVote', as: id('Paz'), on: true });
    g().remote('g3', { a: 'callVote', on: true });
    g().callVote('host', true);
    expect(voteCallStatus(round()).calls).toHaveLength(3);
    expect(voteCallStatus(round()).ready).toBe(false);
    // Cambiar de opinión quita el pedido; repetirlo no cuenta doble.
    g().remote('g3', { a: 'callVote', on: false });
    g().remote('g2', { a: 'callVote', as: id('Paz'), on: true });
    expect(voteCallStatus(round()).calls).toHaveLength(2);
    // g1 pide por sí y por Beto (juega en su teléfono), pero no puede pedir por otro teléfono.
    g().remote('g1', { a: 'callVote', as: id('Beto'), on: true });
    g().remote('g1', { a: 'callVote', as: id('Uri'), on: true });
    expect(voteCallStatus(round()).calls).toHaveLength(3);
    g().remote('g1', { a: 'callVote', on: true });
    expect(voteCallStatus(round()).ready).toBe(true);
    // Todavía no: se termina la vuelta primero.
    g().nextTurn();
    expect(g().screen).toBe('discuss');
    finishLap();
    expect(g().screen).toBe('vote');
    expect(round().voteCalls).toEqual([]);
  });

  it('sin mayoría la vuelta sigue (sin límite de vueltas)', () => {
    toDiscuss();
    g().callVote('host', true);
    finishLap();
    expect(g().screen).toBe('discuss');
    expect(round().lap).toBe(2);
  });

  it('si lo piden todos se vota de inmediato', () => {
    toDiscuss();
    for (const p of g().players) g().callVote(p.id, true);
    expect(g().screen).toBe('vote');
  });

  it('quien sale a media ronda: no se le espera, se salta su turno y se puede votar por él', () => {
    g().startRound();
    g().go('deal');
    for (const n of ['Luis', 'Paz', 'Sol', 'Uri']) g().markReady(id(n));
    expect(g().screen).toBe('deal');
    // Sale g1: se van Mar y Beto (juega en su teléfono). Ya no se les espera para ver la carta.
    const mar = id('Mar');
    const beto = id('Beto');
    g().leaveRound('g1');
    expect(round().left?.sort()).toEqual([mar, beto].sort());
    expect(g().screen).toBe('discuss');

    // Su turno se salta.
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      seen.add(round().order[round().turn]);
      g().nextTurn();
    }
    expect(seen.has(mar) || seen.has(beto)).toBe(false);

    // Ya no cuentan para pedir votación ni para votar, pero siguen siendo sospechosos.
    expect(votersOf(round())).toHaveLength(4);
    expect(voteCallStatus(round()).need).toBe(3);
    g().openVote();
    g().castVote(mar, id('Luis'));
    expect(round().votes[mar]).toBeUndefined();
    for (const n of ['Luis', 'Paz', 'Sol']) g().castVote(id(n), mar);
    expect(g().screen).toBe('vote');
    g().castVote(id('Uri'), mar);
    expect(g().screen).toBe('reveal');
    expect(round().lastVote).toEqual([mar]);
  });

  it('si el primero en hablar salió durante el reparto, empieza el siguiente', () => {
    g().startRound();
    g().go('deal');
    const mar = id('Mar');
    const order = [mar, ...round().order.filter((x) => x !== mar)];
    useGame.setState({ round: { ...round(), order, turn: 0 } });
    for (const n of ['Luis', 'Paz', 'Sol', 'Uri']) g().markReady(id(n));
    g().leaveRound('g1');
    expect(g().screen).toBe('discuss');
    expect([mar, id('Beto')]).not.toContain(round().order[round().turn]);
  });

  it('si sale alguien mientras votan y ya votaron los demás, se cierra la votación', () => {
    toDiscuss();
    g().openVote();
    const target = id('Sol');
    for (const n of ['Luis', 'Paz', 'Sol', 'Uri']) g().castVote(id(n), target);
    expect(g().screen).toBe('vote');
    g().leaveRound('g1');
    expect(g().screen).toBe('reveal');
  });

  it('un impostor atrapado que sale no bloquea la última oportunidad', () => {
    g().setSettings({ impostors: 2 });
    toDiscuss();
    const [a, b] = round().impostors;
    g().openVote();
    g().vote([a, b], false);
    g().setStep('guess');
    expect(guessersOf(round())).toEqual([a, b]);
    const owner = g().players.find((p) => p.id === a)!.owner ?? a;
    g().leaveRound(owner);
    const rest = guessersOf(round());
    if (rest.length) {
      expect(round().step).toBe('guess');
      g().guess(Object.keys(BY_ID)[0]);
      g().nextGuess();
    }
    expect(round().step).toBe('truth');
  });

  it('quien vuelve a entrar regresa a la partida; quien no vuelve ya no recibe carta', () => {
    toDiscuss();
    g().leaveRound('g4');
    expect(round().left).toEqual([id('Uri')]);
    g().joinPlayer('g4', 'Uri');
    expect(round().left).toEqual([]);
    g().leaveRound('g2');
    g().openVote();
    g().vote([id('Sol')], false);
    g().setStep('truth');
    g().finishRound();
    g().startRound();
    expect(g().players.map((p) => p.name)).not.toContain('Paz');
    expect(round().order).toHaveLength(5);
  });

  it('entre rondas, salir deja el lugar libre', () => {
    toDiscuss();
    g().openVote();
    g().vote([id('Sol')], false);
    g().finishRound();
    g().leaveRound('g1');
    expect(g().players.map((p) => p.name).sort()).toEqual(['Luis', 'Paz', 'Sol', 'Uri']);
  });
});
