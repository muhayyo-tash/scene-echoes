import { describe, expect, it } from 'vitest';
import { closeExplorer, createSpaceState, openExplorer, openMovie, openPhoto } from '../../src/core/space.js';

describe('space manager', () => {
  it('opens and closes the explorer from a clean view', () => {
    let state = createSpaceState();
    state = openExplorer(state);
    expect(state.space).toBe('explorer');
    state = closeExplorer(state);
    expect(state.space).toBe('clean');
  });

  it('pauses conceptually while a movie is open and the explorer returns to movie', () => {
    let state = openMovie(createSpaceState());
    state = openExplorer(state);
    expect(state.explorerOpen).toBe(true);
    state = closeExplorer(state);
    expect(state.space).toBe('movie');
  });

  it('opens a photo from the explorer', () => {
    const state = openPhoto(openExplorer(createSpaceState()));
    expect(state.space).toBe('photo');
  });
});
