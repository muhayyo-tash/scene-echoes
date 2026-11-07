import type { World } from '@iwsdk/core';
import type { HandSample } from '../core/hands.js';
import { sampleFromJoints } from '../core/hands.js';
import { rayFromOrientation } from '../core/pointer-ray.js';
import type { Vec3 } from '../core/touch.js';

const JOINTS = [
  'wrist',
  'thumb-tip',
  'index-finger-tip',
  'index-finger-phalanx-proximal',
  'middle-finger-phalanx-proximal',
  'ring-finger-phalanx-proximal',
] as const;

export function samplesFromFrame(
  world: World,
  frame: XRFrame | null,
): { left: HandSample | null; right: HandSample | null } {
  const session = world.xrSession;
  if (!session || !frame || !world.xrReferenceSpace) {
    return { left: null, right: null };
  }
  let left: HandSample | null = null;
  let right: HandSample | null = null;
  for (const source of session.inputSources) {
    const handedness = source.handedness === 'left' ? 'left' : source.handedness === 'right' ? 'right' : null;
    if (!handedness) continue;
    const joints: Partial<Record<string, Vec3>> = {};
    const hand = source.hand as unknown as Map<string, XRSpace> | undefined;
    if (hand) {
      for (const name of JOINTS) {
        const space = getJointSpace(hand, name);
        if (!space) continue;
        const pose = frame.getPose(space, world.xrReferenceSpace);
        if (!pose) continue;
        joints[name] = {
          x: pose.transform.position.x,
          y: pose.transform.position.y,
          z: pose.transform.position.z,
        };
      }
    }
    const sample = sampleFromJoints(handedness, joints);
    const rayPose = frame.getPose(source.targetRaySpace, world.xrReferenceSpace);
    if (rayPose) {
      const ray = rayFromOrientation(rayPose.transform.position, rayPose.transform.orientation);
      sample.rayOrigin = ray.origin;
      sample.rayDirection = ray.direction;
    }
    if (handedness === 'left') left = sample;
    else right = sample;
  }
  return { left, right };
}

function getJointSpace(hand: Map<string, XRSpace> | XRHand, name: string): XRSpace | undefined {
  if (typeof (hand as XRHand).get === 'function') {
    return (hand as XRHand).get(name as never);
  }
  return (hand as Map<string, XRSpace>).get(name);
}
