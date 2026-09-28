/**
 * Modo Mezcla: temas que cruzan categorías. La carta de los civiles y la del impostor salen
 * del mismo tema, preferentemente de categorías distintas (ej. Pennywise vs. el Joker).
 */
export interface Theme {
  id: string;
  name: string;
  emoji: string;
  color: string;
  items: string[];
  /** Ambiente oscuro. Solo depende del tema (no de la carta) para no delatar nada. */
  horror?: boolean;
}

export const THEMES: Theme[] = [
  { id: 'payasos', name: 'Payasos', emoji: '🤡', color: '#ff2e4d', items: ['pennywise', 'art', 'laughingjack', 'joker', 'krusty', 'harley', 'themask'] },
  { id: 'perros', name: 'Perros famosos', emoji: '🐶', color: '#ffb547', items: ['doge', 'cheems', 'scooby', 'courage', 'jake', 'goofy', 'bluey', 'brian', 'dog', 'smiledog', 'cadejo', 'chillguy', 'speedbark'] },
  { id: 'gatos', name: 'Gatos', emoji: '🐱', color: '#ff8a3d', items: ['grumpy', 'nyancat', 'keyboardcat', 'bongocat', 'tom', 'garfield', 'sylvester', 'puss', 'cat', 'cartooncat', 'chipichapa', 'scp529', 'catwoman'] },
  { id: 'robots', name: 'Robots e IA', emoji: '🤖', color: '#48c6ff', items: ['walle', 'eve', 'baymax', 'r2d2', 'c3po', 'bender', 'terminator', 'm3gan', 'glados', 'ultron', 'optimus', 'bumblebee', 'scp079', 'vision', 'robocop', 'cyborg'] },
  { id: 'magos', name: 'Magos y hechiceros', emoji: '🧙', color: '#7c5cff', items: ['gandalf', 'dumbledore', 'harry', 'hermione', 'snape', 'drstrange', 'scarletwitch', 'frieren', 'jafar', 'voldemort', 'bellatrix', 'maleficent', 'ursula'] },
  { id: 'ranas', name: 'Ranas y sapos', emoji: '🐸', color: '#39ff88', items: ['pepe', 'datboi', 'kermittea', 'evilkermit', 'frog', 'tiana', 'jiraiya', 'axolotl'] },
  { id: 'fantasmas', horror: true, name: 'Fantasmas', emoji: '👻', color: '#b8c6ff', items: ['samara', 'sadako', 'kayako', 'llorona', 'bloodymary', 'hanako', 'yurei', 'kingboo', 'gengar', 'ghostbusters', 'danny', 'beetlejuice', 'mama', 'nopperabo'] },
  { id: 'gigantes', name: 'Monstruos gigantes', emoji: '🦖', color: '#8ce99a', items: ['godzilla', 'kingkong', 'trex', 'sirenhead', 'scp682', 'scp169', 'galactus', 'jaws', 'rex', 'longhorse'] },
  { id: 'genios', name: 'Genios', emoji: '🧠', color: '#2ee6ff', items: ['rick', 'doc', 'dexter', 'einstein', 'jimmy', 'lisa', 'sheldon', 'l', 'ironman', 'megamind', 'hermione', 'eggman'] },
  { id: 'calvos', name: 'Calvos legendarios', emoji: '👨‍🦲', color: '#ffe066', items: ['luthor', 'voldemort', 'gru', 'walter', 'burns', 'saitama', 'kratos', 'bezos', 'megamind', 'orlok', 'rock'] },
  { id: 'espadas', name: 'Maestros de la espada', emoji: '⚔️', color: '#e8e2d0', items: ['zoro', 'link', 'tanjiro', 'sparrow', 'geralt', 'arya', 'ichigo', 'luke', 'kylo', 'vader', 'aragorn', 'trunks', 'mulan', 'metaknight'] },
  { id: 'munecos', horror: true, name: 'Muñecos y juguetes malditos', emoji: '🪆', color: '#c21f3a', items: ['chucky', 'annabelle', 'm3gan', 'jigsaw', 'huggy', 'freddyfaz', 'lotso', 'scp1048', 'bendy', 'youngHee', 'labubu', 'pinocchio'] },
  { id: 'reyes', name: 'Reyes y reinas', emoji: '👑', color: '#ffd23d', items: ['simba', 'scar', 'elsa', 'peach', 'zelda', 'daenerys', 'joffrey', 'kingboo', 'farquaad', 'vegeta', 'mj', 'aragorn', 'nightking'] },
  { id: 'roedores', name: 'Ratones y roedores', emoji: '🐭', color: '#d6d6e6', items: ['mickey', 'jerry', 'remy', 'pikachu', 'capybara', 'hamster', 'squirrel', 'scrat', 'sandy'] },
  { id: 'osos', name: 'Osos', emoji: '🐻', color: '#c08552', items: ['bear', 'panda', 'po', 'lotso', 'teddy', 'freddyfaz', 'gummies', 'scp1048', 'snorlax'] },
  { id: 'clasicos', horror: true, name: 'Monstruos clásicos', emoji: '🧛', color: '#9d7bff', items: ['dracula', 'orlok', 'frankenstein', 'wolfman', 'mummy', 'xenomorph', 'predator', 'thething', 'jeepers'] },
  { id: 'detectives', name: 'Detectives', emoji: '🔍', color: '#6ea8ff', items: ['sherlock', 'l', 'scooby', 'batman', 'house', 'hopper', 'daredevil'] },
  { id: 'fuertes', name: 'Súper fuertes', emoji: '💪', color: '#ff4b4b', items: ['hulk', 'goku', 'saitama', 'allmight', 'rock', 'mrincredible', 'kratos', 'popeye', 'hercules', 'broly', 'gorilla'] },
  { id: 'tentaculos', name: 'Tentáculos', emoji: '🐙', color: '#ff5fc8', items: ['ursula', 'docock', 'octopus', 'squidward', 'slenderman', 'venom', 'carnage', 'jellyfish'] },
  { id: 'dragones', name: 'Dragones', emoji: '🐉', color: '#ff7a00', items: ['toothless', 'charizard', 'spyro', 'daenerys', 'scp1762', 'mushu'] },
  { id: 'aliens', name: 'Extraterrestres', emoji: '👽', color: '#39ff88', items: ['et', 'stitch', 'xenomorph', 'predator', 'amongus', 'frieza', 'superman', 'zim', 'grogu', 'piccolo', 'megamind'] },
  { id: 'hermanos', name: 'Hermanos famosos', emoji: '👬', color: '#48c6ff', items: ['mario', 'luigi', 'sasuke', 'itachi', 'elsa', 'anna', 'tanjiro', 'nezuko', 'gradytwins', 'bart', 'lisa', 'thor', 'loki'] },
  { id: 'internet', name: 'Reyes de internet', emoji: '📱', color: '#ff2e4d', items: ['speed', 'kai', 'lapeace', 'fanumtax', 'speedbark', 'mrbeast', 'ninja', 'skibidi', 'rubius', 'ibai', 'siuu'] },
  { id: 'verdes', name: 'Personajes verdes', emoji: '💚', color: '#39ff88', items: ['shrek', 'hulk', 'yoda', 'grogu', 'mike', 'plankton', 'kermittea', 'piccolo', 'creeper', 'luigi', 'grinch', 'broly', 'feid'] },
  { id: 'azules', name: 'Personajes azules', emoji: '💙', color: '#2e7bff', items: ['sonic', 'stitch', 'genie', 'dory', 'megamind', 'sulley', 'bluey', 'marge', 'doraemon', 'aang'] },
  { id: 'naranjas', name: 'Personajes naranjas', emoji: '🧡', color: '#ff8a3d', items: ['garfield', 'nemo', 'crash', 'charizard', 'fox', 'tiger', 'goku', 'naruto', 'ahsoka', 'nami'] },
  { id: 'chefs', name: 'En la cocina', emoji: '👨‍🍳', color: '#ffa94d', items: ['remy', 'sanji', 'krabs', 'saltbae', 'monica', 'pan', 'knife', 'gus'] },
  { id: 'brujas', horror: true, name: 'Brujas y leyendas', emoji: '🧹', color: '#8a0020', items: ['blairwitch', 'lechuza', 'sayona', 'maleficent', 'ursula', 'scarletwitch', 'bellatrix', 'broom', 'nahual'] },
];

export const THEME_BY_ID: Record<string, Theme> = Object.fromEntries(THEMES.map((t) => [t.id, t]));
