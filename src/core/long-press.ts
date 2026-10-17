import { distance3 } from './pinch.js';

export interface LongPressState {
  active: boolean;
  origin: { x: number; y: number; z: number } | null;
  elapsed: number;
  fired: boolean;
}

export function createLongPressState(): LongPressState {
  return { active: false, origin: null, elapsed: 0, fired: false };
}

export function updateLongPress(
  state: LongPressState,
  pinched: boolean,
  position: { x: number; y: number; z: number } | null,
  dt: number,
  holdSeconds: number,
  moveTolerance: number,
): boolean {
  if (!pinched || !position) {
    state.active = false;
    state.origin = null;
    state.elapsed = 0;
    state.fired = false;
    return false;
  }
  if (!state.active) {
    state.active = true;
    state.origin = { ...position };
    state.elapsed = 0;
    state.fired = false;
  }
  if (state.origin && distance3(position, state.origin) > moveTolerance) {
    state.origin = { ...position };
    state.elapsed = 0;
    state.fired = false;
    return false;
  }
  state.elapsed += dt;
  if (!state.fired && state.elapsed >= holdSeconds) {
    state.fired = true;
    return true;
  }
  return false;
}
