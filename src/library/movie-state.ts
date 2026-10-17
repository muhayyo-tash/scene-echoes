export type MovieCardState = 'idle' | 'processing' | 'ready' | 'failed';

export interface MovieProcessingSnapshot {
  status: MovieCardState;
  progress: number;
  startedAt: number | null;
}

const STORAGE_PREFIX = 'scene-echoes.movie.';

export function storageKey(filmId: string): string {
  return `${STORAGE_PREFIX}${filmId}`;
}

export function defaultMovieState(): MovieProcessingSnapshot {
  return { status: 'idle', progress: 0, startedAt: null };
}

export function saveMovieState(
  filmId: string,
  snapshot: MovieProcessingSnapshot,
  storage: Pick<Storage, 'setItem'> | null,
): void {
  if (!storage) return;
  if (snapshot.status !== 'ready') return;
  storage.setItem(storageKey(filmId), JSON.stringify(snapshot));
}

export function loadMovieState(
  filmId: string,
  storage: Pick<Storage, 'getItem'> | null,
): MovieProcessingSnapshot {
  if (!storage) return defaultMovieState();
  const raw = storage.getItem(storageKey(filmId));
  if (!raw) return defaultMovieState();
  try {
    const parsed = JSON.parse(raw) as MovieProcessingSnapshot;
    if (parsed.status === 'ready') return { status: 'ready', progress: 1, startedAt: parsed.startedAt };
    return defaultMovieState();
  } catch {
    return defaultMovieState();
  }
}

export function clearMovieState(filmId: string, storage: Pick<Storage, 'removeItem'> | null): void {
  storage?.removeItem(storageKey(filmId));
}

export function beginMovieProcessing(
  snapshot: MovieProcessingSnapshot,
  nowMs: number,
): MovieProcessingSnapshot {
  if (snapshot.status === 'ready' || snapshot.status === 'processing') return snapshot;
  return { status: 'processing', progress: 0, startedAt: nowMs };
}
