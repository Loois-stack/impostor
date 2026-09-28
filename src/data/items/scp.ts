import { mk } from '../types';

// Los SCP no tienen imagen en Wikipedia: usan el arte de "expediente clasificado".
export default mk('scp', [
  ['scp173', 'SCP-173 "La Escultura"', 'euclid', '🗿', '', 'Estatua de concreto pintada con spray. Solo se mueve cuando nadie la mira y te rompe el cuello. ¡No parpadees!', 'scp096:2,scp106:2,scp372:2'],
  ['scp096', 'SCP-096 "El Tímido"', 'euclid', '🙈', '', 'Humanoide pálido y flaco. Si alguien ve su rostro, aunque sea en foto, entra en pánico, lo busca y lo destroza.', 'scp173:2,scp049:3'],
  ['scp049', 'SCP-049 "El Doctor de la Peste"', 'euclid', '🩺', '', 'Figura con traje y máscara de médico de la peste. Cree curar "la pestilencia" matando con un toque y reanimando a sus víctimas.', 'scp008:2,scp035:2'],
  ['scp106', 'SCP-106 "El Viejo"', 'keter', '👴', '', 'Anciano podrido que atraviesa paredes dejando corrosión negra y arrastra víctimas a su "dimensión de bolsillo".', 'scp173:2,scp682:2'],
  ['scp682', 'SCP-682 "Reptil Indestructible"', 'keter', '🦎', '', 'Reptil gigante que odia toda forma de vida. Se adapta y regenera de cualquier ataque; la Fundación no ha podido matarlo.', 'scp106:2,scp3000:2'],
  ['scp999', 'SCP-999 "El Monstruo de las Cosquillas"', 'safe', '🟠', '', 'Masa naranja de gelatina, juguetona y amistosa. Quien la toca siente felicidad absoluta. Le encantan los dulces.', 'scp131:1,scp500:3'],
  ['scp131', 'SCP-131 "Los Gotas de Ojo"', 'safe', '💧', '', 'Dos criaturitas en forma de lágrima con un ojo gigante y rueda. Son como mascotas curiosas y leales.', 'scp999:1'],
  ['scp3008', 'SCP-3008 "IKEA Infinita"', 'euclid', '🛋️', '', 'Una tienda IKEA sin fin. Los empleados sin rostro se vuelven hostiles cuando se apagan las luces.', 'backrooms:1,scp087:2'],
  ['scp087', 'SCP-087 "La Escalera"', 'euclid', '🪜', '', 'Escalera oscura que baja infinitamente. Se oye llorar a un niño y algo con cara sin ojos espera abajo.', 'scp3008:2,scp106:3'],
  ['scp914', 'SCP-914 "El Reloj"', 'safe', '⚙️', '', 'Máquina enorme de engranajes con una perilla: Burdo, Tosco, 1:1, Fino, Muy Fino. Refina lo que metas… a veces horriblemente.', 'scp294:1,scp500:3'],
  ['scp294', 'SCP-294 "La Máquina de Café"', 'euclid', '☕', '', 'Máquina expendedora con teclado: sirve CUALQUIER líquido que escribas, desde chocolate hasta "la sangre de mi enemigo".', 'scp914:1,scp500:2'],
  ['scp500', 'SCP-500 "La Panacea"', 'safe', '💊', '', 'Frasco de píldoras rojas que curan cualquier enfermedad en dos horas. Quedan muy pocas.', 'scp294:2,scp008:3'],
  ['scp008', 'SCP-008 "Plaga Zombi"', 'keter', '🧟', '', 'Prion que convierte a los infectados en zombis agresivos. Una fuga lleva a la detonación nuclear del sitio.', 'scp049:2,scp500:3'],
  ['scp035', 'SCP-035 "La Máscara Poseedora"', 'keter', '🎭', '', 'Máscara de teatro de porcelana que escurre líquido. Posee a quien se la pone y es muy manipuladora.', 'scp049:2,scp1471:3'],
  ['scp372', 'SCP-372 "Depredador Periférico"', 'euclid', '👁️‍🗨️', '', 'Criatura rapidísima que vive en tu visión periférica. Solo la ves por el rabillo del ojo.', 'scp173:2,scp1471:2'],
  ['scp1471', 'SCP-1471 "MalO"', 'euclid', '📱', '', 'App de celular que te envía fotos de una criatura con cráneo de lobo que aparece cada vez más cerca de ti.', 'scp372:2,scp035:3'],
  ['scp939', 'SCP-939 "Con Muchas Voces"', 'keter', '🗣️', '', 'Depredadores rojos y ciegos que imitan voces humanas de sus víctimas para atraer más presas.', 'skinwalker:2,scp096:3'],
  ['scp3000', 'SCP-3000 "Anantashesha"', 'thaumiel', '🐍', '', 'Anguila marina colosal en el fondo del océano. Estar cerca borra tu memoria; la Fundación extrae de ella amnésicos.', 'scp682:2,scp055:2'],
  ['scp055', 'SCP-055 "El Anti-meme"', 'keter', '❔', '', 'Objeto del que nadie puede recordar nada. Solo se sabe lo que NO es: no es redondo… o eso creemos.', 'scp3000:2,scp1471:3'],
  ['scp426', 'SCP-426 "Soy una Tostadora"', 'safe', '🍞', '', 'Tostadora que solo puede describirse en primera persona. Con el tiempo, quien la estudia cree ser una tostadora.', 'scp055:2,toaster:2'],
  ['scp1000', 'SCP-1000 "Bigfoot"', 'keter', '🦶', '', 'Los "Bigfoot" son una antigua civilización humana que dominó el mundo y fue borrada de la historia.', 'scp682:3,chupacabras:3'],
  ['scp2317', 'SCP-2317 "La Puerta a Otro Mundo"', 'keter', '🚪', '', 'Puerta que lleva a un mundo en ruinas donde está encadenado un ser colosal. Si rompe las cadenas, es el fin del mundo.', 'scp3000:2,scp087:2'],
]);
