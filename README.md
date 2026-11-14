# IMPOSTOR — ¿Quién miente?

Juego de fiesta en español. Todos reciben la misma carta… menos el impostor, que recibe algo **parecido pero no igual**. Se juega pasando **un solo celular** o con **cada quien en su propio teléfono**.

- **836 cartas** en 15 categorías (memes, creepypastas, SCP, terror, caricaturas, anime, videojuegos, cine, series, famosos, objetos, comida, animales…), cada una con imagen y contexto. "Mis cartas": crea las tuyas con foto.
- **Varios teléfonos**: un jugador crea una sala y los demás entran con un código de 4 letras o escaneando un QR. Cada quien ve su carta en privado, pasa su propio turno y vota en secreto. Si alguien recarga o se le va la señal, vuelve a entrar solo.
- **Eventos de ronda** (14): doble impostor, impostor a ciegas, cómplice, detective, bufón, **fiesta mexicana**, cine mudo, ronda dorada, susurros… Algunos se juegan **en secreto** y se revelan al final.
- **Eventos especiales de turno** (95, más 10 del modo +18): voces, **acentos mexicanos** (norteño, chilango, fresa, yucateco, tianguis, lucha libre…), restricciones, actuación y caos. La app anuncia a quién le tocó, lo muestra durante su turno y **se quita al pasar al siguiente jugador**, donde se califica si lo cumplió.
- **Misiones secretas** (19): llegan escritas en tu carta y nadie más sabe que existen.
- **Frecuencia de eventos** (Pocos, Normal, Muchos, Caos) con las probabilidades a la vista, y un **catálogo** para ver cómo se anuncia cada evento y apagar los que no gusten.
- **Modo +18** opcional: agrega groserías y albures mexicanos. Solo palabras, dirigidas a la carta.
- **Eliminación** revisada: el reloj se acorta en cada nueva búsqueda, cada inocente echado por error baja el premio y los eliminados ya no hablan ni votan.
- **Votación** en grupo o en secreto (pasando el teléfono, o cada quien en el suyo), con conteo animado y empates.
- Ruleta de verdad, cartas con marco por categoría, tres **temas visuales** (Neón, Fiesta, Casino), música generada en vivo, puntos, rachas, niveles, logros y "Premios de la noche".
- App instalable (PWA) que funciona **sin internet** con un solo teléfono: fuentes y sonidos van dentro de la app, y las fotos se pueden descargar desde Ajustes.

### Eventos seguros

Los eventos están hechos para reírse, no para arriesgarse: ninguno pide alcohol, comer o beber algo, golpes, correr, contacto obligado, usar el teléfono de otro ni exponer la vida privada de nadie. El modo +18 solo agrega groserías. Hay una prueba automática (`src/engine/events.test.ts`) que revisa estas reglas en cada evento; si agregas uno nuevo, sigue las reglas escritas al inicio de `src/data/challenges.ts`.

## Jugar en tu PC

```bash
npm install
npm run dev
```

## Jugar en tu celular por Wi-Fi (sin publicar)

```bash
npm run jugar
```

Abre en el celular (conectado al mismo Wi-Fi) la dirección `http://IP-DE-TU-PC:4173`. Si Windows pregunta por el firewall, permite el acceso en **redes privadas**. Así se juega completo, pero no se instala como app ni funciona sin la PC encendida.

## Publicar e instalar en el celular

La app necesita estar en una URL **https** para poder instalarse.

**Opción A — GitHub Pages (gratis, se actualiza sola):**
1. Crea un repositorio en GitHub y sube esta carpeta (`git push` a la rama `main`).
2. En el repo: *Settings → Pages → Source: GitHub Actions*.
3. El workflow `.github/workflows/deploy.yml` prueba, compila y publica. Tu URL será `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

**Opción B — Netlify Drop (sin git):**
1. `npm run build`
2. Arrastra la carpeta `dist` a https://app.netlify.com/drop (crea una cuenta para que no se borre).

**Instalar:** abre la URL en el celular →
- Android (Chrome): menú ⋮ → *Instalar app* / *Agregar a pantalla principal*.
- iPhone (Safari): Compartir → *Agregar a inicio*.

Después, en *Ajustes → Jugar sin internet* puedes guardar todas las fotos de las cartas (unos 80 MB) para jugar en cualquier lugar.

## Varios teléfonos

El modo de varios teléfonos conecta los celulares directamente entre sí (WebRTC). Solo necesita internet para que los teléfonos se encuentren; para eso usa el servidor público gratuito de PeerJS.

Si prefieres usar tu propio servidor (por ejemplo, en tu red local):

```bash
npm run servidor-salas          # servidor de encuentro en el puerto 9000
VITE_PEER_HOST=192.168.1.50 VITE_PEER_PORT=9000 VITE_PEER_SECURE=false npm run jugar
```

Cambia `192.168.1.50` por la IP de tu PC.

## Agregar cartas

Edita `src/data/items/<categoría>.ts`. Cada fila:

```ts
['id', 'Nombre', 'grupo', '😀', 'Título de Wikipedia', 'Contexto…', 'otroId:1,otroId2:2'],
```

- `grupo`: familia temática; las cartas del mismo grupo sirven de señuelo parecido.
- Similares: `1` = casi idéntico, `2` = parecido, `3` = lejano (pueden ser de otra categoría).
- Luego ejecuta `npm run validate-wiki` para resolver las imágenes y `npm test` para validar.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (accesible en tu red local) |
| `npm test` | Pruebas del motor y del contenido |
| `npm run build` | Compila la PWA en `dist/` |
| `npm run validate-wiki` | Resuelve imágenes de Wikipedia → `src/data/images.json` |
| `npm run servidor-salas` | Servidor propio para el modo de varios teléfonos (opcional) |
