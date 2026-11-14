import type { BehaviorName, ReactionName } from '../assets/types.js';

const LABEL_BEHAVIOR: Record<string, BehaviorName> = {
  bird: 'fly',
  flamingo: 'fly',
  butterfly: 'fly',
  dog: 'walk',
  fox: 'walk',
  horse: 'walk',
  tree: 'sway',
  flower: 'sway',
  grass: 'sway',
  bench: 'sway',
  leaf: 'drift',
  petal: 'drift',
  rain: 'rain',
  snow: 'snow',
  storm: 'rain',
};

const BEHAVIOR_REACTION: Record<BehaviorName, ReactionName> = {
  fly: 'dart',
  walk: 'pause',
  sway: 'wobble',
  drift: 'spin',
  hover: 'glow',
  rain: 'glow',
  snow: 'glow',
};

export function behaviorFromLabel(label: string, override?: BehaviorName): BehaviorName {
  if (override) return override;
  return LABEL_BEHAVIOR[label.toLowerCase()] ?? 'hover';
}

export function reactionFromBehavior(
  behavior: BehaviorName,
  override?: ReactionName,
): ReactionName {
  if (override) return override;
  return BEHAVIOR_REACTION[behavior];
}
