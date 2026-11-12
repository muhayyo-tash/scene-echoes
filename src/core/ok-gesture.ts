import { distance3 } from './pinch.js';
import type { Vec3 } from './touch.js';

/**
 * Scene Echoes "pop unlock" gesture (one hand):
 * thumb + index tips touch in a ring (OK), while middle/ring/pinky stay extended.
 * Must be shown before any long-press pop-out is allowed.
 */
export interface OkGestureState {
  active: boolean;
  held: number;
  /** True after the user has completed the gesture; consumes on successful pop. */
  armed: boolean;
  armedFor: number;
}

export function createOkGestureState(): OkGestureState {
  return { active: false, held: 0, armed: false, armedFor: 0 };
}

export function isOkHandPose(joints: Partial<Record<string, Vec3>>): boolean {
  const thumb = joints['thumb-tip'];
  const index = joints['index-finger-tip'];
  const middle = joints['middle-finger-tip'];
  const ring = joints['ring-finger-tip'];
  const pinky = joints['pinky-finger-tip'];
  const wrist = joints.wrist;
  if (!thumb || !index || !middle || !wrist) return false;

  // Closed OK ring — thumb and index tips together.
  if (distance3(thumb, index) > 0.048) return false;

  // Other fingers extended (not a fist / not a flat pinch-only pose).
  if (distance3(middle, wrist) < 0.11) return false;
  if (ring && distance3(ring, wrist) < 0.1) return false;
  if (pinky && distance3(pinky, wrist) < 0.085) return false;

  // Prefer upright fingers: tips above the wrist (world +Y).
  if (middle.y < wrist.y + 0.02) return false;
  return true;
}

export function updateOkGesture(
  state: OkGestureState,
  joints: Partial<Record<string, Vec3>> | null,
  dt: number,
  armHoldSeconds = 0.35,
  armedMemorySeconds = 20,
): { justArmed: boolean } {
  let justArmed = false;
  if (state.armed) {
    state.armedFor += dt;
    if (state.armedFor > armedMemorySeconds) {
      state.armed = false;
      state.armedFor = 0;
    }
  }

  const posing = joints ? isOkHandPose(joints) : false;
  if (posing) {
    state.active = true;
    state.held += dt;
    if (!state.armed && state.held >= armHoldSeconds) {
      state.armed = true;
      state.armedFor = 0;
      justArmed = true;
    }
  } else {
    state.active = false;
    state.held = 0;
  }
  return { justArmed };
}

export function consumeOkArm(state: OkGestureState): boolean {
  if (!state.armed) return false;
  state.armed = false;
  state.armedFor = 0;
  state.held = 0;
  state.active = false;
  return true;
}
