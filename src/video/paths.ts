export function flyPoint(
  time: number,
  center: { x: number; y: number; z: number },
  radius: number,
  speed: number,
  height = 0.15,
): { x: number; y: number; z: number; yaw: number } {
  const angle = time * speed;
  const x = center.x + Math.cos(angle) * radius;
  const z = center.z + Math.sin(angle) * radius;
  const y = center.y + height + Math.sin(angle * 2) * 0.04;
  return { x, y, z, yaw: angle + Math.PI / 2 };
}

export function walkPoint(
  time: number,
  center: { x: number; y: number; z: number },
  radius: number,
  speed: number,
  floorY: number,
): { x: number; y: number; z: number; yaw: number; sniff: number } {
  const loop = radius * 2 * Math.PI;
  const distance = (time * speed) % loop;
  const angle = distance / radius;
  const sniffWave = (Math.sin(time * 0.35) + 1) / 2;
  const sniff = sniffWave > 0.85 ? (sniffWave - 0.85) / 0.15 : 0;
  return {
    x: center.x + Math.cos(angle) * radius,
    y: floorY,
    z: center.z + Math.sin(angle) * radius,
    yaw: angle + Math.PI / 2,
    sniff,
  };
}

export function bobOffset(time: number, amplitude: number, period: number): number {
  return Math.sin((time * Math.PI * 2) / Math.max(period, 0.01)) * amplitude;
}

export function perchTarget(
  surfaces: Array<{ y: number; x: number; z: number; horizontal: boolean }>,
  from: { x: number; y: number; z: number },
  maxDistance: number,
): { x: number; y: number; z: number } | null {
  let best: { x: number; y: number; z: number; d: number } | null = null;
  for (const surface of surfaces) {
    if (!surface.horizontal) continue;
    const d = Math.hypot(surface.x - from.x, surface.z - from.z);
    if (d > maxDistance) continue;
    if (!best || d < best.d) best = { x: surface.x, y: surface.y, z: surface.z, d };
  }
  return best ? { x: best.x, y: best.y, z: best.z } : null;
}

export function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}
