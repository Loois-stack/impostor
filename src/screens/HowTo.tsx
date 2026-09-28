import { motion } from 'framer-motion';
import { TopBar, stagger } from '../components/ui';
import { useGame } from '../store/game';

const STEPS = [
  ['🃏', 'Reparto', 'Pasen el teléfono. Cada quien mantiene presionada su carta en secreto: ve una imagen y contexto de lo que le tocó.'],
  ['🔪', 'El impostor', 'Todos tienen la MISMA carta… menos el impostor, que tiene algo PARECIDO pero distinto (o nada, en modo clásico). A veces casi idéntico y puede camuflarse; a veces tendrá que jugársela.'],
  ['🗣️', 'Pistas', 'Por turnos, cada jugador dice una palabra o frase sobre su carta. Muy obvia = el impostor la descubre. Muy vaga = sospechan de ti.'],
  ['🎭', 'Retos', 'Al que le toca turno puede caerle un reto: voz ridícula, mímica, restricciones… o una traición secreta, como defender al que sospechas.'],
  ['⚡', 'Eventos', 'Algunas rondas traen sorpresas: doble impostor, impostor a ciegas (no sabe que lo es), palabra maldita… y rondas donde quizá no hay impostor.'],
  ['🗳️', 'Votación', 'Discutan y elijan juntos al sospechoso. Si atrapan al impostor, aún puede ganar puntos adivinando la carta de los civiles.'],
  ['🏆', 'Puntos', 'Civiles: +100 si atrapan al impostor. Impostor: +250 si sobrevive. Retos: +50 / −25. Rachas multiplican hasta x2. Sube de nivel y desbloquea logros.'],
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
              <div style={{ fontSize: 32, lineHeight: 1 }}>{e}</div>
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
