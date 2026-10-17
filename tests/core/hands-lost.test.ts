import { describe, expect, it } from 'vitest';
import { createHands, updateHandRuntime } from '../../src/core/hands.js';

describe('tracking lost', () => {
  it('releases pinch without teleporting when a hand is lost', () => {
    const hands = createHands();
    updateHandRuntime(
      hands.right,
      {
        handedness: 'right',
        tracked: true,
        joints: {},
        indexTip: { x: 0.1, y: 1, z: -0.4 },
        thumbTip: { x: 0.11, y: 1, z: -0.4 },
        palm: { x: 0.1, y: 1, z: -0.4 },
        palmNormal: { x: 0, y: 0, z: -1 },
        wrist: { x: 0.1, y: 1, z: -0.4 },
      },
      0.016,
      1.05,
      false,
      true,
      false,
      false,
    );
    const pose = { ...hands.right.wrist! };
    updateHandRuntime(hands.right, null, 0.016, 1.05, false, true, false, false);
    expect(hands.right.tracked).toBe(false);
    expect(hands.right.pinched).toBe(false);
    expect(hands.right.lost).toBe(true);
    expect(hands.right.wrist).toEqual(pose);
  });
});
