/**
 * Cartas cuya imagen de Wikipedia no muestra al personaje (póster con texto, logo, foto grupal,
 * grabado ilegible…). Usan el arte temático propio. Revisado a mano; `validate-wiki` las respeta.
 */
export const IMAGE_BLOCKLIST = new Set([
  // Terror y leyendas
  'babadook', 'chucky', 'gradytwins', 'bughuul', 'blairwitch', 'lipstick', 'paimon', 'mama', 'crookedman', 'leprechaun',
  'frankenstein', 'llorona', 'silbon', 'cadejo', 'nahual', 'kuchisake', 'shadowman', 'elcoco',
  // Memes
  'skibidi', 'mockingsponge',
  // Caricaturas
  'courage', 'dexter', 'dora', 'johnny', 'billcipher', 'danny', 'gary', 'zim',
  // Cine animado
  'walle', 'toothless', 'anna', 'jafar', 'sid', 'joy', 'anxiety', 'nemo', 'dory', 'megamind', 'ralph', 'bruno', 'forky', 'rex',
  'hades', 'eve',
  // Anime
  'shanks', 'eren', 'deku', 'levi', 'frieren', 'totoro', 'zenitsu', 'inosuke', 'rengoku', 'mikasa', 'allmight', 'l',
  // Cine
  'c3po', 'gandalf', 'bond', 'barbie', 'wonka', 'sauron', 'et', 'bilbo',
  // Videojuegos
  'amongus', 'freddyfaz', 'huggy', 'kingboo', 'bendy', 'amy',
  // Series
  'demogorgon', 'barney', 'youngHee', 'chavo', 'shelby', 'mrbean',
  // Otros
  'spreen', 'torta', 'hotcakes',
]);
