export interface JellySpring {
  displacement: number;
  velocity: number;
}

export function createJellySpring(): JellySpring {
  return { displacement: 0, velocity: 0 };
}

export function stepJellySpring(
  spring: JellySpring,
  target: number,
  dt: number,
  stiffness: number,
  damping: number,
): number {
  const accel = -stiffness * (spring.displacement - target) - damping * spring.velocity;
  spring.velocity += accel * dt;
  spring.displacement += spring.velocity * dt;
  return spring.displacement;
}

export interface ContactPoint {
  x: number;
  y: number;
  z: number;
  strength: number;
  time: number;
}

export function falloff(distance: number, radius: number): number {
  if (distance >= radius) return 0;
  const t = 1 - distance / radius;
  return t * t * (3 - 2 * t);
}

export interface VolumeSquash {
  y: number;
  xz: number;
}

export function volumePreservingSquash(squashY: number): VolumeSquash {
  const y = Math.max(0.55, squashY);
  const xz = Math.sqrt(1 / y);
  return { y, xz };
}
