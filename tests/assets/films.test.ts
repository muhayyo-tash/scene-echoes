import { describe, expect, it } from 'vitest';
import { explorerWithFilms } from '../../src/assets/films.js';

describe('explorer films', () => {
  it('turns each mp4 stem into a movie-scene video card', () => {
    expect(
      explorerWithFilms(
        [
          { type: 'photo', id: 'sofa' },
          { type: 'video', id: 'old' },
        ],
        ['clip'],
      ),
    ).toEqual([
      { type: 'photo', id: 'sofa' },
      { type: 'video', id: 'clip' },
    ]);
  });
});
