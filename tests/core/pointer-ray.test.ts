import { describe, expect, it } from 'vitest';
import { rayFromOrientation } from '../../src/core/pointer-ray.js';
import { createHands, sampleFromJoints, updateHandRuntime } from '../../src/core/hands.js';

describe('pointer ray', () => {
  it('points forward for an identity pose', () => {
    const ray = rayFromOrientation({ x: 0, y: 1.4, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
    expect(ray.origin).toEqual({ x: 0, y: 1.4, z: 0 });
    expect(ray.direction.z).toBeLessThan(-0.99);
  });

  it('fires justPinched on the frame a pinch starts (distance fallback)', () => {
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

  it('tracks justSelected separately from tip-distance pinch', () => {
    const hands = createHands();
    const open = sampleFromJoints('right', {
      wrist: { x: 0, y: 1, z: 0 },
      'index-finger-tip': { x: 0.05, y: 1, z: 0 },
      'thumb-tip': { x: 0, y: 1, z: 0 },
    });
    open.selectPressed = false;
    open.selectValue = 0.2;
    updateHandRuntime(hands.right, open, 0.016, 1, false, true, false, false);
    expect(hands.right.selectPressed).toBe(false);
    expect(hands.right.justSelected).toBe(false);

    const select = { ...open, selectPressed: true, selectValue: 1 };
    updateHandRuntime(hands.right, select, 0.016, 1, false, true, false, false);
    expect(hands.right.selectPressed).toBe(true);
    expect(hands.right.justSelected).toBe(true);
    expect(hands.right.pinched).toBe(true);
  });

  it('still pinches from tight tip contact when select is false', () => {
    const hands = createHands();
    const near = sampleFromJoints('right', {
      wrist: { x: 0, y: 1, z: 0 },
      'index-finger-tip': { x: 0.015, y: 1, z: 0 },
      'thumb-tip': { x: 0, y: 1, z: 0 },
    });
    near.selectPressed = false;
    near.selectValue = 0;
    updateHandRuntime(hands.right, near, 0.016, 1, false, true, false, false);
    expect(hands.right.pinched).toBe(true);
    expect(hands.right.justPinched).toBe(true);
    expect(hands.right.selectPressed).toBe(false);
    expect(hands.right.justSelected).toBe(false);
  });
});
