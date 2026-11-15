import { describe, expect, it } from 'vitest';
import { hasReactionSound, REACTION_VOICES } from '../audio/reactions';
import { REACTIONS } from '../fx/reactions';

describe('reacciones', () => {
  it('cada reacción tiene su propio sonido', () => {
    for (const e of REACTIONS) expect(hasReactionSound(e), e).toBe(true);
  });
  it('todos los sonidos tienen un volumen razonable', () => {
    for (const [name, [, level]] of Object.entries(REACTION_VOICES)) {
      expect(level, name).toBeGreaterThan(0);
      expect(level, name).toBeLessThan(6);
    }
  });
});
