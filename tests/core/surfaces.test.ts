import { describe, expect, it } from 'vitest';
import {
  createSurfaceFinder,
  fingertipNearSurface,
  maybeDefaultFloor,
  nearestHorizontal,
} from '../../src/core/surfaces.js';
import { createSurfaceHoldState, updateSurfaceHold } from '../../src/core/touch.js';

describe('surfaces', () => {
  it('picks the nearest horizontal surface', () => {
    const floor = {
      id: 'floor',
      origin: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      horizontal: true,
      source: 'plane' as const,
    };
    expect(nearestHorizontal([floor], { x: 0.2, y: 1, z: 0.1 })?.id).toBe('floor');
  });

  it('uses a default floor after timeout when none exist', () => {
    const state = createSurfaceFinder();
    expect(maybeDefaultFloor(state, 1, 0.9, false)).toBeNull();
    const floor = maybeDefaultFloor(state, 20, 0.9, false);
    expect(floor?.source).toBe('default');
    expect(floor?.origin.y).toBeCloseTo(0.8);
  });

  it('detects a fingertip resting on a surface', () => {
    const surfaces = [
      {
        id: 'table',
        origin: { x: 0, y: 0.7, z: -0.4 },
        normal: { x: 0, y: 1, z: 0 },
        horizontal: true,
        source: 'plane' as const,
      },
    ];
    expect(fingertipNearSurface({ x: 0, y: 0.71, z: -0.4 }, surfaces, 0.03)).not.toBeNull();
  });

  it('surface hold ignores explorer or movie', () => {
    const state = createSurfaceHoldState();
    expect(
      updateSurfaceHold(state, true, false, { x: 0, y: 0, z: 0 }, 2, 2, 0.02),
    ).toBe(false);
    expect(updateSurfaceHold(state, true, true, { x: 0, y: 0, z: 0 }, 2, 2, 0.02)).toBe(true);
  });
});
