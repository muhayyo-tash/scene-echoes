import type { Vec3 } from './touch.js';
import { nearestHorizontal, projectOntoSurface, type RoomSurface } from './surfaces.js';

export function farPlacePoint(
  head: Vec3,
  pinch: Vec3,
  surfaces: RoomSurface[],
): { point: Vec3; surface: RoomSurface | null } {
  const dir = {
    x: pinch.x - head.x,
    y: pinch.y - head.y,
    z: pinch.z - head.z,
  };
  const length = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const far = {
    x: head.x + (dir.x / length) * 2.2,
    y: pinch.y,
    z: head.z + (dir.z / length) * 2.2,
  };
  const surface = nearestHorizontal(surfaces, far);
  if (!surface) return { point: far, surface: null };
  const projected = projectOntoSurface(far, surface);
  return { point: projected, surface };
}

/** Place a new object a short step in front of the player, not at the hand. */
export function spawnInFront(
  head: Vec3,
  forward: { x: number; z: number },
  surfaces: RoomSurface[],
  distance: number,
  chestOffset: number,
): { point: Vec3; surface: RoomSurface | null } {
  const point = {
    x: head.x + forward.x * distance,
    y: head.y - chestOffset,
    z: head.z + forward.z * distance,
  };
  const surface = nearestHorizontal(surfaces, point);
  if (!surface) return { point, surface: null };
  return { point: projectOntoSurface(point, surface), surface };
}

export function uprightYawFromWrist(
  wristDeltaX: number,
  wristDeltaZ: number,
): number {
  return Math.atan2(wristDeltaX, wristDeltaZ);
}
