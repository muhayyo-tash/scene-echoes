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

export function uprightYawFromWrist(
  wristDeltaX: number,
  wristDeltaZ: number,
): number {
  return Math.atan2(wristDeltaX, wristDeltaZ);
}
