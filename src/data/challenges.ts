/**
 * Eventos especiales de un jugador.
 *
 * - Eventos de turno: son públicos, le salen al jugador cuando le toca dar su pista y se van
 *   al pasar al siguiente (salvo los pocos marcados como "toda la ronda").
 * - Misiones secretas: se reparten junto con la carta; solo las conoce quien las recibe y se
 *   revelan al final de la ronda.
 *
 * REGLAS DE SEGURIDAD para agregar eventos (hay una prueba que las vigila):
 *   · Nada de alcohol ni de comer/beber cosas, ni de usar el teléfono de alguien.
 *   · Nada de contacto físico obligado, golpes, correr, saltar, cargar a alguien ni salir del lugar.
 *   · Nada que humille, exponga secretos o señale el cuerpo, la familia o la vida privada de alguien.
 *   · El modo +18 solo agrega groserías y picardía: se le dicen a la carta, nunca a una persona.
 */
export type ChallengeKind = 'voz' | 'mx' | 'restriccion' | 'actuacion' | 'caos' | 'traicion';

export interface Challenge {
  id: string;
  kind: ChallengeKind;
  text: string;
  /** Misión secreta: se reparte con la carta y solo la ve quien la recibe. */
  secret?: boolean;
  /** Dura toda la ronda en vez de solo este turno. */
  round?: boolean;
  /** Solo aparece con el modo +18 activado. */
  adult?: boolean;
  /** Misión que solo tiene sentido para un civil. */
  civ?: boolean;
}

export const KIND_META: Record<ChallengeKind, { label: string; emoji: string; color: string; example: string }> = {
  voz: { label: 'Voz ridícula', emoji: '🎙️', color: '#ff5fc8', example: 'Da tu pista con voz de robot' },
  mx: { label: 'Acento mexicano', emoji: '🇲🇽', color: '#19c37d', example: 'Habla como vendedor de tianguis' },
  restriccion: { label: 'Restricción', emoji: '⛓️', color: '#ffb547', example: 'Tu pista en exactamente 3 palabras' },
  actuacion: { label: 'Actuación', emoji: '🎭', color: '#48c6ff', example: 'Da tu pista en cámara lenta' },
  caos: { label: 'Caos', emoji: '🌪️', color: '#7c5cff', example: 'Todos repiten tu pista en coro' },
  traicion: { label: 'Traición', emoji: '🗡️', color: '#ff2e4d', example: 'Defiende a quien más sospechas' },
};

/** Banderas: s = misión secreta, r = toda la ronda, x = solo +18, c = solo para civiles. */
const c = (kind: ChallengeKind, rows: [string, string, string?][]): Challenge[] =>
  rows.map(([id, text, f = '']) => ({
    id,
    kind,
    text,
    secret: f.includes('s') || undefined,
    round: f.includes('r') || f.includes('s') || undefined,
    adult: f.includes('x') || undefined,
    civ: f.includes('c') || undefined,
  }));

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
    ['v12', 'Da tu pista en voz de reguetón: "Dímelo…" 🎤'],
    ['v13', 'Habla como Yoda: al revés tus frases decir debes, hasta que termine la ronda 🟢', 'r'],
    ['v14', 'Da tu pista con voz de anuncio de radio de los 90 📻'],
    ['v15', 'Da tu pista susurrando como ASMR 🎧'],
    ['v16', 'Habla como pirata hasta que termine la ronda: "¡Arrr, marinero!" 🏴‍☠️', 'r'],
    ['v17', 'Da tu pista con voz de Goofy o de caricatura ridícula 🐶'],
    ['v18', 'Da tu pista como si fuera un comercial de teletienda: "¡Pero espere, hay más!" 📺'],
    ['v19', 'Da tu pista con acento español de España: "¡Ostras, tío, qué fuerte!" 🇪🇸'],
    ['v20', 'Da tu pista como GPS: "En doscientos metros… gire a la derecha" 🧭'],
    ['v21', 'Da tu pista como locutor de aeropuerto: "Pasajeros con destino a…" ✈️'],
  ]),
  ...c('mx', [
    ['m1', 'Da tu pista con acento norteño, bien golpeado: "¡Ey, compa! ¡Arre!" 🤠'],
    ['m2', 'Habla como chilango cantadito: "No maaanches, güeeey, ¿qué pasóóó?" 🚇'],
    ['m3', 'Habla como fresa: "O sea, güey, tipo… literal, qué oso" 💅'],
    ['m4', 'Da tu pista como vendedor de tianguis: "¡Pásele, pásele! ¡Bara, bara, llévelo!" 🛍️'],
    ['m5', 'Da tu pista como el camión del fierro viejo: "Se compraaan… colchones, tambores, refrigeradores…" 📢'],
    ['m6', 'Habla como abuelita mexicana: "Ay, mijito, ¿ya comiste? Ponte un suéter" 👵'],
    ['m7', 'Narra tu pista como comentarista de lucha libre: "¡Desde la tercera cuerdaaa, señoras y señores!" 🤼'],
    ['m8', 'Da tu pista como locutor de sonidero mandando saludos: "¡Y un saludo para toda la banda!" 🔊'],
    ['m9', 'Habla con acento yucateco, pausado y golpeadito: "¡Mare, lindo hermoso!" 🌴'],
    ['m10', 'Habla como costeño, rapidito y comiéndote las eses: "¡Qué pasó, mi vida! E\'to e\' así" 🌊'],
    ['m11', 'Da tu pista como galán de telenovela: "¡Tú no puedes hacerme esto, María Fernanda!" 🌹'],
    ['m12', 'Grita tu pista como vendedor de tamales: "¡Ricos tamales oaxaqueños, calientitos!" 🫔'],
    ['m13', 'Habla como regio en carnita asada: "¡Qué onda, primo! Jálese" 🥩'],
    ['m14', 'Canta tu pista como mariachi y remata con un grito: "¡Ay, ay, ay, ay!" 🎺'],
    ['m15', 'Habla como tu tía en el grupo de WhatsApp: "Buenos días, bendiciones, reenvíalo a 10 contactos" 🙏'],
    ['m16', 'Cantinflea: habla mucho sin decir nada claro. "O sea, ahí está el detalle, chato" 🎩'],
    ['m17', 'Hasta que termine la ronda, termina cada frase con "güey" 😎', 'r'],
    ['m18', 'Da tu pista como el señor del gas: "¡El gaaaaas!" y luego la pista cantadita ⛽'],
    ['m19', 'Da tu pista como maestra de primaria regañando al grupo: "A ver, jóvenes, guarden silencio" 🍎'],
    ['m20', 'Da tu pista como comentarista de fut mexicano: "¡Y es un golazo, señores, no lo puedo creer!" 🎙️'],
    ['x1', 'Da tu pista como chilango malhablado: mete un "no mames, güey" o un "está cabrón" 🌶️', 'x'],
    ['x2', 'Da tu pista y remátala con tu mejor grosería mexicana (se la dices a la carta, no a la gente) 🌶️', 'x'],
    ['x3', 'Hasta que termine la ronda, pon "pinche" antes de cada cosa que nombres: "esa pinche carta…" 🌶️', 'rx'],
    ['x4', 'Da tu pista con un albur… o con el peor intento de albur de la historia 😏', 'x'],
    ['x5', 'Regaña a tu carta como mamá mexicana enojada, con todo y groserías: "¡Me lleva la chingada contigo!" 🩴', 'x'],
    ['x6', 'Da tu pista como aficionado reclamándole al árbitro, con todas las groserías que te sepas ⚽🌶️', 'x'],
    ['x7', 'Reclámale a tu carta como si te hubiera puesto el cuerno: "¡Eres de lo peor, cabrona!" 💔', 'x'],
    ['x8', 'Da tu pista como borrachito de cantina (actuado, sin tomar nada): "Te lo juro por mi madre, compadre" 🥴', 'x'],
    ['x9', 'Presume tu carta como si fuera lo más chingón del mundo, usando "chingón" al menos 3 veces 🏆', 'x'],
    ['x10', 'Da tu pista y que todos contesten en coro: "¡A huevo!" 📣', 'x'],
  ]),
  ...c('traicion', [
    ['t1', 'Defiende a quien más sospechas. Convence a todos de que NO es el impostor, aunque se vuelvan contra ti 🕵️', 'sc'],
    ['t2', 'Actúa sospechoso a propósito toda la ronda. Que parezca que tú eres el impostor 😈', 's'],
    ['t3', 'Tu primera pista debe ser MUY vaga, para que desconfíen de ti 🌫️', 's'],
    ['t4', 'Acusa con mucha convicción a alguien que estés seguro de que es inocente ☝️', 's'],
    ['t5', 'En la votación, vota por ti mismo (o intenta convencerlos de que voten por ti) 🙃', 's'],
    ['t6', 'Si crees saber quién es el impostor, ayúdalo sutilmente a sobrevivir esta ronda 🤝', 'sc'],
    ['t7', 'Di en voz alta a quién sospechas… y luego defiéndelo como su abogado 👨‍⚖️'],
    ['t8', 'Repite casi igual una pista que ya dio otro jugador, como si se la copiaras 🦜', 's'],
    ['t9', 'Elige a un jugador: esta ronda tienes que estar de acuerdo con todo lo que diga 🫡', 'r'],
    ['t10', 'Finge que tu carta es otra cosa parecida. Que duden de ti sin ser el impostor 🎭', 'sc'],
    ['t11', 'En la votación, cambia de opinión en el último segundo y convence a alguien de hacerlo también 🔄', 's'],
    ['t12', 'Logra que alguien más diga la palabra "impostor" antes de votar 😏', 's'],
    ['t13', 'Acusa en voz alta a la persona de tu derecha… y después dale tu voto de confianza 🤷'],
    ['t14', 'Logra que al menos dos jugadores te hagan una pregunta directa sobre tu carta 🎣', 's'],
    ['t15', 'Usa la palabra "obviamente" en cada pista que des, sin que nadie te lo señale 🧐', 's'],
    ['t16', 'Haz reír a alguien durante tu turno. Si nadie se ríe, fallaste 😂', 's'],
    ['t17', 'Convence al grupo de votar por la persona que TÚ propongas, sea quien sea 🎯', 's'],
    ['t18', 'Cada vez que alguien te acuse, cambia de tema hablando de comida 🌮', 's'],
    ['t19', 'Logra, sin pedirlo, que otro jugador repita una palabra de tu pista 🪞', 's'],
    ['t20', 'Dale la razón a todos durante toda la ronda. Nunca contradigas a nadie 🕊️', 's'],
    ['t21', 'Antes de votar, cambia de sospechoso al menos dos veces en voz alta 🎢', 's'],
    ['t22', 'Suelta una grosería mexicana "sin querer" en cada pista y luego pide perdón muy apenado 🌶️', 'sx'],
  ]),
  ...c('restriccion', [
    ['r1', 'Tu pista no puede tener la letra "E" 🚫'],
    ['r2', 'Da tu pista en exactamente 3 palabras 3️⃣'],
    ['r3', 'Tu pista debe rimar con tu nombre 🎵'],
    ['r4', 'Da tu pista sin mover los labios (tipo ventrílocuo) 🗣️'],
    ['r5', 'Tu pista tiene que ser una sola palabra que empiece con "P" 🅿️'],
    ['r6', 'Da tu pista sin usar las manos ni gestos: brazos cruzados todo el turno 🙅'],
    ['r7', 'Da tu pista en inglés (o en el idioma que menos domines) 🌍'],
    ['r8', 'Tu pista debe ser el nombre de una canción o película 🎬'],
    ['r9', 'Solo puedes responder con preguntas hasta que termine la ronda ❓', 'r'],
    ['r10', 'Da tu pista con los ojos cerrados y sin reírte 😑'],
    ['r11', 'Da tu pista usando solo sonidos, sin palabras 🔊'],
    ['r12', 'Di tu pista y después cuenta del 10 al 1 sin trabarte 🔢'],
    ['r13', 'Tu pista debe tener al menos 7 palabras 🧾'],
    ['r14', 'Da tu pista solo con palabras que empiecen con la misma letra 🔤'],
    ['r15', 'Tu pista debe ser un emoji que describas con sonidos y gestos 😶'],
    ['r16', 'No puedes decir "sí" ni "no" hasta que termine la ronda 🤐', 'r'],
    ['r17', 'Tu pista tiene que ser una comparación: "Es como…" 🔗'],
    ['r18', 'Tu pista tiene que ser un color y nada más 🎨'],
    ['r19', 'Tu pista debe ser lo contrario de lo que es tu carta: "No es…" 🔁'],
  ]),
  ...c('actuacion', [
    ['a1', 'Da tu pista con mímica, sin hablar 🤐'],
    ['a2', 'Actúa como si tu carta fuera tu mejor amigo y preséntalo (sin decir el nombre) 🤗'],
    ['a3', 'Da tu pista bailando desde tu lugar 💃'],
    ['a4', 'Da tu pista en cámara lenta 🐌'],
    ['a5', 'Haz una pose dramática de telenovela antes de hablar 🌹'],
    ['a6', 'Da tu pista como si estuvieras llorando desconsoladamente 😭'],
    ['a7', 'Dibuja tu pista en el aire con el dedo ✍️'],
    ['a8', 'Da tu pista como si estuvieras dando una noticia urgente en el noticiero 📰'],
    ['a9', 'Haz el sonido que haría tu carta (si pudiera hacer uno) 🔉'],
    ['a10', 'Da tu pista aplaudiendo una vez por cada sílaba 👏'],
    ['a11', 'Da tu pista como si fueras un robot que se está descomponiendo 🤖'],
    ['a12', 'Da tu pista como villano de telenovela que revela un secreto 😱'],
    ['a13', 'Da tu pista como si estuvieras en cámara rápida (x2) ⏩'],
    ['a14', 'Actúa tu pista como si fueras un animal (y sin decir cuál) 🐒'],
    ['a15', 'Da tu pista como si fuera la mejor noticia de tu vida 🥳'],
    ['a16', 'Da tu pista como mago revelando su truco final: "¡Tarááán!" 🎩'],
  ]),
  ...c('caos', [
    ['c1', 'Cambia de lugar con el jugador de tu derecha 🔄'],
    ['c2', 'El jugador de tu izquierda da la pista por ti. ¡Tú no puedes corregirlo! 🙊'],
    ['c3', 'Todos deben aplaudir 3 veces cuando termines. Quien no lo haga, se vuelve sospechoso 👏'],
    ['c4', 'Antes de tu pista, di algo que te guste de cada jugador 💖'],
    ['c5', 'Elige a alguien: esa persona debe darte una pista extra ahora mismo ☝️'],
    ['c6', 'Tu pista debe empezar con "Había una vez…" 📖'],
    ['c7', 'Mira fijamente a alguien durante toda tu pista, sin reírte 👁️'],
    ['c8', 'Señala con las dos manos a quien creas que es el impostor ✋'],
    ['c9', 'Todos cierran los ojos mientras das tu pista 🙈'],
    ['c10', 'Todos deben repetir tu pista en coro. Quien se equivoque, es sospechoso 🎶'],
    ['c11', 'Elige a alguien: esa persona debe explicar TU pista por ti 🗣️'],
    ['c12', 'Pon una regla nueva para el resto de la ronda (ej. no decir "no") 📜', 'r'],
    ['c13', 'Da tu pista y luego señala a tu principal sospechoso durante 5 segundos 👉'],
    ['c14', 'Cambia de lugar con quien tú quieras antes de tu pista 🪑'],
    ['c15', 'Después de tu pista, todos señalan a la vez a su sospechoso a la cuenta de tres 🫵'],
    ['c16', 'Elige a alguien: debe repetir su última pista con voz de caricatura 🤪'],
  ]),
];

export const CH_BY_ID: Record<string, Challenge> = Object.fromEntries(CHALLENGES.map((ch) => [ch.id, ch]));

/** Eventos públicos que salen en el turno de un jugador. */
export const TURN_EVENTS = CHALLENGES.filter((ch) => !ch.secret);
/** Misiones secretas que se reparten con la carta. */
export const MISSIONS = CHALLENGES.filter((ch) => ch.secret);
