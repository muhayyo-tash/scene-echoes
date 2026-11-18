import { describe, expect, it } from 'vitest';
import { isPalmGrab } from '../../src/core/palm-grab.js';

describe('palm grab (fist)', () => {
  it('rejects an open hand', () => {
    const palm = { x: 0, y: 0, z: 0 };
    expect(
      isPalmGrab({
        palm,
        tips: [
          { x: 0.1, y: 0, z: 0 },
          { x: 0.12, y: 0, z: 0 },
          { x: 0.11, y: 0.02, z: 0 },
          { x: 0.09, y: -0.02, z: 0 },
        ],
      }),
    ).toBe(false);
  });

  it('accepts a tightly curled fist', () => {
    const palm = { x: 0, y: 0, z: 0 };
    expect(
      isPalmGrab({
        palm,
        tips: [
          { x: 0.025, y: 0.01, z: 0 },
          { x: 0.02, y: 0, z: 0.01 },
          { x: 0.022, y: -0.01, z: 0 },
          { x: 0.03, y: 0, z: -0.01 },
        ],
      }),
    ).toBe(true);
  });

  it('rejects a loose / partial curl', () => {
    const palm = { x: 0, y: 0, z: 0 };
    expect(
      isPalmGrab({
        palm,
        tips: [
          { x: 0.09, y: 0.01, z: 0 },
          { x: 0.088, y: 0, z: 0.01 },
          { x: 0.092, y: -0.01, z: 0 },
          { x: 0.1, y: 0, z: -0.01 },
        ],
      }),
    ).toBe(false);
  });

  it('rejects a Quest-style partial fist with only three curled tips', () => {
    const palm = { x: 0, y: 0, z: 0 };
    expect(
      isPalmGrab({
        palm,
        tips: [
          { x: 0.04, y: 0.01, z: 0 },
          { x: 0.045, y: 0, z: 0.01 },
          { x: 0.042, y: -0.01, z: 0 },
          { x: 0.1, y: 0, z: -0.01 },
        ],
      }),
    ).toBe(false);
  });

  it('rejects a pinch-only pose (one tip near palm)', () => {
    const palm = { x: 0, y: 0, z: 0 };
    expect(
      isPalmGrab({
        palm,
        tips: [
          { x: 0.02, y: 0, z: 0 },
          { x: 0.12, y: 0, z: 0 },
          { x: 0.13, y: 0, z: 0 },
          { x: 0.11, y: 0, z: 0 },
        ],
      }),
    ).toBe(false);
  });
});
