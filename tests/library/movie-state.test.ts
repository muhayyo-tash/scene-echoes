import { describe, expect, it } from 'vitest';
import { FilmPreloadProcessing } from '../../src/conversion/film-processing.js';
import {
  beginMovieProcessing,
  clearMovieState,
  defaultMovieState,
  loadMovieState,
  saveMovieState,
} from '../../src/library/movie-state.js';

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  } as Storage;
}

describe('movie processing state', () => {
  it('preloads assets then becomes ready', async () => {
    const reports: number[] = [];
    const films = new FilmPreloadProcessing(memory(), async (_id, report) => {
      report(0.5);
      reports.push(0.5);
      report(1);
    });
    expect(beginMovieProcessing(defaultMovieState(), 1000).status).toBe('processing');
    await films.start('park');
    expect(films.get('park').status).toBe('ready');
    expect(reports.length).toBeGreaterThan(0);
  });

  it('saves ready across reload and can be cleared', () => {
    const storage = memory();
    saveMovieState('park', { status: 'processing', progress: 0.2, startedAt: 5 }, storage);
    expect(loadMovieState('park', storage).status).toBe('idle');
    saveMovieState('park', { status: 'ready', progress: 1, startedAt: 5 }, storage);
    expect(loadMovieState('park', storage).status).toBe('ready');
    clearMovieState('park', storage);
    expect(loadMovieState('park', storage).status).toBe('idle');
  });

  it('does not restart a ready movie', async () => {
    const films = new FilmPreloadProcessing(null, async () => {
      throw new Error('should not preload again');
    });
    films.markReady('park');
    await films.start('park');
    expect(films.get('park').status).toBe('ready');
  });
});
