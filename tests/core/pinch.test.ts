import { describe, expect, it } from 'vitest';
import { pinchMidpoint, updatePinch } from '../../src/core/pinch.js';

describe('pinch hysteresis', () => {
  it('starts below on distance and ends above off distance', () => {
    const state = { pinched: false };
    expect(updatePinch(state, 0.03, 0.02, 0.035)).toBe(false);
    expect(updatePinch(state, 0.019, 0.02, 0.035)).toBe(true);
    expect(updatePinch(state, 0.03, 0.02, 0.035)).toBe(true);
    expect(updatePinch(state, 0.036, 0.02, 0.035)).toBe(false);
  });

  it('midpoint is between tips', () => {
    expect(pinchMidpoint({ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 })).toEqual({ x: 1, y: 2, z: 3 });
  });
});
