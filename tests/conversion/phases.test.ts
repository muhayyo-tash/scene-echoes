import { describe, expect, it } from 'vitest';
import { conversionPhase, progressFromElapsed } from '../../src/conversion/phases.js';

describe('conversion phases', () => {
  it('maps progress to outline, lift, build and settle', () => {
    expect(conversionPhase(0.05).phase).toBe('select');
    expect(conversionPhase(0.3).phase).toBe('lift');
    expect(conversionPhase(0.6).phase).toBe('build');
    expect(conversionPhase(0.95).phase).toBe('settle');
    expect(conversionPhase(1).phase).toBe('done');
  });

  it('clamps elapsed time into 0..1', () => {
    expect(progressFromElapsed(2.5, 5)).toBe(0.5);
    expect(progressFromElapsed(9, 5)).toBe(1);
  });
});
