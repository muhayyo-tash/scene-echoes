import { describe, expect, it } from 'vitest';
import { spawnInFront } from '../../src/core/placement.js';

describe('spawnInFront', () => {
  it('places the object ahead of the head, not at the player', () => {
    const placed = spawnInFront(
      { x: 0, y: 1.5, z: 0 },
      { x: 0, z: -1 },
      [],
      1.15,
      0.35,
    );
    expect(placed.point.z).toBeCloseTo(-1.15, 5);
    expect(placed.point.y).toBeCloseTo(1.15, 5);
    expect(placed.surface).toBeNull();
  });
});
