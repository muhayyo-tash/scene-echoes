import { describe, expect, it } from 'vitest';
import { layoutExplorerCards } from '../../src/library/layout.js';

describe('library layout', () => {
  it('lays out a photo and a video without overlap', () => {
    const cards = layoutExplorerCards(
      [
        { type: 'photo', id: 'sofa' },
        { type: 'video', id: 'park' },
      ],
      0.9,
    );
    expect(cards).toHaveLength(2);
    const [a, b] = cards;
    expect(Math.abs(a.x - b.x)).toBeGreaterThan((a.width + b.width) / 2 - 0.001);
  });
});
