import type { SlotName } from '../assets/types.js';
import { config } from '../config.js';

/** Prefer left/right so props flank the player; low variants sit slightly lower. */
export const ALL_SLOTS: SlotName[] = ['left', 'right', 'low-left', 'low-right'];

export function assignSlot(
  preferred: SlotName | undefined,
  occupied: Iterable<SlotName>,
): SlotName | null {
  const used = new Set(occupied);
  if (preferred && !used.has(preferred)) return preferred;
  for (const slot of ALL_SLOTS) {
    if (!used.has(slot)) return slot;
  }
  return null;
}

/**
 * World pose beside the video player: clear of the bezel, a bit closer to the user
 * than the screen itself.
 */
export function slotPosition(
  slot: SlotName,
  screen: { x: number; y: number; z: number },
  forward: { x: number; z: number },
  right: { x: number; z: number },
  _distance?: number,
): { x: number; y: number; z: number } {
  const side = slot.endsWith('right') ? 1 : -1;
  // Same reach distance for every prop; only a small height difference for low slots.
  const low = slot.startsWith('low') ? -0.18 : 0.02;
  // Keep props beside the plate but still in the touchable band in front of it.
  const lateral = config.videoScreenWidth * 0.42 + config.moviePropSideGap;
  const closer = config.moviePropCloser;
  return {
    // Toward the user from the screen, then slightly left/right — never behind the plate.
    x: screen.x - forward.x * closer + right.x * side * lateral,
    y: screen.y + low,
    z: screen.z - forward.z * closer + right.z * side * lateral,
  };
}

/** Start of the pop-out: near the matching screen edge, already slightly in front. */
export function slotAppearFrom(
  slot: SlotName,
  screen: { x: number; y: number; z: number },
  forward: { x: number; z: number },
  right: { x: number; z: number },
): { x: number; y: number; z: number } {
  const side = slot.endsWith('right') ? 1 : -1;
  const low = slot.startsWith('low') ? -0.2 : 0;
  const edge = config.videoScreenWidth * 0.38;
  // Keep the start pose on the user side of the plate so it never pops in behind.
  const inFront = Math.min(0.2, config.moviePropCloser * 0.35);
  return {
    x: screen.x - forward.x * inFront + right.x * side * edge,
    y: screen.y + low,
    z: screen.z - forward.z * inFront + right.z * side * edge,
  };
}
