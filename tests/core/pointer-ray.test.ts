import { describe, expect, it } from 'vitest';
import { rayFromOrientation } from '../../src/core/pointer-ray.js';
import { createHands, sampleFromJoints, updateHandRuntime } from '../../src/core/hands.js';

describe('pointer ray', () => {
  it('points forward for an identity pose', () => {
    const ray = rayFromOrientation({ x: 0, y: 1.4, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
    expect(ray.origin).toEqual({ x: 0, y: 1.4, z: 0 });
    expect(ray.direction.z).toBeLessThan(-0.99);
  });

  it('fires justPinched on the frame a pinch starts', () => {
    const hands = createHands();
    const open = sampleFromJoints('right', {
      wrist: { x: 0, y: 1, z: 0 },
      'index-finger-tip': { x: 0.04, y: 1, z: 0 },
      'thumb-tip': { x: 0, y: 1, z: 0 },
    });
    updateHandRuntime(hands.right, open, 0.016, 1, false, true, false, false);
    expect(hands.right.justPinched).toBe(false);
    const pinched = sampleFromJoints('right', {
      wrist: { x: 0, y: 1, z: 0 },
      'index-finger-tip': { x: 0.01, y: 1, z: 0 },
      'thumb-tip': { x: 0, y: 1, z: 0 },
    });
    updateHandRuntime(hands.right, pinched, 0.016, 1, false, true, false, false);
    expect(hands.right.justPinched).toBe(true);
    updateHandRuntime(hands.right, pinched, 0.016, 1, false, true, false, false);
    expect(hands.right.justPinched).toBe(false);
  });
});
