/**
 * Meta-style palm / power grab (fist) detection.
 *
 * Meta’s hands design separates:
 * - pinch (thumb + index) → UI select / small grabs
 * - palm grab (fingers curled into the palm) → heavier actions
 *
 * Empty-space scene load uses this so casual pinches cannot spawn models.
 * See https://developers.meta.com/horizon/design/hands-interaction-types/
 */

export interface PalmGrabJoints {
  palm: { x: number; y: number; z: number } | null;
  tips: Array<{ x: number; y: number; z: number } | null>;
}

function dist(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * True when enough fingertips are clearly curled into the palm.
 * Defaults allow a solid Quest fist without needing a perfect 4-tip curl.
 */
export function isPalmGrab(
  joints: PalmGrabJoints,
  curlMeters = 0.055,
  minTips = 3,
): boolean {
  const palm = joints.palm;
  if (!palm) return false;
  let curled = 0;
  let seen = 0;
  for (const tip of joints.tips) {
    if (!tip) continue;
    seen += 1;
    if (dist(tip, palm) <= curlMeters) curled += 1;
  }
  // Need enough tracked tips; 3 curled of 4 is a usable Quest fist.
  return seen >= minTips && curled >= minTips;
}
