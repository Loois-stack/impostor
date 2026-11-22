import { motion } from 'framer-motion';
import { Emo } from '../components/Emo';
import { TopBar, stagger } from '../components/ui';
import { useGame } from '../store/game';

const STEPS = [
  ['🎴', 'Tu sobre', 'Cada quien recibe su propio sobre: córtalo deslizando el dedo por la línea punteada, se llena de luz y sale tu carta. Mantenla presionada para verla en secreto. Con un teléfono, se lo van pasando; con varios, cada quien abre el suyo.'],
  ['✨', 'Brillos', 'Al abrir el sobre sale un brillo: plateado, dorado, rosa, amatista, holográfico o cósmico (el más raro). Es pura suerte y es igual para civiles e impostores: no delata a nadie.'],
  ['🔪', 'El impostor', 'Todos tienen la MISMA carta… menos el impostor, que tiene algo PARECIDO pero distinto (o nada, en modo clásico). A veces casi idéntico y puede camuflarse; a veces tendrá que jugársela.'],
  ['👥', 'Varios impostores', 'Con más jugadores puede haber más impostores (en automático: 1 hasta 5 jugadores, 2 hasta 8, 3 hasta 11…). Cada uno tiene una carta distinta y no sabe quiénes son los otros, salvo que activen el modo equipo: ahí se conocen, comparten carta y ganan juntos.'],
  ['🗣️', 'Pistas', 'Por turnos, cada jugador dice una palabra o frase sobre su carta. Muy obvia = el impostor la descubre. Muy vaga = sospechan de ti.'],
  ['⚡', 'Eventos especiales', 'Al que le toca turno puede caerle un evento: voz ridícula, acento mexicano, mímica, restricciones… La app avisa a quién le tocó y se quita cuando pasa el turno. Si lo cumple, +50.'],
  ['🤫', 'Misiones secretas', 'A veces tu carta trae una misión que solo tú conoces: defender al sospechoso, hacerte el culpable… Nadie sabe quién tiene una hasta el final. Vale +100.'],
  ['🎡', 'Eventos de ronda', 'Algunas rondas cambian las reglas: doble impostor, fiesta mexicana, cine mudo, ronda dorada, un bufón que quiere que lo acusen… y a veces un evento secreto que nadie conoce.'],
  ['🗳️', 'Votación', 'Decidan juntos o voten en secreto. En eliminación, el acusado sale y la búsqueda sigue; cada inocente que echen les resta premio. Si quedan 2, gana el impostor.'],
  ['✋', 'Pedir votación (varios teléfonos)', 'Cualquiera puede tocar el botón rojo 🗳️ para pedir que se vote. Cuando lo pide la mayoría, al terminar la vuelta todos pasan a votar; si lo piden todos, se vota en ese momento. Se puede cancelar tocándolo otra vez.'],
  ['📢', 'Reunión', 'Al terminar cada vuelta, todos pasan a la reunión para discutir y deciden: ▶ Otra vuelta de pistas o 🗳️ Votar. Pasando el teléfono, decide la mesa en voz alta. En varios teléfonos cada quien toca uno: con mayoría se hace al momento; si se acaba el tiempo (1:30), gana lo más pedido (empate: otra vuelta).'],
  ['👀', 'Espectadores (varios teléfonos)', 'Si alguien entra con la ronda empezada, a todos les sale un aviso y mira la partida como espectador (puede hablar por la llamada y reaccionar); en la siguiente ronda ya juega. A quien eliminan también se queda mirando hasta que termine la ronda.'],
  ['💀', 'Animaciones de eliminación', 'Cuando acusan a alguien, antes de saber si era el impostor, se ve su eliminación: ⚡ rayo, 🕳️ agujero negro, 🪅 piñatazo, 🚀 al espacio, 🛸 abducido o 🧊 congelado. Cada quien elige la suya (o sorpresa) tocando su avatar.'],
  ['📞', 'Llamada de voz', 'En una sala pueden hablar por el micrófono y oírse por el altavoz en tiempo real (botón 📞 abajo a la izquierda). Un toque abre o silencia tu micrófono. Mejor para cuando no están en el mismo lugar: juntos, los teléfonos hacen eco.'],
  ['🚪', 'Salir de la partida', 'En varios teléfonos puedes salir cuando quieras (te pregunta si estás seguro). La partida sigue sin ti: se salta tu turno y no te esperan para votar. Si sale el anfitrión, se cierra la sala para todos.'],
  ['📡', 'Si se cae la conexión', 'Si se desconectan todos, el anfitrión vuelve a la sala con la ronda en pausa (el reloj se detiene) y el código a la vista: cuando vuelvan a entrar, toca ⏯️ Continuar ronda. Si el que se cae es el anfitrión, a los demás les aparece un aviso para reintentar o ir al menú; si no regresa, los lleva a "Entrar a una sala" con el código ya puesto.'],
  ['🎯', 'Última oportunidad', 'Si atrapan al impostor, antes de revelar la verdad tiene una oportunidad: adivinar la carta de los civiles entre seis. Si acierta, se lleva +150. Si atraparon a varios, cada uno elige en secreto y se revela al final.'],
  ['🏆', 'Puntos', 'Civiles: +100 si atrapan al impostor. Impostor: +250 si sobrevive, o +150 si lo atrapan pero adivina la carta. Rachas multiplican hasta x2. Sube de nivel y desbloquea logros.'],
  ['💚', 'Para pasarla bien', 'Los eventos están hechos para reírse, no para arriesgarse: nada de alcohol, golpes ni retos peligrosos. El modo +18 solo agrega groserías, y van para la carta, nunca para una persona.'],
];

export function HowTo() {
  const go = useGame((s) => s.go);
  return (
    <div className="screen">
      <TopBar title="Cómo jugar" onBack={() => go('home')} />
      <div className="scroll content">
        <div className="stack" style={{ gap: 10 }}>
          {STEPS.map(([e, t, d], i) => (
            <motion.div key={t} {...stagger(i, 0.07)} className="panel row" style={{ alignItems: 'flex-start', gap: 14 }}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>
                <Emo e={e} delay={-i * 0.3} />
              </div>
              <div>
                <div className="display" style={{ fontSize: 26 }}>
                  {i + 1}. {t}
                </div>
                <div className="dim" style={{ fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>
                  {d}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
