export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function pointInEllipsoid(
  point: Vec3,
  center: Vec3,
  radius: Vec3,
): boolean {
  const dx = (point.x - center.x) / Math.max(radius.x, 1e-6);
  const dy = (point.y - center.y) / Math.max(radius.y, 1e-6);
  const dz = (point.z - center.z) / Math.max(radius.z, 1e-6);
  return dx * dx + dy * dy + dz * dz <= 1;
}

export function isStroke(speed: number, maxSpeed: number): boolean {
  return speed < maxSpeed;
}

export interface SurfaceHoldState {
  active: boolean;
  origin: Vec3 | null;
  elapsed: number;
  fired: boolean;
}

export function createSurfaceHoldState(): SurfaceHoldState {
  return { active: false, origin: null, elapsed: 0, fired: false };
}

export function updateSurfaceHold(
  state: SurfaceHoldState,
  nearSurface: boolean,
  allowed: boolean,
  position: Vec3 | null,
  dt: number,
  holdSeconds: number,
  moveTolerance: number,
): boolean {
  if (!nearSurface || !allowed || !position) {
    state.active = false;
    state.origin = null;
    state.elapsed = 0;
    state.fired = false;
    return false;
  }
  if (!state.active) {
    state.active = true;
    state.origin = { ...position };
    state.elapsed = 0;
    state.fired = false;
  }
  if (state.origin) {
    const dx = position.x - state.origin.x;
    const dy = position.y - state.origin.y;
    const dz = position.z - state.origin.z;
    if (Math.hypot(dx, dy, dz) > moveTolerance) {
      state.origin = { ...position };
      state.elapsed = 0;
      state.fired = false;
      return false;
    }
  }
  state.elapsed += dt;
  if (!state.fired && state.elapsed >= holdSeconds) {
    state.fired = true;
    return true;
  }
  return false;
}
