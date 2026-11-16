import type { SlotName } from '../assets/types.js';
import { config } from '../config.js';

/** Kept for timeline side labels; placement always uses the user's left. */
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
 * World-fixed pose on the user's left, between the head and the screen.
 * Same reach for every prop — no per-object rules, timeline `side` ignored for axis.
 */
export function slotPosition(
  _slot: SlotName,
  _screen: { x: number; y: number; z: number },
  forward: { x: number; z: number },
  right: { x: number; z: number },
  _distance?: number,
  head?: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const origin = head ?? {
    x: _screen.x - forward.x * config.videoScreenDistance,
    y: _screen.y,
    z: _screen.z - forward.z * config.videoScreenDistance,
  };
  const reach = config.moviePropReach;
  const left = config.moviePropLeft;
  return {
    x: origin.x + forward.x * reach - right.x * left,
    y: origin.y - 0.05,
    z: origin.z + forward.z * reach - right.z * left,
  };
}

/** Pop-out start: a bit farther toward the screen than home, still clearly in front. */
export function slotAppearFrom(
  slot: SlotName,
  screen: { x: number; y: number; z: number },
  forward: { x: number; z: number },
  right: { x: number; z: number },
  head?: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const home = slotPosition(slot, screen, forward, right, undefined, head);
  const towardScreen = Math.min(0.22, config.moviePropReach * 0.25);
  return {
    x: home.x + forward.x * towardScreen,
    y: home.y,
    z: home.z + forward.z * towardScreen,
  };
}
