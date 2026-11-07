import type { ExplorerEntry } from './types.js';

export function explorerWithFilms(entries: ExplorerEntry[], filmIds: string[]): ExplorerEntry[] {
  return [
    ...entries.filter((entry) => entry.type === 'photo'),
    ...filmIds.map((id) => ({ type: 'video' as const, id })),
  ];
}
