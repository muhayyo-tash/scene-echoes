export type AppSpace = 'clean' | 'explorer' | 'photo' | 'movie' | 'converting';

export interface SpaceState {
  space: AppSpace;
  explorerOpen: boolean;
  photoOpen: boolean;
  movieOpen: boolean;
}

export function createSpaceState(): SpaceState {
  return { space: 'clean', explorerOpen: false, photoOpen: false, movieOpen: false };
}

export function openExplorer(state: SpaceState): SpaceState {
  if (state.movieOpen) return { ...state, explorerOpen: true, space: 'explorer' };
  return { ...state, explorerOpen: true, space: 'explorer' };
}

export function closeExplorer(state: SpaceState): SpaceState {
  if (state.movieOpen) return { ...state, explorerOpen: false, space: 'movie' };
  if (state.photoOpen) return { ...state, explorerOpen: false, space: 'photo' };
  return { ...state, explorerOpen: false, space: 'clean' };
}

export function openPhoto(state: SpaceState): SpaceState {
  return { ...state, photoOpen: true, space: 'photo' };
}

export function closePhoto(state: SpaceState): SpaceState {
  return {
    ...state,
    photoOpen: false,
    space: state.explorerOpen ? 'explorer' : 'clean',
  };
}

export function openMovie(state: SpaceState): SpaceState {
  return { ...state, movieOpen: true, explorerOpen: false, space: 'movie' };
}

export function closeMovie(state: SpaceState): SpaceState {
  return { ...state, movieOpen: false, space: state.explorerOpen ? 'explorer' : 'clean' };
}
