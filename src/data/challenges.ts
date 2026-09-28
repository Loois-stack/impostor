export type ChallengeKind = 'voz' | 'traicion' | 'restriccion' | 'actuacion' | 'caos';

export interface Challenge {
  id: string;
  kind: ChallengeKind;
  text: string;
  /** Solo lo ve el jugador afectado (mantener presionado). */
  secret?: boolean;
  /** Dura toda la ronda en vez de solo este turno. */
  round?: boolean;
}

export const KIND_META: Record<ChallengeKind, { label: string; emoji: string; color: string }> = {
  voz: { label: 'Voz ridícula', emoji: '🎙️', color: '#ff5fc8' },
  traicion: { label: 'Traición', emoji: '🗡️', color: '#ff2e4d' },
  restriccion: { label: 'Restricción', emoji: '⛓️', color: '#ffb547' },
  actuacion: { label: 'Actuación', emoji: '🎭', color: '#48c6ff' },
  caos: { label: 'Caos', emoji: '🌪️', color: '#7c5cff' },
};

const c = (kind: ChallengeKind, rows: [string, string, ('s' | 'r' | 'sr')?][]): Challenge[] =>
  rows.map(([id, text, f]) => ({ id, kind, text, secret: f?.includes('s'), round: f?.includes('r') }));

export const CHALLENGES: Challenge[] = [
  ...c('voz', [
    ['v1', 'Da tu pista con voz de pitufo (súper aguda) 🐭'],
    ['v2', 'Da tu pista con voz de robot: todo… pausado… y… sin… emoción 🤖'],
    ['v3', 'Habla como narrador de película de terror, susurrando y con pausas dramáticas 🕯️'],
    ['v4', 'Da tu pista cantando como ópera 🎶'],
    ['v5', 'Habla como abuelita regañona durante tu turno 👵'],
    ['v6', 'Da tu pista como comentarista de fútbol emocionado: ¡GOOOOL! ⚽'],
    ['v7', 'Habla con acento argentino hasta que termine la ronda 🧉', 'r'],
    ['v8', 'Da tu pista como si fueras un bebé llorón 👶'],
    ['v9', 'Habla como villano malvado con risa final: ¡MUAJAJAJA! 😈'],
    ['v10', 'Da tu pista con la nariz tapada 🤏'],
    ['v11', 'Habla como streamer gritándole al chat: "¡CHAT, CHAT, MIREN!" 📢'],
    ['v12', 'Da tu pista en voz de reguetón: "Dimelo…" 🎤'],
    ['v13', 'Habla como Yoda: al revés tus frases decir debes, hasta que termine la ronda 🟢', 'r'],
    ['v14', 'Da tu pista con voz de anuncio de radio de los 90 📻'],
    ['v15', 'Da tu pista susurrando como ASMR, muy cerca del teléfono 🎧'],
    ['v16', 'Habla como pirata hasta que termine la ronda: "¡Arrr, marinero!" 🏴‍☠️', 'r'],
    ['v17', 'Da tu pista con voz de Goofy o de caricatura ridícula 🐶'],
    ['v18', 'Da tu pista como si fuera un comercial de teletienda: "¡Pero espere, hay más!" 📺'],
  ]),
  ...c('traicion', [
    ['t1', 'SECRETO: Defiende a quien más sospechas. Convence a todos de que NO es el impostor, aunque se vuelvan contra ti 🕵️', 'sr'],
    ['t2', 'SECRETO: Actúa sospechoso a propósito toda la ronda. Que parezca que tú eres el impostor 😈', 'sr'],
    ['t3', 'SECRETO: Da una pista MUY vaga para que desconfíen de ti 🌫️', 's'],
    ['t4', 'SECRETO: Acusa a alguien que estés seguro que es inocente, con mucha convicción ☝️', 'sr'],
    ['t5', 'SECRETO: Durante la votación, vota por ti mismo (o intenta convencer de que lo hagan) 🙃', 'sr'],
    ['t6', 'SECRETO: Si crees saber quién es el impostor, ayúdalo sutilmente a sobrevivir esta ronda 🤝', 'sr'],
    ['t7', 'Di en voz alta a quién sospechas… y luego defiéndelo como su abogado 👨‍⚖️'],
    ['t8', 'SECRETO: Repite casi igual la pista del jugador anterior, como si la copiaras 🦜', 's'],
    ['t9', 'Elige a un jugador: esta ronda tienes que estar de acuerdo con todo lo que diga 🫡', 'r'],
    ['t10', 'SECRETO: Finge que tu carta es otra cosa parecida. Que duden de ti sin ser el impostor 🎭', 's'],
    ['t11', 'SECRETO: En la votación, cambia tu opinión en el último segundo y convence a otro de hacerlo 🔄', 'sr'],
    ['t12', 'SECRETO: Haz que alguien más diga la palabra "impostor" antes de votar. Si lo logras, cumpliste 😏', 'sr'],
    ['t13', 'Acusa en voz alta a la persona de tu derecha… y después dale tu voto de confianza 🤷'],
  ]),
  ...c('restriccion', [
    ['r1', 'Tu pista no puede tener la letra "E" 🚫'],
    ['r2', 'Da tu pista en exactamente 3 palabras 3️⃣'],
    ['r3', 'Tu pista debe rimar con tu nombre 🎵'],
    ['r4', 'Da tu pista sin mover los labios (tipo ventrílocuo) 🗣️'],
    ['r5', 'Tu pista tiene que ser una sola palabra que empiece con "P" 🅿️'],
    ['r6', 'Da tu pista sin usar la mano ni gestos: brazos cruzados todo el turno 🙅'],
    ['r7', 'Da tu pista en inglés (o el idioma que no domines) 🌍'],
    ['r8', 'Tu pista debe ser el nombre de una canción o película 🎬'],
    ['r9', 'Solo puedes responder con preguntas hasta que termine la ronda ❓', 'r'],
    ['r10', 'Da tu pista con los ojos cerrados y sin reírte 😑'],
    ['r11', 'Da tu pista usando solo sonidos, sin palabras 🔊'],
    ['r12', 'Di tu pista y después cuenta del 10 al 1 al revés sin trabarte 🔢'],
    ['r13', 'Tu pista debe tener al menos 7 palabras 🧾'],
    ['r14', 'Da tu pista solo con palabras que empiecen con la misma letra 🔤'],
    ['r15', 'Tu pista debe ser un emoji que describas con sonidos y gestos 😶'],
    ['r16', 'No puedes decir "sí" ni "no" hasta que termine la ronda 🤐', 'r'],
    ['r17', 'Tu pista tiene que ser una comparación: "Es como…" 🔗'],
  ]),
  ...c('actuacion', [
    ['a1', 'Da tu pista con mímica, sin hablar 🤐'],
    ['a2', 'Actúa como si tu carta fuera tu mejor amigo y preséntalo (sin decir el nombre) 🤗'],
    ['a3', 'Da tu pista bailando 💃'],
    ['a4', 'Da tu pista en cámara lenta 🐌'],
    ['a5', 'Haz una pose dramática de telenovela antes de hablar 🌹'],
    ['a6', 'Da tu pista como si estuvieras llorando desconsoladamente 😭'],
    ['a7', 'Dibuja tu pista en el aire con el dedo ✍️'],
    ['a8', 'Da tu pista como si estuvieras dando una noticia urgente en el noticiero 📰'],
    ['a9', 'Haz el sonido que haría tu carta (si pudiera hacer uno) 🔉'],
    ['a10', 'Da tu pista mientras haces sentadillas 🏋️'],
    ['a11', 'Da tu pista como si fueras un robot que se está descomponiendo 🤖'],
    ['a12', 'Da tu pista como villano de telenovela que revela un secreto 😱'],
    ['a13', 'Da tu pista como si estuvieras en cámara rápida (x2) ⏩'],
    ['a14', 'Actúa tu pista como si fueras un animal (y sin decir cuál) 🐒'],
  ]),
  ...c('caos', [
    ['c1', 'Cambia de lugar con el jugador de tu derecha 🔄'],
    ['c2', 'El jugador de tu izquierda da la pista por ti. ¡Tú no puedes corregirlo! 🙊'],
    ['c3', 'Todos deben aplaudir 3 veces cuando termines. Si alguien no lo hace, sospechen de él 👏'],
    ['c4', 'Antes de tu pista, di algo que te guste de cada jugador 💖'],
    ['c5', 'Elige a alguien: esa persona debe darte una pista extra ahora mismo ☝️'],
    ['c6', 'Tu pista debe empezar con "Había una vez…" 📖'],
    ['c7', 'Mira fijamente a alguien durante toda tu pista sin parpadear 👁️'],
    ['c8', 'Choca los cinco con quien creas que es el impostor ✋'],
    ['c9', 'Todos cierran los ojos mientras das tu pista 🙈'],
    ['c10', 'Todos deben repetir tu pista en coro. Quien se equivoque, es sospechoso 🎶'],
    ['c11', 'Elige a alguien: esa persona debe explicar TU pista por ti 🗣️'],
    ['c12', 'Pon una regla nueva para el resto de la ronda (ej. no decir "no") 📜', 'r'],
    ['c13', 'Da tu pista y luego señala a tu principal sospechoso durante 5 segundos 👉'],
    ['c14', 'Cambia de lugar con quien tú quieras antes de tu pista 🪑'],
  ]),
];
