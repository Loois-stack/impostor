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
- `src/data/`: 836 cartas en `items/*.ts`, categorías, temas de Mezcla y eventos de turno o misiones (`challenges.ts`, con las reglas de seguridad al inicio).
- `src/screens/`: una pantalla por fase. `Intro` (ruleta), `Deal` (sobre y reparto), `Discuss` (pistas), `Vote`, `Reveal`, `Score`, `Lobby` y `Online` (salas), `Setup` (reglas), `Events` (catálogo).
- `src/components/`:
  - `PackOpening.tsx`: el sobre que se corta y el barajeo.
  - `Wheel.tsx`: la ruleta.
  - `GameCard.tsx`: las cartas.
  - `Emo.tsx`: emojis animados.
  - `EventCard.tsx` y `EventOverlay.tsx`: avisos de eventos.
- `src/net/`: multijugador con PeerJS (WebRTC). El anfitrión tiene la partida de verdad; los invitados reciben una copia y mandan acciones (`NetAction` en `link.ts`) que el anfitrión valida en `remote()`. Si cambian los mensajes, sube `PROTOCOL` en `net.ts`.
- `src/fx/`: fondo animado, temas visuales (Neón, Fiesta, Casino), escenas de emojis, lluvias, reacciones y partículas.
- `src/audio/sfx.ts`: **todos los sonidos y la música se sintetizan con Web Audio**. Son originales, sin archivos ni licencias y funcionan sin internet. Mantener esa regla para sonidos nuevos.
- `src/services/`: fotos para jugar sin conexión (CORS, con reintentos ante el límite 429 de Wikimedia), actualizaciones y pantalla encendida.

## Reglas de diseño que hay que respetar

- **Nada debe delatar información secreta.** Los colores, fondos, escenas y sonidos dependen de la categoría o del tema, nunca de la carta. El sonido y la vibración al ver la carta son iguales para civiles e impostores.
- **Impostores:**
  - Siempre hay más civiles que impostores.
  - En automático: 1 hasta 5 jugadores, 2 hasta 8, 3 hasta 11, 4 hasta 15 y 5 con más.
  - Cada impostor recibe una carta distinta. En modo equipo se conocen, comparten carta y ganan juntos.
- **Eventos seguros:** nada de alcohol, comer o beber, golpes, correr, contacto físico obligado, usar teléfonos ajenos ni exponer la vida privada. El modo +18 solo agrega groserías, dirigidas a la carta. `events.test.ts` lo verifica: si agregas un evento, que la prueba siga pasando.
- **Eventos de turno:** se anuncian a toda la mesa, se quitan al pasar el turno y ahí se califican. Las misiones secretas llegan en la carta y se revelan al final.
- **Sala:** hasta 20 jugadores. Un teléfono puede llevar a jugadores sin celular (`owner`), que ven su carta y votan pasándolo.
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

## Pendiente o sin verificar

- No se ha probado en celulares reales: sensación al cortar el sobre, sonido, vibración y salas con el servidor público de PeerJS.
- La partida de 10 jugadores con 3 impostores funcionó como se esperaba: cada impostor tiene carta distinta, lo cual al principio confundió a la mesa.

## Preferencias del dueño

- Todo en español de México, tuteando.
- Le gustan los eventos secretos y que el juego sorprenda.
- Quiere que cada cambio quede publicado y que la app se actualice sola.
