# Memoria del proyecto: IMPOSTOR — ¿Quién miente?

Juego de fiesta en español (México) para el celular: todos reciben la misma carta menos los impostores, que reciben una parecida. PWA hecha con React 19, TypeScript, Vite, Zustand y Framer Motion. Este archivo resume lo que hay que saber para seguir trabajando; el README explica el juego a los jugadores.

## Publicación

- **En línea:** https://loois-stack.github.io/impostor/ (GitHub Pages).
- Cada push a `main` dispara `.github/workflows/deploy.yml`: pruebas, compilación y publicación (menos de 1 minuto).
- **El dueño pidió que cada actualización se publique.** Flujo: trabajar en la rama de desarrollo, subirla y luego adelantar `main` (`git push origin HEAD:main`, siempre que sea fast-forward). Después, confirmar que el sitio publicado ya tiene la versión nueva.
- La app instalada busca versión nueva al abrirse, cada 5 minutos y al volver a ella (`src/services/update.ts`). En el menú se instala sola; en la sala o el marcador ofrece un botón; a media ronda nunca recarga.

## Comandos

| Comando | Para qué |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (en dev, `window.__game` expone el store) |
| `npm test` | Vitest: motor, contenido, store y reglas de seguridad de eventos |
| `npm run build` | `tsc --noEmit` + compilación de la PWA en `dist/` |
| `npm run jugar` | Compila y sirve en la red local (puerto 4173) |
| `npm run servidor-salas` | Servidor PeerJS propio (opcional) |
| `npm run validate-wiki` | Resuelve las fotos de Wikipedia → `src/data/images.json` |

Antes de publicar: `npx vitest run`, `npx tsc --noEmit` y `npm run build` sin errores. Para cambios visuales, probar en Chromium con Playwright a 390×844 y revisar capturas.

## Mapa del código

- `src/store/game.ts`: estado y reglas de la partida (rondas, fases, votos, eliminación, puntos, salas). `roundStatus`, `suspectsNeeded`, `advance`, `activeTurnEvent` y `pendingJudgments` son las reglas puras. Persistencia en `localStorage` (`impostor-v1`, con `version` y `migrate`: súbela si cambia la forma de `Round`).
- `src/store/prefs.ts`: preferencias de ESTE teléfono (sonido, música, vibración, tema visual, nombre e id de dispositivo).
- `src/store/view.ts`: qué carta y qué nota ve cada jugador (`cardFor`, `noteFor`) y qué evento conoce la mesa (`shownEvent`).
- `src/engine/`: lógica pura y probada.
  - `selector.ts`: elige categoría, carta civil y señuelos sin repetir (memoria anti-repetición).
  - `roles.ts`: elige impostores con justicia y define cuántos caben (`maxImpostors`, `recommendedImpostors`, `resolveImpostors`, `balanceOf`).
  - `events.ts`: eventos de ronda, acentos mexicanos y eventos ocultos.
  - `challenges.ts`: eventos de turno, misiones secretas y frecuencias (`INTENSITY`).
  - `scoring.ts`: puntos. `vote.ts`: conteo de votos y empates.
- `src/data/`: 836 cartas en `items/*.ts`, categorías, temas de Mezcla y eventos de turno o misiones (`challenges.ts`, con las reglas de seguridad al inicio). `packs.ts`: diseños de sobre, brillos y `rollPacks` (se guarda en `round.packs`).
- `src/screens/`: una pantalla por fase. `Intro` (ruleta), `Deal` (sobres y reparto), `Discuss` (pistas), `Vote`, `Reveal` (veredicto → última oportunidad → verdad → eventos), `LastChance` (la adivinanza del impostor), `Score`, `Lobby` y `Online` (salas), `Setup` (reglas), `Events` (catálogo).
- `src/components/`:
  - `PackOpening.tsx`: `PersonalPack` (el sobre de cada jugador: corte o fuego azul, luz, brillo y carta que sale girando), `PackShuffle` (los sobres de todos se barajan al empezar), `PackArt` y `MiniPack`.
  - Apertura del sobre (`src/data/openings.ts`, `player.open`, acción de sala `open`): ✂️ cortar (la de siempre) o 🔥 fuego azul. `OpenPicker` (en `PackGallery.tsx`) va en la hoja del avatar con sobre de prueba. El fuego está en `src/fx/bluefire.ts`: un campo de quemado fijo (`burnField`: distancia al punto tocado + ruido, escalado a 0..0.97), una máscara `mask-image` del sobre de baja resolución, y encima un shader de WebGL (carbón, grietas, orilla y llamas) más un lienzo 2D (chispas y ceniza del color del sobre). Las llamas usan el avance de la máscara que ya se ve (`shownP`) para no desfasarse. Sin WebGL, la orilla se dibuja en 2D. Sonidos en `src/audio/fire.ts`. Mientras se quema, la carta espera DENTRO del contorno del sobre (`fit`: más chica y centrada en él, sin sombra que se salga), así solo se ve por los hoyos; crece y gira hasta que ya no queda nada del sobre (`onBurnt` espera a que lo último pase la orilla encendida, `top + 0.045`) más un respiro de 220 ms.
  - `PackGallery.tsx`: galería de sobres y brillos en Ajustes, con sobre de prueba (se puede probar cada forma de abrirlo).
  - `Wheel.tsx`: la ruleta.
  - `GameCard.tsx`: las cartas.
  - `Emo.tsx`: emojis animados.
  - `EventCard.tsx` y `EventOverlay.tsx`: avisos de eventos.
- `src/components/VoteCall.tsx` (`CallButton`: pedir votación u otra vuelta, y el contador), `LeaveGame.tsx` (salir con confirmación), `Meeting.tsx` (reunión al terminar la vuelta) y `Voice.tsx` (botón flotante y controles de la llamada).
- `src/net/voice.ts`: llamada de voz de la sala (malla WebRTC por PeerJS; el anfitrión reparte la lista `roster` en cada estado y llama el teléfono con id menor). Silenciar apaga la pista; salir suelta el micrófono. En dev, `window.__voice` expone el módulo para pruebas.
- `src/net/`: multijugador con PeerJS (WebRTC). El anfitrión tiene la partida de verdad; los invitados reciben una copia y mandan acciones (`NetAction` en `link.ts`) que el anfitrión valida en `remote()`. Si cambian los mensajes, sube `PROTOCOL` en `net.ts`.
- `src/fx/`: fondo animado, temas visuales (Neón, Fiesta, Casino), escenas de emojis, lluvias, reacciones y partículas.
- `src/audio/sfx.ts`: **todos los sonidos y la música se sintetizan con Web Audio**. Son originales, sin archivos ni licencias y funcionan sin internet. Mantener esa regla para sonidos nuevos.
- `src/audio/voicebox.ts`: caja de voz que calcula muestra por muestra (formantes en cascada estilo Klatt): pulso glotal con jitter/shimmer, aire sincronizado, carraspeo (`creak`), nasal y "j". Es pura y probada (`voice.test.ts`). `voices.ts` tiene los guiones (`Take` con puntos clave): risas (`guffaw`, `giggle`, `evilLaugh`, `snortLaugh`, `hysterical`), grito, "mmm", "¿eeeh?", "uuuy", "¡TÚ!", llanto, gallina, trompetilla y ronquido. `speakerFor(id)` da a cada jugador la misma voz en todos los teléfonos.
- `src/audio/reactions.ts`: sonido de cada reacción (voz + efectos de Web Audio). Volúmenes y corte de graves en `REACTION_VOICES`, igualados para la bocina del celular (medir con un render sin conexión antes de cambiarlos). La voz se calcula después de dibujar la burbuja (en un celular lento tarda 20–80 ms). Se oyen en todos los teléfonos según `prefs.reactSound`; máximo 3 a la vez. **No usar sonidos de memes ni grabaciones ajenas** (derechos de autor): todo se crea desde cero.
- `src/audio/recordings.ts`: grabar tu voz para una reacción (MediaRecorder → 12 kHz µ-law, máx. 3 s, ~40 KB en base64). Se guarda en `prefs.sounds[emoji]` (prefs v2 migró la antigua `laugh` a 😂); en sala viaja por mensajes `sound` (uno por reacción) y el anfitrión los valida con `isSound`.
- `src/data/eliminations.ts` + `src/components/Elimination.tsx` + `src/audio/eliminations.ts`: 6 animaciones de eliminación (rayo, agujero, piñata, cohete, ovni, hielo). Los videos (`public/elim/*.mp4`, 540×1080, H.264, ~230–420 KB, precacheados; `elim.test.ts` revisa que existan y pesen menos de 600 KB) se hicieron con Blender 5.3 (Cycles) con los scripts de `tools/eliminaciones/` (`render.sh`). El avatar va encima, sincronizado con los cuadros clave (`hit`), y el sonido se sintetiza. Encima del avatar puede ir un `overlay` (calavera de rayos X, cohete) y el hielo tiene su bloque y sus pedazos en CSS (`IceBlock`, `IceShards`). Cada jugador elige `player.elim` (o sorpresa: `elimFor` usa ronda+votación para que todos vean la misma). Ojo con Framer: cada propiedad debe terminar en el tiempo 1 (`holdLast`).
- Escenas de Blender (`tools/eliminaciones/common.py`): todo es emisivo y de frente a una cámara ortográfica (X ∈ [-5, 5], Z ∈ [-10, 10], el jugador en el origen). Trucos aprendidos: los discos y anillos se crean girados, así que para estirarlos "a lo alto" se escala su eje Y local, no el Z; dos superficies transparentes en el mismo plano salen con triángulos duros (`nudge` las separa); los colores se ven más claros de lo que parecen (vista Standard + el resplandor de ffmpeg), así que la noche va en valores lineales muy bajos. Vista previa rápida: `--pct 40 --frames 10,22` y `--only prefijo` para aislar objetos.
- `src/components/Spectate.tsx`: espectadores (`useSpectator`: entró a media ronda o lo eliminaron) y `JoinNotice` (aviso para todos).
- `src/services/`: fotos para jugar sin conexión (CORS, con reintentos ante el límite 429 de Wikimedia), actualizaciones, pantalla encendida y fluidez (`perf.ts`).
- `src/services/perf.ts`: efectos completos o ligeros (`prefs.perf`: automático, ligeros o completos, en Ajustes → "Efectos visuales"). En automático mide los cuadros por segundo en ventanas de 3 s y, si va lento dos veces, pasa a ligeros y lo recuerda (`impostor-perf-auto`). Marca `<html data-perf="lite|full">` para el CSS; en código, `perf.lite`. Ligeros: sin adornos animados en los sobres, menos partículas (`burst`, `emojiRain`, fondo), fuego a menos resolución.

## Reglas de diseño que hay que respetar

- **Fluidez en el celular** (medido con Playwright y el CPU frenado ×4; antes se trababa):
  - Nada de `backdrop-filter`, ni `filter: blur()` en elementos grandes o animados (las transiciones de pantalla ya no lo usan). El fondo (`Backdrop.tsx`) se mueve sin parar, así que todo lo que lo desenfocaba se recalculaba en cada cuadro.
  - Animaciones infinitas solo con `transform` y `opacity`. Para brillos o pulsos, una capa aparte (`::before`/`::after`) que se mueve o cambia de opacidad; no animar `background-position`, `box-shadow` ni `filter`.
  - El fondo dibuja a 30 cuadros por segundo (20 en ligeros) y a 0.35 de resolución. Los sobres chiquitos (`.mini-pack`) no animan.
  - El fuego azul compila su shader al aparecer el sobre (`warmBlueFire`) y baja de resolución solo si los cuadros tardan.
  - **Lienzos de partículas (iPhone):** en un iPhone se quedaron chispas "congeladas" en pantalla (parecía la pantalla estrellada). Por eso la capa global (`FxLayer`) se esconde (`display: none`) cuando no hay partículas, borra con el tamaño real del lienzo, se apaga limpia si algo falla o si sales de la app, y se reinicia si el ciclo se quedó parado. El fuego borra y esconde sus lienzos al terminar y los suelta (`width = 0`) al desmontarse. Mantener eso en lienzos nuevos.

- **Nada debe delatar información secreta.** Los colores, fondos, escenas y sonidos dependen de la categoría o del tema, nunca de la carta. El sonido y la vibración al ver la carta son iguales para civiles e impostores.
- **Sobres:** la forma de abrirlo la elige cada jugador antes de la ronda y es igual para civiles e impostores. El diseño y el brillo se sortean con su propio generador y sin mirar el rol (en Mezcla cuenta el tema, no la categoría de la carta civil). Ningún brillo usa el azul de civiles (#2ee6ff) ni el rojo de impostores (#ff2e4d). `packs.test.ts` lo verifica.
- **Última oportunidad:** el impostor atrapado adivina antes de ver la verdad. Con varios, lo que elige cada uno queda guardado (`guessPicks`) y se revela al final.
- **Impostores:**
  - Siempre hay más civiles que impostores.
  - En automático: 1 hasta 5 jugadores, 2 hasta 8, 3 hasta 11, 4 hasta 15 y 5 con más.
  - Cada impostor recibe una carta distinta. En modo equipo se conocen, comparten carta y ganan juntos.
- **Eventos seguros:** nada de alcohol, comer o beber, golpes, correr, contacto físico obligado, usar teléfonos ajenos ni exponer la vida privada. El modo +18 solo agrega groserías, dirigidas a la carta. `events.test.ts` lo verifica: si agregas un evento, que la prueba siga pasando.
- **Eventos de turno:** se anuncian a toda la mesa, se quitan al pasar el turno y ahí se califican. Las misiones secretas llegan en la carta y se revelan al final.
- **Sala:** hasta 20 jugadores. Un teléfono puede llevar a jugadores sin celular (`owner`), que ven su carta y votan pasándolo.
- **Pedir votación (sala):** cada jugador puede pedir votar (`round.voteCalls`, acción `callVote`). Con mayoría (`voteCallStatus`) se vota al terminar la vuelta; si lo piden todos, de inmediato. El anfitrión conserva "Votar ya, sin esperar" en el menú. Con un solo teléfono no cambia nada: el encargado decide.
- **Reunión:** al terminar cada vuelta (en sala y pasando el teléfono), `round.meeting` (`MEETING_MS` = 90 s) y no corren turnos. Con un solo teléfono, la mesa decide con dos botones (sin pedidos ni cierre automático). Cada quien pide ▶ otra vuelta (`moreCalls`, acción `more`) o votar (`voteCalls`); nadie pide las dos. Mayoría → se hace ya (`settleMeeting`). Al acabarse el tiempo gana lo más pedido; empate o nada → otra vuelta (`endMeeting`). Si la mayoría ya pidió votar durante la vuelta, se vota sin reunión. Con un solo teléfono no hay reunión.
- **Espectadores (sala):** quien entra a media ronda no está en `round.order` (sin carta, turno ni voto) y entra en la siguiente (`startRound` usa todos los jugadores). Los eliminados también miran. Nunca se les muestra información secreta.
- **Llamada de voz (sala):** opcional, nunca automática (el micrófono solo se abre con un toque). Advertir del eco si están juntos. Durante la llamada la música baja (`sfx.duck`).
- **Salir de la partida (sala):** siempre con "¿Estás seguro?" (`LeaveGame.tsx`). Si un invitado sale a media ronda, el anfitrión lo marca en `round.left` (`leaveRound`): se salta su turno (`advance`), no se le espera para ver su carta ni para votar (`votersOf`), sigue siendo sospechoso y, si era impostor atrapado, ya no adivina (`guessersOf`). Si vuelve a entrar, regresa; si no, ya no recibe carta en la siguiente ronda. Si sale el anfitrión, se cierra la sala.
- **Desconexiones (sala):** si todos los demás teléfonos llevan `ALONE_MS` sin conexión (contando desde la última vez que se supo de alguien), el anfitrión hace `pauseRound()`: vuelve a la sala y guarda `round.pausedAt`; `resumeRound()` ("Continuar ronda") recorre `startedAt` para que el reloj no pierda tiempo. El invitado sin anfitrión ve `ConnectionLost` (reintentar o ir al menú) y a los `GIVE_UP_MS` vuelve a "Entrar a una sala" con `lastCode` puesto.
- **Sin internet:** con un solo teléfono el juego funciona sin conexión (las fuentes van empaquetadas). El modo de varios teléfonos sí necesita internet para encontrarse.
- **CSP** en la versión publicada (`vite.config.ts`): solo código propio, fotos de Wikimedia y el servidor PeerJS.

## Pruebas en este entorno

- Las pruebas de navegador se hacen con scripts de Playwright fuera del repo (Chromium ya está instalado).
- Para probar salas localmente, levanta un PeerServer en `127.0.0.1:9000` (este entorno no tiene IPv6) y arranca Vite con `VITE_PEER_HOST=127.0.0.1 VITE_PEER_PORT=9000 VITE_PEER_SECURE=false`. Lanza Chromium con `--disable-features=WebRtcHideLocalIpsWithMdns`.
- Wikimedia limita con 429 si se piden muchas fotos seguidas: revisa las fotos despacio.

## Historial

1. Versión inicial: un teléfono que se pasa, 836 cartas, retos, eventos, puntos y logros.
2. Multijugador por sala (código y QR), eventos rediseñados (acentos mexicanos, +18, misiones secretas, eventos ocultos, frecuencia configurable), eliminación corregida, voto secreto, ruleta real, temas visuales y mejor modo sin conexión.
3. Impostores sin límite fijo y modo equipo, salas de hasta 20 con jugadores sin teléfono, todo animado (avatares, emojis, escenas, lluvias, reacciones) y actualizaciones automáticas.
4. Sobre de cartas que se corta con el dedo, barajeo animado y sonidos del sobre sintetizados.
5. Un sobre personal por jugador (8 diseños, 6 brillos por rareza), galería de sobres en Ajustes y "Última oportunidad" con animación propia. El impostor atrapado ahora adivina ANTES de ver la verdad (antes veía la carta civil en "la verdad" y luego adivinaba).
6. Sala: botón rojo para pedir votación (mayoría → se vota al terminar la vuelta) y salir de la partida con confirmación sin trabar la ronda. También se arregló que al salir de una sala la pantalla quedara en negro y que la app regresara siempre a "Entrar a una sala".
7. Sala: si se desconectan todos, el anfitrión vuelve a la sala con la ronda en pausa; los invitados sin anfitrión pueden reintentar, ir al menú o volver a entrar con el código puesto.
8. Reacciones con sonido propio hecho desde cero (risa sintetizada con tres estilos, grito, navaja, aplausos, etc.) y movimiento al compás. Ajuste "De todos / Solo mías / Apagados" y tablero para probarlas. Se arregló que quien mandaba una reacción en sala la viera dos veces.
9. Caja de voz nueva (mucho más natural que los filtros de antes), voz propia por jugador, risa de cerdito y ataque de risa, y 11 reacciones nuevas graciosas (21 en total) en un selector de cuadrícula.
10. Sala: reunión al terminar cada vuelta (otra vuelta o votar, por mayoría), llamada de voz en tiempo real con micrófono y altavoz, y grabar tu propia risa para el 😂. También: un enlace de sala ahora abre la sala aunque la app estuviera en otra pantalla (antes solo desde el menú). `PROTOCOL` = 6.
11. Reunión también pasando el teléfono, voz grabada para cada reacción, espectadores en sala (aviso al entrar a media ronda, eliminados miran) y 4 animaciones de eliminación hechas en Blender con sonidos propios, elegibles por jugador. `PROTOCOL` = 7.
12. Eliminaciones pulidas y 2 nuevas (6 en total): rayo con tormenta, rayo guía, grietas, rayos X y cenizas; agujero negro con disco inclinado, lente, chorros y supernova; piñata con palo, cuerda, cómic, dulces y serpentinas; cohete con ciudad, llama en capas y 4 fuegos (sauce, corazón…); 🛸 abducido por un platillo y 🧊 congelado que estalla en pedazos. `PROTOCOL` = 8 (una versión vieja no conoce las nuevas).
13. Nueva forma de abrir el sobre: 🔥 fuego azul (se toca donde quieras y se desintegra en llamas azules), elegible por jugador junto a ✂️ cortar. `PROTOCOL` = 9.
14. Fluidez: se quitaron los desenfoques de fondo (paneles, botones, ventanas, fondo animado y transiciones), el grano animado y las animaciones que repintaban (brillo de los sobres, pulsos). Modo de efectos ligeros automático o en Ajustes. Con el CPU frenado ×4: Ajustes 31 → 55 cuadros por segundo, sobre cerrado 27 → 60, pistas 36 → 60, abrir sobre 24 → 46 (58 en ligeros), fuego azul 9 → 22 (34 en ligeros).

15. Fuego azul: la carta ya no se asoma más grande que el sobre mientras se quema (espera dentro de él y se ve por los hoyos) y sale hasta que el sobre se acabó. Partículas blindadas contra quedarse congeladas en iPhone (capa escondida sin partículas, limpieza al salir de la app o si algo falla).
## Pendiente o sin verificar

- Chispas congeladas en iPhone (sala): no se pudo reproducir aquí (no hay Safari de iPhone); se blindaron todos los lienzos de partículas. Confirmar con el dueño si volvió a pasar.
- No se ha probado en celulares reales: sensación al cortar el sobre, brillo y sonido del sobre personal, sonidos de reacciones (sobre todo cómo suena la voz sintetizada en la bocina), vibración, salas con el servidor público de PeerJS, la llamada de voz (eco, si sale por el altavoz en iPhone, redes que bloquean conexiones directas) y grabar la risa en Safari.
- La partida de 10 jugadores con 3 impostores funcionó como se esperaba: cada impostor tiene carta distinta, lo cual al principio confundió a la mesa.

## Preferencias del dueño

- Todo en español de México, tuteando.
- Le gustan los eventos secretos y que el juego sorprenda.
- Quiere que cada cambio quede publicado y que la app se actualice sola.
