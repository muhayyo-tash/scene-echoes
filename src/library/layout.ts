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
 * Wraps to rows so many movies stay inside the chrome with even gaps.
 */
export function layoutExplorerCards(
  entries: ExplorerEntry[],
  panelWidth: number,
  panelHeight = 0.34,
  iconSize = 0.078,
  gapX = 0.036,
  gapY = 0.055,
): CardLayout[] {
  const count = entries.length;
  if (count === 0) return [];

  const insetX = 0.022;
  const insetTop = 0.028;
  const insetBottom = 0.05; // room for "N items" footer + labels under icons
  const contentLeft = -panelWidth / 2 + panelWidth * SIDEBAR_RATIO + insetX;
  const contentRight = panelWidth / 2 - insetX;
  const contentWidth = Math.max(0.01, contentRight - contentLeft);
  const contentTop = panelHeight / 2 - panelHeight * 0.12 - insetTop;
  const contentBottom = -panelHeight / 2 + insetBottom;
  const contentHeight = Math.max(0.01, contentTop - contentBottom);

  // Prefer 2 columns once there are 3+ items (Finder-like), else one row.
  const columns = count <= 2 ? count : Math.min(2, count);
  const rows = Math.ceil(count / columns);

  // Shrink icons if the grid would overflow the pane.
  let size = iconSize;
  let stepX = size + gapX;
  let stepY = size + gapY;
  const needW = columns * size + Math.max(0, columns - 1) * gapX;
  const needH = rows * size + Math.max(0, rows - 1) * gapY + size * 0.55; // label under last row
  if (needW > contentWidth || needH > contentHeight) {
    const scaleW = contentWidth / Math.max(needW, 1e-4);
    const scaleH = contentHeight / Math.max(needH, 1e-4);
    const scale = Math.min(1, scaleW, scaleH) * 0.96;
    size *= scale;
    stepX = size + gapX * scale;
    stepY = size + gapY * scale;
  }

  const gridWidth = columns * size + Math.max(0, columns - 1) * (stepX - size);
  const gridHeight = rows * size + Math.max(0, rows - 1) * (stepY - size);
  const originX = contentLeft + (contentWidth - gridWidth) / 2 + size / 2;
  const originY = contentTop - size / 2 - Math.max(0, (contentHeight - gridHeight - size * 0.45) * 0.15);

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
