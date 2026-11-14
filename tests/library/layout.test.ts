import { describe, expect, it } from 'vitest';
import { layoutExplorerCards } from '../../src/library/layout.js';

describe('library layout', () => {
  it('lays out a photo and a video without overlap', () => {
    const cards = layoutExplorerCards(
      [
        { type: 'photo', id: 'sofa' },
        { type: 'video', id: 'park' },
      ],
      0.52,
    );
    expect(cards).toHaveLength(2);
    const [a, b] = cards;
    expect(Math.abs(a.x - b.x)).toBeGreaterThan((a.width + b.width) / 2 - 0.001);
  });

  it('keeps movie thumbnails inside the Finder content pane', () => {
    const panelWidth = 0.52;
    const cards = layoutExplorerCards(
      [
        { type: 'video', id: 'mountains' },
        { type: 'video', id: 'park_winter' },
      ],
      panelWidth,
    );
    const half = panelWidth / 2;
    const sidebar = panelWidth * 0.28;
    for (const card of cards) {
      const left = card.x - card.width / 2;
      const right = card.x + card.width / 2;
      expect(left).toBeGreaterThan(-half + sidebar - 0.01);
      expect(right).toBeLessThan(half - 0.01);
    }
  });
});
