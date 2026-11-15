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
  - `PackOpening.tsx`: `PersonalPack` (el sobre de cada jugador: corte, luz, brillo y carta que sale girando), `PackShuffle` (los sobres de todos se barajan al empezar), `PackArt` y `MiniPack`.
  - `PackGallery.tsx`: galería de sobres y brillos en Ajustes, con sobre de prueba.
  - `Wheel.tsx`: la ruleta.
  - `GameCard.tsx`: las cartas.
  - `Emo.tsx`: emojis animados.
  - `EventCard.tsx` y `EventOverlay.tsx`: avisos de eventos.
- `src/components/VoteCall.tsx` (botón y contador para pedir votación) y `LeaveGame.tsx` (salir con confirmación).
- `src/net/`: multijugador con PeerJS (WebRTC). El anfitrión tiene la partida de verdad; los invitados reciben una copia y mandan acciones (`NetAction` en `link.ts`) que el anfitrión valida en `remote()`. Si cambian los mensajes, sube `PROTOCOL` en `net.ts`.
- `src/fx/`: fondo animado, temas visuales (Neón, Fiesta, Casino), escenas de emojis, lluvias, reacciones y partículas.
- `src/audio/sfx.ts`: **todos los sonidos y la música se sintetizan con Web Audio**. Son originales, sin archivos ni licencias y funcionan sin internet. Mantener esa regla para sonidos nuevos.
- `src/audio/reactions.ts`: sonido de cada reacción. Las voces (risas, grito, "mmm", "¿eeeh?") usan `speak()`, un sintetizador de formantes (pulso glotal + 3 filtros por vocal + aire para la "j"); los efectos usan ruido y osciladores. Volúmenes igualados en `REACTION_VOICES` (medidos para bocina de celular). Se oyen en todos los teléfonos según `prefs.reactSound`; máximo 3 a la vez. **No usar sonidos de memes ni grabaciones ajenas** (derechos de autor): todo se crea desde cero.
- `src/services/`: fotos para jugar sin conexión (CORS, con reintentos ante el límite 429 de Wikimedia), actualizaciones y pantalla encendida.

## Reglas de diseño que hay que respetar

- **Nada debe delatar información secreta.** Los colores, fondos, escenas y sonidos dependen de la categoría o del tema, nunca de la carta. El sonido y la vibración al ver la carta son iguales para civiles e impostores.
- **Sobres:** el diseño y el brillo se sortean con su propio generador y sin mirar el rol (en Mezcla cuenta el tema, no la categoría de la carta civil). Ningún brillo usa el azul de civiles (#2ee6ff) ni el rojo de impostores (#ff2e4d). `packs.test.ts` lo verifica.
- **Última oportunidad:** el impostor atrapado adivina antes de ver la verdad. Con varios, lo que elige cada uno queda guardado (`guessPicks`) y se revela al final.
- **Impostores:**
  - Siempre hay más civiles que impostores.
  - En automático: 1 hasta 5 jugadores, 2 hasta 8, 3 hasta 11, 4 hasta 15 y 5 con más.
  - Cada impostor recibe una carta distinta. En modo equipo se conocen, comparten carta y ganan juntos.
- **Eventos seguros:** nada de alcohol, comer o beber, golpes, correr, contacto físico obligado, usar teléfonos ajenos ni exponer la vida privada. El modo +18 solo agrega groserías, dirigidas a la carta. `events.test.ts` lo verifica: si agregas un evento, que la prueba siga pasando.
- **Eventos de turno:** se anuncian a toda la mesa, se quitan al pasar el turno y ahí se califican. Las misiones secretas llegan en la carta y se revelan al final.
- **Sala:** hasta 20 jugadores. Un teléfono puede llevar a jugadores sin celular (`owner`), que ven su carta y votan pasándolo.
- **Pedir votación (sala):** cada jugador puede pedir votar (`round.voteCalls`, acción `callVote`). Con mayoría (`voteCallStatus`) se vota al terminar la vuelta; si lo piden todos, de inmediato. El anfitrión conserva "Votar ya, sin esperar" en el menú. Con un solo teléfono no cambia nada: el encargado decide.
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

## Pendiente o sin verificar

- No se ha probado en celulares reales: sensación al cortar el sobre, brillo y sonido del sobre personal, sonidos de reacciones (sobre todo cómo suena la voz sintetizada en la bocina), vibración y salas con el servidor público de PeerJS.
- La partida de 10 jugadores con 3 impostores funcionó como se esperaba: cada impostor tiene carta distinta, lo cual al principio confundió a la mesa.

## Preferencias del dueño

- Todo en español de México, tuteando.
- Le gustan los eventos secretos y que el juego sorprenda.
- Quiere que cada cambio quede publicado y que la app se actualice sola.
