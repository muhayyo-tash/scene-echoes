import { describe, expect, it } from 'vitest';
import { createSlideState, updateSlide } from '../../src/core/slide.js';

describe('slide', () => {
  it('opens left and closes right', () => {
    const left = createSlideState();
    expect(updateSlide(left, true, true, false, 0, 0.1, 0.25, 0.5)).toBeNull();
    expect(updateSlide(left, true, true, false, -0.3, 0.2, 0.25, 0.5)).toBe('left');
    const right = createSlideState();
    updateSlide(right, true, true, false, 0, 0.1, 0.25, 0.5);
    expect(updateSlide(right, true, true, false, 0.3, 0.2, 0.25, 0.5)).toBe('right');
  });

  it('ignores slides while touching an object', () => {
    const state = createSlideState();
    updateSlide(state, true, true, false, 0, 0.1, 0.25, 0.5);
    expect(updateSlide(state, true, true, true, -0.4, 0.1, 0.25, 0.5)).toBeNull();
  });
});
