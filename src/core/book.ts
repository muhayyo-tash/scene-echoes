import type { Vec3 } from './touch.js';
import type { RoomSurface } from './surfaces.js';

export interface BookDetector {
  open: boolean;
  memory: number;
}

export function createBookDetector(): BookDetector {
  return { open: false, memory: 0 };
}

export function palmSpan(left: Vec3, right: Vec3): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

export function isBookOpenPose(
  leftPalm: Vec3 | null,
  rightPalm: Vec3 | null,
  tableY: number | null,
  chestY: number,
  minSpan = 0.12,
  maxSpan = 0.55,
): boolean {
  if (!leftPalm || !rightPalm) return false;
  const span = palmSpan(leftPalm, rightPalm);
  if (span < minSpan || span > maxSpan) return false;
  if (Math.abs(leftPalm.y - rightPalm.y) > 0.08) return false;
  const palmY = (leftPalm.y + rightPalm.y) / 2;
  if (palmY > chestY - 0.05) return false;
  if (tableY !== null && Math.abs(palmY - tableY) > 0.18) return false;
  return true;
}

export function floorHeight(surfaces: RoomSurface[]): number {
  const horizontals = surfaces.filter((surface) => surface.horizontal);
  if (!horizontals.length) return 0;
  return Math.min(...horizontals.map((surface) => surface.origin.y));
}

export function tableHeight(surfaces: RoomSurface[], minAboveFloor = 0.25): number | null {
  const floor = floorHeight(surfaces);
  const tables = surfaces.filter(
    (surface) => surface.horizontal && surface.origin.y >= floor + minAboveFloor,
  );
  if (!tables.length) return null;
  return tables.reduce((best, surface) => (surface.origin.y < best ? surface.origin.y : best), tables[0].origin.y);
}

export function isElevatedSurface(
  surface: RoomSurface,
  floorY: number,
  minAbove = 0.25,
): boolean {
  return surface.horizontal && surface.origin.y >= floorY + minAbove;
}

export function updateBookDetector(
  state: BookDetector,
  poseOpen: boolean,
  dt: number,
  memorySeconds: number,
): boolean {
  if (poseOpen) {
    state.open = true;
    state.memory = memorySeconds;
    return true;
  }
  state.memory = Math.max(0, state.memory - dt);
  if (state.memory <= 0) state.open = false;
  return state.open;
}
