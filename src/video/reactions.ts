import type { ReactionName } from '../assets/types.js';

export interface ReactionState {
  name: ReactionName | null;
  elapsed: number;
  cooldown: number;
}

export function createReactionState(): ReactionState {
  return { name: null, elapsed: 0, cooldown: 0 };
}

export function tryStartReaction(
  state: ReactionState,
  name: ReactionName,
  cooldownSeconds: number,
): boolean {
  if (state.cooldown > 0 || state.name) return false;
  state.name = name;
  state.elapsed = 0;
  state.cooldown = cooldownSeconds;
  return true;
}

export function updateReaction(state: ReactionState, dt: number): ReactionState {
  if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);
  if (!state.name) return state;
  state.elapsed += dt;
  const duration = durationFor(state.name);
  if (state.elapsed >= duration) {
    state.name = null;
    state.elapsed = 0;
  }
  return state;
}

export function durationFor(name: ReactionName): number {
  switch (name) {
    case 'wobble':
      return 0.8;
    case 'hop':
      return 0.45;
    case 'spin':
      return 1;
    case 'glow':
      return 0.7;
    case 'dart':
      return 4;
    case 'pause':
      return 2.5;
    default:
      return 1;
  }
}
