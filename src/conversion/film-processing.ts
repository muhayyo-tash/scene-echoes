import {
  defaultMovieState,
  loadMovieState,
  saveMovieState,
  type MovieProcessingSnapshot,
} from '../library/movie-state.js';
import type { FilmProcessing, FilmProgress, FilmStatus } from './types.js';

function toProgress(snapshot: MovieProcessingSnapshot): FilmProgress {
  return {
    status: snapshot.status as FilmStatus,
    progress: snapshot.progress,
  };
}

export class FilmPreloadProcessing implements FilmProcessing {
  private readonly snapshots = new Map<string, MovieProcessingSnapshot>();
  private readonly listeners = new Set<(id: string, progress: FilmProgress) => void>();
  private readonly inflight = new Map<string, Promise<void>>();

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
    private readonly preload: (filmId: string, report: (progress: number) => void) => Promise<void>,
  ) {}

  get(filmId: string): FilmProgress {
    return toProgress(this.ensure(filmId));
  }

  async start(filmId: string): Promise<void> {
    const existing = this.inflight.get(filmId);
    if (existing) {
      await existing;
      return;
    }
    // Always run preload so switching films / refresh with stored "ready" still loads the MP4.
    const run = this.run(filmId);
    this.inflight.set(filmId, run);
    try {
      await run;
    } finally {
      this.inflight.delete(filmId);
    }
  }

  subscribe(listener: (id: string, progress: FilmProgress) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  markReady(filmId: string): void {
    this.commit(filmId, { status: 'ready', progress: 1, startedAt: Date.now() });
  }

  reset(filmId: string): void {
    this.storage?.removeItem?.(`scene-echoes.movie.${filmId}`);
    this.commit(filmId, defaultMovieState());
  }

  private async run(filmId: string): Promise<void> {
    this.commit(filmId, { status: 'processing', progress: 0, startedAt: Date.now() });
    try {
      await this.preload(filmId, (progress) => {
        const clamped = Math.min(1, Math.max(0, progress));
        this.commit(filmId, {
          status: clamped >= 1 ? 'ready' : 'processing',
          progress: clamped,
          startedAt: Date.now(),
        });
      });
      this.commit(filmId, { status: 'ready', progress: 1, startedAt: Date.now() });
    } catch (error) {
      console.warn('[scene-echoes] film preload failed', error);
      this.commit(filmId, { status: 'failed', progress: 0, startedAt: Date.now() });
    }
  }

  private ensure(filmId: string): MovieProcessingSnapshot {
    const existing = this.snapshots.get(filmId);
    if (existing) return existing;
    const loaded = loadMovieState(filmId, this.storage);
    this.snapshots.set(filmId, loaded);
    return loaded;
  }

  private commit(filmId: string, snapshot: MovieProcessingSnapshot): void {
    this.snapshots.set(filmId, snapshot);
    saveMovieState(filmId, snapshot, this.storage);
    const progress = toProgress(snapshot);
    for (const listener of this.listeners) listener(filmId, progress);
  }
}
