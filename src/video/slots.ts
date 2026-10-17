import type { SlotName } from '../assets/types.js';

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

export function slotPosition(
  slot: SlotName,
  head: { x: number; y: number; z: number },
  forward: { x: number; z: number },
  right: { x: number; z: number },
  distance: number,
): { x: number; y: number; z: number } {
  const side = slot.endsWith('right') ? 1 : -1;
  const low = slot.startsWith('low') ? -0.35 : -0.05;
  return {
    x: head.x + forward.x * distance + right.x * side * 0.35,
    y: head.y + low,
    z: head.z + forward.z * distance + right.z * side * 0.35,
  };
}
