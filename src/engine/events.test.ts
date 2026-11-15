import { beforeEach, describe, expect, it } from 'vitest';
import { CHALLENGES, CH_BY_ID, KIND_META, MISSIONS, TURN_EVENTS } from '../data/challenges';
import { challengeChance, dealMissions, INTENSITY, maybeChallenge } from './challenges';
import { EVENTS, EVENT_LIST, eligibleEvents, MX_ACCENTS, rollEvent, rollHidden } from './events';
import { makeRng } from './rng';
import { scoreRound } from './scoring';
import { NOBODY, tally } from './vote';
import { balanceOf, maxImpostors, recommendedImpostors, resolveImpostors } from './roles';
import { activeTurnEvent, clockFor, isLastTurn, pendingJudgments, roundStatus, suspectsNeeded, useGame, type Round } from '../store/game';

describe('eventos seguros y divertidos', () => {
  // Nada que ponga a alguien en riesgo o lo deje mal parado: ni alcohol, ni golpes, ni carreras,
  // ni teléfonos ajenos, ni temas personales. "Sin tomar nada" es la única mención permitida.
  const BANNED =
    /\b(alcohol|cerveza|tequila|mezcal|shot|shots|trago|tragos|bebe|beban|fuma|fumar|golpe|golpea|pega(le)?|cachetada|empuja|muerde|corre|corran|salta|brinca|carga a|quítate|quita(te)? la|desnud|besa|beso|lame|toca a|llama a|manda un mensaje|publica|sube una foto|confiesa|ex\b|peso|gordo|gorda|fea|feo)\b/i;

  it('ningún evento pide algo peligroso o humillante', () => {
    for (const ch of CHALLENGES) expect(BANNED.test(ch.text), `${ch.id}: ${ch.text}`).toBe(false);
    for (const e of EVENT_LIST) expect(BANNED.test(e.desc), e.id).toBe(false);
  });

  it('las groserías solo existen en el modo +18', () => {
    const SPICY = /\b(no mames|cabr[oó]n|cabrona|pinche|chingad|ching[oó]n|a huevo|verga|albur|groser[ií]a)/i;
    for (const ch of CHALLENGES) if (!ch.adult) expect(SPICY.test(ch.text), `${ch.id}: ${ch.text}`).toBe(false);
    expect(CHALLENGES.filter((ch) => ch.adult).length).toBeGreaterThanOrEqual(8);
  });

  it('sin +18 nunca sale un evento para adultos; con +18 sí', () => {
    const rng = makeRng(4);
    let clean = 0;
    let spicy = 0;
    for (let i = 0; i < 3000; i++) {
      const st = { given: [], sinceLast: 10, max: 9 };
      if (maybeChallenge('p', st, {}, 1, rng)?.adult) clean++;
      if (maybeChallenge('p', st, {}, 1, rng, [], { adult: true })?.adult) spicy++;
    }
    expect(clean).toBe(0);
    expect(spicy).toBeGreaterThan(100);
  });

  it('hay eventos mexicanos de sobra y cada tipo tiene su ficha', () => {
    expect(TURN_EVENTS.filter((ch) => ch.kind === 'mx' && !ch.adult).length).toBeGreaterThanOrEqual(15);
    expect(MX_ACCENTS.length).toBeGreaterThanOrEqual(8);
    for (const ch of CHALLENGES) expect(KIND_META[ch.kind], ch.id).toBeDefined();
    for (const m of MISSIONS) expect(m.round, m.id).toBe(true);
  });

  it('los tipos apagados no salen', () => {
    const rng = makeRng(2);
    for (let i = 0; i < 1500; i++) {
      const ch = maybeChallenge('p', { given: [], sinceLast: 10, max: 9 }, {}, 1, rng, [], { kindsOff: ['voz', 'mx', 'caos'] });
      if (ch) expect(['voz', 'mx', 'caos']).not.toContain(ch.kind);
    }
  });
});

describe('probabilidad de eventos', () => {
  it('sube con la frecuencia elegida y con los turnos sin evento', () => {
    expect(challengeChance(0, 'chill')).toBeLessThan(challengeChance(0, 'normal'));
    expect(challengeChance(0, 'normal')).toBeLessThan(challengeChance(0, 'wild'));
    expect(challengeChance(0, 'wild')).toBeLessThan(challengeChance(0, 'chaos'));
    expect(challengeChance(2, 'normal')).toBeGreaterThan(challengeChance(0, 'normal'));
    expect(challengeChance(50, 'normal')).toBe(INTENSITY.normal.turnCap);
  });

  it('la frecuencia de eventos de ronda coincide con lo que se anuncia', () => {
    const rate = (intensity: 'chill' | 'normal' | 'wild' | 'chaos') => {
      const rng = makeRng(11);
      let n = 0;
      for (let i = 0; i < 4000; i++) if (rollEvent({ enabled: true, sessionRound: 5, players: 6, impostors: 1, horrorAvailable: true, intensity }, rng)) n++;
      return n / 4000;
    };
    for (const k of ['chill', 'normal', 'wild', 'chaos'] as const) expect(Math.abs(rate(k) - INTENSITY[k].event)).toBeLessThan(0.03);
  });

  it('la primera ronda no tiene evento, salvo en Caos', () => {
    const rng = makeRng(1);
    const base = { enabled: true, sessionRound: 1, players: 6, impostors: 1, horrorAvailable: true };
    for (let i = 0; i < 200; i++) expect(rollEvent({ ...base, intensity: 'wild' }, rng)).toBeUndefined();
    expect(rollEvent({ ...base, intensity: 'chaos' }, rng)).toBeDefined();
  });

  it('respeta los eventos apagados y el mínimo de jugadores', () => {
    const ids = (players: number, off: (keyof typeof EVENTS)[] = []) => eligibleEvents({ players, impostors: 1, horrorAvailable: false, off }).map((e) => e.id);
    expect(ids(3)).not.toContain('jester');
    expect(ids(4)).toContain('jester');
    expect(ids(4)).not.toContain('double');
    expect(ids(6)).not.toContain('terror');
    expect(ids(6, ['mexican', 'bounty'])).not.toContain('mexican');
    expect(ids(6, ['mexican', 'bounty'])).toContain('mime');
  });

  it('"no había impostor" siempre va oculto; los de reglas nunca', () => {
    const rng = makeRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      seen.add(String(rollHidden('nobody', rng)));
      expect(rollHidden('oneword', rng)).toBeUndefined();
      expect(rollHidden('mexican', rng)).toBeUndefined();
    }
    expect([...seen].sort()).toEqual(['mystery', 'silent']);
  });
});

describe('misiones secretas', () => {
  it('se reparten según la frecuencia, sin repetir y respetando el máximo', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f'];
    const rng = makeRng(6);
    let total = 0;
    for (let i = 0; i < 2000; i++) {
      const m = dealMissions(players, ['a'], {}, 1, rng, { enabled: true, intensity: 'normal' });
      const ids = Object.values(m);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeLessThanOrEqual(INTENSITY.normal.missionMax(players.length));
      for (const id of ids) expect(CH_BY_ID[id].secret).toBe(true);
      // El impostor que sabe que lo es no recibe misiones pensadas para civiles.
      if (m.a) expect(CH_BY_ID[m.a].civ).toBeFalsy();
      total += ids.length;
    }
    expect(total / 2000).toBeGreaterThan(0.6);
    expect(Object.keys(dealMissions(players, [], {}, 1, rng, { enabled: false }))).toHaveLength(0);
  });
});

describe('conteo de votos', () => {
  it('gana el más votado', () => {
    const t = tally({ a: 'c', b: 'c', c: 'a', d: NOBODY });
    expect(t.accused).toEqual(['c']);
    expect(t.tie).toBe(false);
    expect(t.counts.c).toBe(2);
  });
  it('si hay empate no se acusa a nadie', () => {
    expect(tally({ a: 'b', b: 'a' })).toMatchObject({ accused: [], tie: true, nobody: false });
    expect(tally({})).toMatchObject({ accused: [], tie: true });
    expect(tally({ a: 'b', b: NOBODY })).toMatchObject({ accused: [], tie: true, nobody: false });
  });
  it('"no hay impostor" gana solo con mayoría clara', () => {
    expect(tally({ a: NOBODY, b: NOBODY, c: 'a' })).toMatchObject({ accused: [], nobody: true, tie: false });
  });
  it('con dos sospechosos toma a los dos más votados sin partir empates', () => {
    expect(tally({ a: 'x', b: 'x', c: 'y', d: 'y', e: 'z' }, 2).accused.sort()).toEqual(['x', 'y']);
    expect(tally({ a: 'x', b: 'x', c: 'y', d: 'z' }, 2).accused).toEqual(['x']);
  });
});

describe('puntuación de los eventos nuevos', () => {
  const base = { players: ['a', 'b', 'c', 'd', 'e'], impostors: ['a'], guessed: {}, challenges: {}, cursed: [], nobodyVote: false };
  const line = (r: ReturnType<typeof scoreRound>, p: string) => r.lines.find((l) => l.player === p)!;

  it('el bufón gana si lo acusan, y no cuenta como error de los civiles', () => {
    const r = scoreRound({ ...base, accused: ['b', 'a'], jester: 'b', event: 'jester' });
    expect(line(r, 'b').base).toBe(100 + 200);
    expect(line(r, 'c').base).toBe(100);
    expect(line(scoreRound({ ...base, accused: ['a'], jester: 'b', event: 'jester' }), 'b').base).toBe(100);
  });

  it('en eliminación, cada inocente echado por error baja el premio de los civiles', () => {
    expect(line(scoreRound({ ...base, accused: ['a'] }), 'c').base).toBe(100);
    expect(line(scoreRound({ ...base, accused: ['b', 'a'] }), 'c').base).toBe(75);
    expect(line(scoreRound({ ...base, accused: ['b', 'c', 'd', 'a'] }), 'e').base).toBe(25);
  });

  it('la ronda dorada duplica todo', () => {
    const r = scoreRound({ ...base, accused: ['a'], event: 'bounty', challenges: { c: true }, cursed: ['d'] });
    expect(line(r, 'b').base).toBe(200);
    expect(line(r, 'c').bonus).toBe(100);
    expect(line(r, 'd').bonus).toBe(-100);
  });

  it('las misiones secretas valen más que un evento de turno', () => {
    const r = scoreRound({ ...base, accused: ['a'], challenges: { b: true }, missions: { c: true, d: false } });
    expect(line(r, 'b').bonus).toBe(50);
    expect(line(r, 'c').bonus).toBe(100);
    expect(line(r, 'd').bonus).toBe(-25);
  });
});

describe('reglas de la ronda', () => {
  it('el reloj se acorta después de una eliminación, nunca menos de un minuto', () => {
    expect(clockFor(180, 1)).toBe(180);
    expect(clockFor(180, 2)).toBe(120);
    expect(clockFor(120, 3)).toBe(60);
    expect(clockFor(0, 2)).toBe(0);
  });

  it('cuántos sospechosos se acusan', () => {
    const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(suspectsNeeded({ elimination: true, declared: 3, order, accused: [] })).toBe(1);
    expect(suspectsNeeded({ elimination: false, declared: 3, order, accused: [] })).toBe(3);
    // Nunca se pide acusar a tantos que no quede a quién creerle.
    expect(suspectsNeeded({ elimination: false, declared: 2, order: ['a', 'b', 'c'], accused: [] })).toBe(1);
  });
});

describe('cantidad de impostores', () => {
  it('siempre quedan más civiles que impostores', () => {
    for (let n = 3; n <= 20; n++) {
      const max = maxImpostors(n);
      expect(n - max, `n=${n}`).toBeGreaterThan(max);
      expect(recommendedImpostors(n)).toBeLessThanOrEqual(max);
      expect(resolveImpostors(99, n)).toBe(max);
      expect(resolveImpostors(0, n)).toBe(recommendedImpostors(n));
    }
    expect([3, 5, 6, 9, 12, 16, 20].map(recommendedImpostors)).toEqual([1, 1, 2, 3, 4, 5, 5]);
    expect(balanceOf(1, 9)).toBe('easy');
    expect(balanceOf(3, 9)).toBe('fair');
    expect(balanceOf(4, 9)).toBe('hard');
  });

  it('el impostor extra solo sale si cabe uno más', () => {
    const ids = (players: number, impostors: number) => eligibleEvents({ players, impostors, horrorAvailable: true }).map((e) => e.id);
    expect(ids(5, 1)).toContain('double');
    expect(ids(5, 2)).not.toContain('double');
    expect(ids(9, 3)).toContain('double');
    expect(ids(9, 4)).not.toContain('double');
  });

  it('premio parcial proporcional y modo equipo', () => {
    const base = { players: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], impostors: ['a', 'b', 'c'], guessed: {}, challenges: {}, cursed: [], nobodyVote: false };
    const line = (r: ReturnType<typeof scoreRound>, p: string) => r.lines.find((l) => l.player === p)!;
    expect(line(scoreRound({ ...base, accused: ['a'] }), 'i').base).toBe(35);
    expect(line(scoreRound({ ...base, accused: ['a', 'b'] }), 'i').base).toBe(65);
    // Solos: el atrapado no gana nada. En equipo, si sobrevive alguno, el atrapado también suma.
    expect(line(scoreRound({ ...base, accused: ['a'] }), 'a').base).toBe(0);
    expect(line(scoreRound({ ...base, accused: ['a'], team: true }), 'a').base).toBe(100);
    expect(line(scoreRound({ ...base, accused: ['a', 'b', 'c'], team: true }), 'a').base).toBe(0);
  });
});

describe('partida completa en el store', () => {
  const g = () => useGame.getState();
  const round = () => g().round as Round;

  beforeEach(() => {
    useGame.setState({ players: [], profiles: {}, round: null, online: false, benched: undefined, screen: 'home' });
    g().newSession();
    g().clearHistory();
    for (const n of ['Ana', 'Beto', 'Caro', 'Dani', 'Eli']) g().addPlayer(n);
    g().setSettings({ events: false, challenges: false, missions: false, elimination: true, laps: 1, voteStyle: 'group', intensity: 'normal', adult: false, impostors: 0, impTeam: false, mode: 'similar' });
  });

  const deal = () => {
    g().startRound();
    for (let i = 0; i < g().players.length; i++) g().dealNext();
  };

  it('con muchos jugadores reparte varios impostores, cada uno con carta distinta (o la misma en equipo)', () => {
    for (const n of ['Fer', 'Gabi', 'Hugo', 'Iris']) g().addPlayer(n);
    expect(g().players).toHaveLength(9);
    g().setSettings({ impostors: 0, impTeam: false, mode: 'similar' });
    for (let i = 0; i < 15; i++) {
      g().startRound();
      const r = round();
      expect(r.impostors).toHaveLength(3);
      expect(r.declared).toBe(3);
      expect(Object.keys(r.decoys).sort()).toEqual([...r.impostors].sort());
      expect(new Set(Object.values(r.decoys)).size).toBe(3);
      expect(Object.values(r.decoys)).not.toContain(r.civil);
    }
    g().setSettings({ impostors: 4, impTeam: true });
    g().startRound();
    expect(round().impostors).toHaveLength(4);
    expect(round().team).toBe(true);
    expect(new Set(Object.values(round().decoys)).size).toBe(1);
    // Pedir más de los que caben se ajusta al máximo (9 jugadores → 4).
    g().setSettings({ impostors: 8 });
    g().startRound();
    expect(round().impostors).toHaveLength(4);
  });

  it('sin eliminación se acusa a tantos como impostores haya', () => {
    for (const n of ['Fer', 'Gabi']) g().addPlayer(n);
    g().setSettings({ impostors: 2, elimination: false });
    deal();
    g().openVote();
    g().vote(round().impostors, false);
    expect(roundStatus(round()).over).toBe(true);
    g().finishRound();
    expect(round().result!.winner).toBe('civ');
  });

  it('eliminación: echar a un inocente sigue la ronda con reloj más corto y sin su turno', () => {
    deal();
    expect(g().screen).toBe('discuss');
    expect(round().phase).toBe('discuss');
    const innocent = round().order.find((id) => !round().impostors.includes(id))!;
    g().openVote();
    expect(round().phase).toBe('vote');
    g().vote([innocent], false);
    expect(g().screen).toBe('reveal');
    expect(roundStatus(round()).over).toBe(false);

    g().continueRound();
    expect(g().screen).toBe('discuss');
    expect(round().talks).toBe(2);
    expect(round().clock).toBe(120);
    expect(round().order[round().turn]).not.toBe(innocent);
    // Una vuelta completa nunca le da turno al eliminado y termina en votación.
    const seen: string[] = [];
    for (let i = 0; i < 10 && g().screen === 'discuss'; i++) {
      seen.push(round().order[round().turn]);
      if (isLastTurn(round())) expect(seen).toHaveLength(4);
      g().nextTurn();
    }
    expect(seen).not.toContain(innocent);
    expect(seen).toHaveLength(4);
    expect(g().screen).toBe('vote');

    g().vote([round().impostors[0]], false);
    expect(roundStatus(round()).over).toBe(true);
    g().finishRound();
    expect(round().result!.winner).toBe('civ');
    // 100 − 25 por el inocente que echaron.
    expect(round().result!.lines.find((l) => l.player === innocent)!.base).toBe(75);
    expect(g().session.round).toBe(1);
  });

  it('votación secreta: se cuentan los votos y un empate no elimina a nadie', () => {
    deal();
    const [a, b, c, d, e] = round().order;
    g().openVote();
    g().castVote(a, b);
    g().castVote(b, a);
    g().castVote(c, NOBODY);
    expect(g().screen).toBe('vote');
    g().closeVote();
    expect(round().lastTally!.tie).toBe(true);
    expect(round().accused).toEqual([]);
    expect(roundStatus(round()).over).toBe(false);

    g().continueRound();
    g().openVote();
    for (const v of [a, b, c]) g().castVote(v, d);
    g().castVote(d, e);
    g().castVote(e, 'no-existe');
    g().closeVote();
    expect(round().accused).toEqual([d]);
    expect(round().lastTally!.counts[d]).toBe(3);
    expect(Object.keys(round().votes)).toHaveLength(0);
  });

  it('un eliminado ya no puede votar ni ser votado', () => {
    deal();
    const innocent = round().order.find((id) => !round().impostors.includes(id))!;
    const other = round().order.find((id) => id !== innocent)!;
    g().openVote();
    g().vote([innocent], false);
    g().continueRound();
    g().openVote();
    g().castVote(innocent, other);
    g().castVote(other, innocent);
    expect(round().votes).toEqual({});
  });

  it('el evento de turno se quita al pasar al siguiente jugador y se puede calificar ahí mismo', () => {
    g().setSettings({ challenges: true, intensity: 'chaos', laps: 3 });
    deal();
    let found: string | undefined;
    for (let i = 0; i < 12 && !found; i++) {
      const pid = round().order[round().turn];
      const ev = activeTurnEvent(round(), pid);
      if (ev && !ev.round) {
        found = pid;
        expect(round().pendingChallenge).toBe(pid);
        g().dismissChallenge();
        g().nextTurn(true);
        expect(activeTurnEvent(round(), pid)).toBeUndefined();
        expect(round().expired).toContain(pid);
        expect(round().challengeResults[pid]).toBe(true);
        // Ya calificado: no vuelve a pedirse al final.
        expect(pendingJudgments(round()).some((j) => j.player === pid)).toBe(false);
      } else {
        g().dismissChallenge();
        g().nextTurn();
      }
    }
    expect(found).toBeDefined();
  });

  it('reparte misiones secretas y las pide calificar al final', () => {
    g().setSettings({ missions: true, intensity: 'chaos' });
    let withMission = 0;
    for (let i = 0; i < 20; i++) {
      g().startRound();
      const m = round().missions;
      withMission += Object.keys(m).length;
      for (const [p, id] of Object.entries(m)) {
        expect(round().order).toContain(p);
        expect(CH_BY_ID[id].secret).toBe(true);
      }
      expect(pendingJudgments(round()).filter((j) => j.mission)).toHaveLength(Object.keys(m).length);
    }
    expect(withMission).toBeGreaterThan(10);
  });

  it('sala: los teléfonos entran, cada quien marca listo y votan por separado', () => {
    g().openRoom({ id: 'host', name: 'Luis' });
    expect(g().online).toBe(true);
    expect(g().benched).toHaveLength(5);
    expect(g().players.map((p) => p.name)).toEqual(['Luis']);
    expect(g().joinPlayer('g1', 'Mar')).toBe(true);
    expect(g().joinPlayer('g2', 'mar')).toBe(true);
    expect(g().joinPlayer('g3', 'Paz')).toBe(true);
    expect(g().players.map((p) => p.name)).toEqual(['Luis', 'Mar', 'mar 2', 'Paz']);
    // Reconectarse no duplica al jugador.
    expect(g().joinPlayer('g1', 'Mar')).toBe(true);
    expect(g().players).toHaveLength(4);
    expect(new Set(g().players.map((p) => p.color)).size).toBe(4);

    g().startRound();
    g().go('deal');
    g().remote('g1', { a: 'ready' });
    g().remote('intruso', { a: 'ready' });
    g().remote('g2', { a: 'ready' });
    g().remote('g3', { a: 'ready' });
    expect(g().screen).toBe('deal');
    g().markReady('host');
    expect(g().screen).toBe('discuss');

    // Solo quien tiene el turno puede pasarlo.
    const turn = round().order[round().turn];
    const notTurn = round().order.find((id) => id !== turn && id !== 'host')!;
    g().remote(notTurn, { a: 'next' });
    expect(round().order[round().turn]).toBe(turn);
    if (turn !== 'host') g().remote(turn, { a: 'next' });
    else g().nextTurn();
    expect(round().order[round().turn]).not.toBe(turn);

    g().openVote();
    const target = round().order[0];
    for (const v of round().order.slice(0, 3)) g().remote(v, { a: 'vote', target });
    expect(g().screen).toBe('vote');
    g().remote(round().order[3], { a: 'vote', target });
    // Con el último voto se cierra sola.
    expect(g().screen).toBe('reveal');
    expect(round().lastVote).toEqual([target]);

    g().closeRoom();
    expect(g().online).toBe(false);
    expect(g().players).toHaveLength(5);
  });

  it('sala con jugadores sin teléfono: dos teléfonos alcanzan para cinco personas', () => {
    g().openRoom({ id: 'host', name: 'Luis' });
    g().joinPlayer('g1', 'Mar');
    expect(g().addLocal('host', 'Ana')).toBe(true);
    expect(g().addLocal('g1', 'Beto')).toBe(true);
    expect(g().addLocal('g1', 'Caro')).toBe(true);
    // Un id que no es un teléfono de la sala no puede sumar a nadie.
    expect(g().addLocal('intruso', 'Zoe')).toBe(false);
    const id = (n: string) => g().players.find((p) => p.name === n)!.id;
    expect(g().players.find((p) => p.name === 'Beto')!.owner).toBe('g1');

    // Desde otro teléfono no se puede actuar por alguien ajeno.
    g().remote('g1', { a: 'avatar', as: id('Ana'), avatar: '🐲' });
    expect(g().players.find((p) => p.name === 'Ana')!.avatar).not.toBe('🐲');
    g().remote('g1', { a: 'avatar', as: id('Beto'), avatar: '🐲' });
    expect(g().players.find((p) => p.name === 'Beto')!.avatar).toBe('🐲');
    g().remote('g1', { a: 'addLocal', name: 'Dani' });
    expect(g().players).toHaveLength(6);
    g().remote('g1', { a: 'removeLocal', as: id('Dani') });
    expect(g().players).toHaveLength(5);

    g().startRound();
    g().go('deal');
    // g1 marca listos a los suyos; no puede marcar a Ana (es del anfitrión).
    for (const n of ['Mar', 'Beto', 'Caro', 'Ana']) g().remote('g1', { a: 'ready', as: id(n) });
    expect(round().ready.sort()).toEqual([id('Mar'), id('Beto'), id('Caro')].sort());
    g().markReady(id('Ana'));
    g().markReady('host');
    expect(g().screen).toBe('discuss');

    g().openVote();
    const target = id('Luis');
    for (const n of ['Mar', 'Beto', 'Caro']) g().remote('g1', { a: 'vote', as: id(n), target });
    g().castVote(id('Ana'), target);
    expect(g().screen).toBe('vote');
    g().castVote('host', id('Mar'));
    expect(g().screen).toBe('reveal');
    expect(round().lastVote).toEqual([target]);

    // Si se va un teléfono entre rondas, se van también quienes jugaban en él.
    useGame.setState({ round: null });
    g().removePlayer('g1');
    expect(g().players.map((p) => p.name).sort()).toEqual(['Ana', 'Luis']);
    g().closeRoom();
  });
});
