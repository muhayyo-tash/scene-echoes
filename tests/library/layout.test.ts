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

  it('grids four movies without overlap and inside the pane', () => {
    const panelWidth = 0.52;
    const panelHeight = 0.34;
    const cards = layoutExplorerCards(
      [
        { type: 'video', id: 'japan' },
        { type: 'video', id: 'london' },
        { type: 'video', id: 'mountains' },
        { type: 'video', id: 'paragliding' },
      ],
      panelWidth,
      panelHeight,
    );
    expect(cards).toHaveLength(4);
    const halfW = panelWidth / 2;
    const halfH = panelHeight / 2;
    const sidebar = panelWidth * 0.28;
    for (let i = 0; i < cards.length; i++) {
      const a = cards[i];
      expect(a.x - a.width / 2).toBeGreaterThan(-halfW + sidebar - 0.015);
      expect(a.x + a.width / 2).toBeLessThan(halfW - 0.01);
      expect(a.y + a.height / 2).toBeLessThan(halfH - 0.02);
      expect(a.y - a.height / 2).toBeGreaterThan(-halfH + 0.02);
      for (let j = i + 1; j < cards.length; j++) {
        const b = cards[j];
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        const separate =
          dx > (a.width + b.width) / 2 + 0.008 || dy > (a.height + b.height) / 2 + 0.008;
        expect(separate).toBe(true);
      }
    }
    // 2x2: two distinct rows and columns
    const xs = new Set(cards.map((c) => c.x.toFixed(4)));
    const ys = new Set(cards.map((c) => c.y.toFixed(4)));
    expect(xs.size).toBe(2);
    expect(ys.size).toBe(2);
  });
});
