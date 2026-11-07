import { describe, expect, it } from 'vitest';
import { FILM_SAMPLE_SECONDS, sampleTimes, shouldKeepLabel } from '../../src/conversion/film-sample.js';

describe('film sample policy', () => {
  it('samples a 30s 15fps clip every 6 seconds, not every 6 frames', () => {
    expect(FILM_SAMPLE_SECONDS).toBe(6);
    expect(sampleTimes(30)).toEqual([6, 12, 18, 24]);
  });

  it('keeps one fallback sample for a short clip', () => {
    expect(sampleTimes(4)).toEqual([2]);
  });

  it('repeats a label only after the sample gap', () => {
    expect(shouldKeepLabel('fox', [], 6)).toBe(true);
    expect(shouldKeepLabel('fox', [{ time: 6, label: 'fox' }], 12)).toBe(true);
    expect(shouldKeepLabel('fox', [{ time: 6, label: 'fox' }], 8)).toBe(false);
  });
});
