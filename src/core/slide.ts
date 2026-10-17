export type SlideDirection = 'left' | 'right' | null;

export interface SlideState {
  tracking: boolean;
  startX: number;
  elapsed: number;
}

export function createSlideState(): SlideState {
  return { tracking: false, startX: 0, elapsed: 0 };
}

export function updateSlide(
  state: SlideState,
  openPalm: boolean,
  atChestHeight: boolean,
  touchingObject: boolean,
  palmX: number,
  dt: number,
  swipeDistance: number,
  swipeSeconds: number,
): SlideDirection {
  if (!openPalm || !atChestHeight || touchingObject) {
    state.tracking = false;
    state.elapsed = 0;
    return null;
  }
  if (!state.tracking) {
    state.tracking = true;
    state.startX = palmX;
    state.elapsed = 0;
    return null;
  }
  state.elapsed += dt;
  const dx = palmX - state.startX;
  if (state.elapsed <= swipeSeconds && Math.abs(dx) >= swipeDistance) {
    state.tracking = false;
    state.elapsed = 0;
    return dx < 0 ? 'left' : 'right';
  }
  if (state.elapsed > swipeSeconds) {
    state.startX = palmX;
    state.elapsed = 0;
  }
  return null;
}
