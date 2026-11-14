import type { ExplorerEntry } from '../assets/types.js';

export interface CardLayout {
  id: string;
  type: ExplorerEntry['type'];
  x: number;
  y: number;
  width: number;
  height: number;
}

export function layoutExplorerCards(
  entries: ExplorerEntry[],
  panelWidth: number,
  iconSize = 0.11,
  gap = 0.05,
): CardLayout[] {
  // Keep thumbnails clear of the left Favorites/Pictures/Movies sidebar.
  const contentLeft = -panelWidth * 0.02;
  return entries.map((entry, index) => ({
    id: entry.id,
    type: entry.type,
    x: contentLeft + index * (iconSize + gap),
    y: 0.02,
    width: iconSize,
    height: iconSize,
  }));
}
