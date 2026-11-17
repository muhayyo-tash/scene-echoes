import type { ExplorerEntry } from '../assets/types.js';

export interface CardLayout {
  id: string;
  type: ExplorerEntry['type'];
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Matches `FINDER_SIDEBAR.ratio` in drawn.ts. */
const SIDEBAR_RATIO = 0.28;

/**
 * Finder-style icon grid in the content pane (right of the sidebar).
 * Top-left aligned like macOS Finder — never a tiny centered pile.
 */
export function layoutExplorerCards(
  entries: ExplorerEntry[],
  panelWidth: number,
  panelHeight = 0.34,
  iconSize = 0.088,
  gapX = 0.024,
  gapY = 0.042,
): CardLayout[] {
  const count = entries.length;
  if (count === 0) return [];

  const insetX = 0.02;
  const insetTop = 0.02;
  const insetBottom = 0.042;
  const contentLeft = -panelWidth / 2 + panelWidth * SIDEBAR_RATIO + insetX;
  const contentRight = panelWidth / 2 - insetX;
  const contentWidth = Math.max(0.01, contentRight - contentLeft);
  const contentTop = panelHeight / 2 - panelHeight * 0.12 - insetTop;
  const contentBottom = -panelHeight / 2 + insetBottom;
  const contentHeight = Math.max(0.01, contentTop - contentBottom);

  // Fill the pane width: as many columns as fit, then prefer fewer rows for 4+ files.
  let columns = Math.min(
    count,
    Math.max(1, Math.floor((contentWidth + gapX) / (iconSize + gapX))),
  );
  if (count >= 4) columns = Math.min(count, Math.max(columns, 3));
  if (count <= 2) columns = count;

  let size = iconSize;
  let stepX = size + gapX;
  let stepY = size + gapY;
  const rows = Math.ceil(count / columns);
  const needW = columns * size + Math.max(0, columns - 1) * gapX;
  const needH = rows * size + Math.max(0, rows - 1) * gapY + size * 0.5;
  if (needW > contentWidth || needH > contentHeight) {
    const scaleW = contentWidth / Math.max(needW, 1e-4);
    const scaleH = contentHeight / Math.max(needH, 1e-4);
    const scale = Math.min(1, scaleW, scaleH) * 0.98;
    size *= scale;
    // Spread leftover width across column gaps so icons are not glued together.
    const usedW = columns * size;
    const freeW = Math.max(0, contentWidth - usedW);
    stepX = size + (columns > 1 ? freeW / (columns - 1) : 0);
    const usedH = rows * size + size * 0.5;
    const freeH = Math.max(0, contentHeight - usedH);
    stepY = size + (rows > 1 ? Math.min(gapY, freeH / (rows - 1)) : 0);
    if (rows > 1 && freeH / (rows - 1) > gapY * 0.5) {
      stepY = size + freeH / (rows - 1);
    }
  } else if (columns > 1) {
    // Comfortable spread across the content pane (Finder leaves room between icons).
    const usedW = columns * size;
    const freeW = Math.max(gapX * (columns - 1), contentWidth - usedW);
    stepX = size + freeW / (columns - 1);
  }

  // Top-left of the content pane (not centered).
  const originX = contentLeft + size / 2;
  const originY = contentTop - size / 2;

  return entries.map((entry, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: entry.id,
      type: entry.type,
      x: originX + col * stepX,
      y: originY - row * stepY,
      width: size,
      height: size,
    };
  });
}
