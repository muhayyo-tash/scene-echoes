import { config } from '../config.js';
import type { Vec3 } from './touch.js';

export interface RoomSurface {
  id: string;
  origin: Vec3;
  normal: Vec3;
  horizontal: boolean;
  source: 'plane' | 'palm' | 'default';
}

export interface SurfaceFinderState {
  surfaces: RoomSurface[];
  waitingSeconds: number;
  usedDefault: boolean;
  ghostShown: boolean;
}

export function createSurfaceFinder(): SurfaceFinderState {
  return { surfaces: [], waitingSeconds: 0, usedDefault: false, ghostShown: false };
}

export function isHorizontal(normal: Vec3, epsilon = 0.55): boolean {
  return normal.y > epsilon;
}

export function upsertSurface(state: SurfaceFinderState, surface: RoomSurface): void {
  const index = state.surfaces.findIndex((item) => item.id === surface.id);
  if (index >= 0) state.surfaces[index] = surface;
  else state.surfaces.push(surface);
}

export function nearestHorizontal(
  surfaces: RoomSurface[],
  point: Vec3,
  maxDistance = 2.5,
): RoomSurface | null {
  let best: RoomSurface | null = null;
  let bestD = maxDistance;
  for (const surface of surfaces) {
    if (!surface.horizontal) continue;
    const d = Math.hypot(surface.origin.x - point.x, surface.origin.z - point.z);
    const vertical = Math.abs(point.y - surface.origin.y);
    if (d < bestD && vertical < 1.6) {
      best = surface;
      bestD = d;
    }
  }
  return best;
}

export function projectOntoSurface(point: Vec3, surface: RoomSurface): Vec3 {
  const dx = point.x - surface.origin.x;
  const dy = point.y - surface.origin.y;
  const dz = point.z - surface.origin.z;
  const dist = dx * surface.normal.x + dy * surface.normal.y + dz * surface.normal.z;
  return {
    x: point.x - surface.normal.x * dist,
    y: point.y - surface.normal.y * dist,
    z: point.z - surface.normal.z * dist,
  };
}

export function fingertipNearSurface(
  tip: Vec3 | null,
  surfaces: RoomSurface[],
  distance = config.surfaceHoldDistance,
): { surface: RoomSurface; point: Vec3 } | null {
  if (!tip) return null;
  for (const surface of surfaces) {
    if (!surface.horizontal) continue;
    const projected = projectOntoSurface(tip, surface);
    const d = Math.hypot(tip.x - projected.x, tip.y - projected.y, tip.z - projected.z);
    if (d <= distance) return { surface, point: projected };
  }
  return null;
}

export function palmCalibrate(
  palm: Vec3,
  normal: Vec3 | null,
): RoomSurface {
  const n = normal && isHorizontal(normal) ? normal : { x: 0, y: 1, z: 0 };
  return {
    id: `palm-${Date.now()}`,
    origin: { ...palm },
    normal: n,
    horizontal: true,
    source: 'palm',
  };
}

export function maybeDefaultFloor(
  state: SurfaceFinderState,
  dt: number,
  lowestHandY: number | null,
  skipWait: boolean,
): RoomSurface | null {
  if (state.surfaces.some((surface) => surface.horizontal)) {
    state.waitingSeconds = 0;
    return null;
  }
  state.waitingSeconds += dt;
  if (!skipWait && state.waitingSeconds < config.surfaceFallbackSeconds) return null;
  if (state.usedDefault) return state.surfaces.find((s) => s.source === 'default') ?? null;
  const y = (lowestHandY ?? 0) - config.defaultFloorHandOffset;
  const floor: RoomSurface = {
    id: 'default-floor',
    origin: { x: 0, y, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    horizontal: true,
    source: 'default',
  };
  state.usedDefault = true;
  upsertSurface(state, floor);
  return floor;
}
