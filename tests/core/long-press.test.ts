import { describe, expect, it } from 'vitest';
import { createLongPressState, updateLongPress } from '../../src/core/long-press.js';

describe('long press', () => {
  it('fires after hold while still', () => {
    const state = createLongPressState();
    expect(updateLongPress(state, true, { x: 0, y: 0, z: 0 }, 0.4, 0.8, 0.02)).toBe(false);
    expect(updateLongPress(state, true, { x: 0, y: 0, z: 0 }, 0.5, 0.8, 0.02)).toBe(true);
  });

  it('resets if the hand moves too far', () => {
    const state = createLongPressState();
    updateLongPress(state, true, { x: 0, y: 0, z: 0 }, 0.5, 0.8, 0.02);
    expect(updateLongPress(state, true, { x: 0.1, y: 0, z: 0 }, 0.5, 0.8, 0.02)).toBe(false);
    expect(state.elapsed).toBe(0);
  });

  it('does nothing if the pinch is released early', () => {
    const state = createLongPressState();
    updateLongPress(state, true, { x: 0, y: 0, z: 0 }, 0.4, 0.8, 0.02);
    expect(updateLongPress(state, false, { x: 0, y: 0, z: 0 }, 0.5, 0.8, 0.02)).toBe(false);
  });
});
