# IMPOSTOR — ¿Quién miente?

Juego de fiesta para jugar pasando **un solo celular**. Todos reciben la misma carta… menos el impostor, que recibe algo **parecido pero no igual**.

- 517 cartas en 15 categorías (memes, creepypastas, SCP, terror, caricaturas, anime, videojuegos, cine, series, famosos, objetos, comida, animales…), cada una con imagen y contexto.
- Algoritmo anti-repetición persistente: una carta no vuelve hasta recorrer ~70 % de su categoría y ninguna pareja civil/impostor se repite.
- Retos activables (voz ridícula, traición secreta, restricciones, mímica, caos) y eventos sorpresa.
- Puntos, rachas, niveles y logros por jugador.
- App instalable (PWA), pantalla completa y offline.

## Jugar en tu PC

```bash
npm install
npm run dev
```

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

Después, en *Ajustes → Descargar imágenes* puedes guardar todas las imágenes para jugar sin internet.

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
