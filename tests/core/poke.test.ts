import { describe, expect, it } from 'vitest';
import { createPokeState, updatePoke } from '../../src/core/poke.js';

describe('poke', () => {
  it('fires once then cools down', () => {
    const state = createPokeState();
    expect(updatePoke(state, 0.01, 0.015, 0.016, 300)).toBe(true);
    expect(updatePoke(state, 0.01, 0.015, 0.016, 300)).toBe(false);
    expect(updatePoke(state, 0.04, 0.015, 0.4, 300)).toBe(false);
    expect(updatePoke(state, 0.01, 0.015, 0.016, 300)).toBe(true);
  });
});
