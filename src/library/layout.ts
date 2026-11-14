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
 * Place thumbnails in the Finder content pane (right of the sidebar),
 * left-to-right, kept inside the chrome.
 */
export function layoutExplorerCards(
  entries: ExplorerEntry[],
  panelWidth: number,
  iconSize = 0.1,
  gap = 0.035,
): CardLayout[] {
  const inset = 0.024;
  const contentLeft = -panelWidth / 2 + panelWidth * SIDEBAR_RATIO + inset + iconSize / 2;
  const contentRight = panelWidth / 2 - inset - iconSize / 2;
  const span = Math.max(0, contentRight - contentLeft);
  const naturalStep = iconSize + gap;
  const lastIndex = Math.max(0, entries.length - 1);
  const step =
    lastIndex > 0 && lastIndex * naturalStep > span ? span / lastIndex : naturalStep;

  return entries.map((entry, index) => ({
    id: entry.id,
    type: entry.type,
    x: contentLeft + index * step,
    y: 0.015,
    width: iconSize,
    height: iconSize,
  }));
}
