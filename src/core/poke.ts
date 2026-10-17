export interface PokeState {
  cooldown: number;
  poked: boolean;
}

export function createPokeState(): PokeState {
  return { cooldown: 0, poked: false };
}

export function updatePoke(
  state: PokeState,
  fingertipDistance: number | null,
  depth: number,
  dt: number,
  cooldownMs: number,
): boolean {
  if (state.cooldown > 0) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.poked = fingertipDistance !== null && fingertipDistance <= depth;
    return false;
  }
  const inside = fingertipDistance !== null && fingertipDistance <= depth;
  const fired = inside && !state.poked;
  state.poked = inside;
  if (fired) {
    state.cooldown = cooldownMs / 1000;
  }
  return fired;
}
