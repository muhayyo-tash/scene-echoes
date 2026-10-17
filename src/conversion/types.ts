import type { ManifestObject } from '../assets/types.js';

export interface ModelHandle {
  object: ManifestObject;
  root: unknown;
  source: 'manifest' | 'live';
}

export interface ModelProgress {
  progress: number;
  status: 'queued' | 'processing' | 'done' | 'failed';
}

export interface ModelSource {
  request(id: string, point?: { x: number; y: number }): Promise<ModelHandle>;
  subscribe(listener: (progress: ModelProgress) => void): () => void;
}

export type FilmStatus = 'idle' | 'processing' | 'ready' | 'failed';

export interface FilmProgress {
  status: FilmStatus;
  progress: number;
}

export interface FilmProcessing {
  start(filmId: string): Promise<void>;
  get(filmId: string): FilmProgress;
  subscribe(listener: (id: string, progress: FilmProgress) => void): () => void;
  markReady?(filmId: string): void;
  reset?(filmId: string): void;
}
