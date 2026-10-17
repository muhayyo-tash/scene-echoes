import { describe, expect, it } from 'vitest';
import {
  createBookDetector,
  isBookOpenPose,
  isElevatedSurface,
  tableHeight,
  updateBookDetector,
} from '../../src/core/book.js';

describe('book detection', () => {
  it('recognizes two palms on a table as an open book', () => {
    expect(
      isBookOpenPose(
        { x: -0.15, y: 0.72, z: -0.4 },
        { x: 0.15, y: 0.73, z: -0.4 },
        0.7,
        1.3,
      ),
    ).toBe(true);
  });

  it('rejects a floor-level pose and a too-wide span', () => {
    expect(
      isBookOpenPose(
        { x: -0.15, y: 0.02, z: -0.4 },
        { x: 0.15, y: 0.02, z: -0.4 },
        0.7,
        1.3,
      ),
    ).toBe(false);
    expect(
      isBookOpenPose(
        { x: -0.5, y: 0.72, z: -0.4 },
        { x: 0.5, y: 0.72, z: -0.4 },
        0.7,
        1.3,
      ),
    ).toBe(false);
  });

  it('treats a table as elevated and the floor as not', () => {
    const floor = {
      id: 'floor',
      origin: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      horizontal: true,
      source: 'plane' as const,
    };
    const table = {
      id: 'table',
      origin: { x: 0, y: 0.7, z: -0.4 },
      normal: { x: 0, y: 1, z: 0 },
      horizontal: true,
      source: 'plane' as const,
    };
    expect(isElevatedSurface(floor, 0)).toBe(false);
    expect(isElevatedSurface(table, 0)).toBe(true);
    expect(tableHeight([floor, table])).toBe(0.7);
  });

  it('remembers an open book for a few seconds', () => {
    const state = createBookDetector();
    expect(updateBookDetector(state, true, 0.016, 8)).toBe(true);
    expect(updateBookDetector(state, false, 1, 8)).toBe(true);
    expect(updateBookDetector(state, false, 8, 8)).toBe(false);
  });
});
