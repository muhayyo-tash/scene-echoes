export interface PinchState {
  pinched: boolean;
}

export function updatePinch(
  state: PinchState,
  thumbToIndexDistance: number,
  onDistance: number,
  offDistance: number,
): boolean {
  if (!state.pinched && thumbToIndexDistance <= onDistance) {
    state.pinched = true;
  } else if (state.pinched && thumbToIndexDistance >= offDistance) {
    state.pinched = false;
  }
  return state.pinched;
}

export function pinchMidpoint(
  thumb: { x: number; y: number; z: number },
  index: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  return {
    x: (thumb.x + index.x) / 2,
    y: (thumb.y + index.y) / 2,
    z: (thumb.z + index.z) / 2,
  };
}

export function distance3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}
