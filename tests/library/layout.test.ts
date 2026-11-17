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
      0.34,
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
      0.34,
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

  it('spreads five movies across the pane instead of a centered pile', () => {
    const panelWidth = 0.52;
    const panelHeight = 0.34;
    const cards = layoutExplorerCards(
      [
        { type: 'video', id: 'japan' },
        { type: 'video', id: 'london' },
        { type: 'video', id: 'mountains' },
        { type: 'video', id: 'mountains_1' },
        { type: 'video', id: 'paragliding' },
      ],
      panelWidth,
      panelHeight,
    );
    expect(cards).toHaveLength(5);
    const halfW = panelWidth / 2;
    const halfH = panelHeight / 2;
    const sidebar = panelWidth * 0.28;
    const contentLeft = -halfW + sidebar;
    // First icon starts near the left of the content pane (not centered).
    expect(cards[0].x - cards[0].width / 2).toBeLessThan(contentLeft + 0.06);
    const xs = new Set(cards.map((c) => c.x.toFixed(3)));
    expect(xs.size).toBeGreaterThanOrEqual(3);
    for (const card of cards) {
      expect(card.x - card.width / 2).toBeGreaterThan(-halfW + sidebar - 0.015);
      expect(card.x + card.width / 2).toBeLessThan(halfW - 0.01);
      expect(card.y + card.height / 2).toBeLessThan(halfH);
      expect(card.y - card.height / 2).toBeGreaterThan(-halfH);
    }
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i];
        const b = cards[j];
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        const separate =
          dx > (a.width + b.width) / 2 + 0.004 || dy > (a.height + b.height) / 2 + 0.004;
        expect(separate).toBe(true);
      }
    }
  });
});
