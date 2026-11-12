import { distance3 } from './pinch.js';
import type { Vec3 } from './touch.js';

/**
 * Scene Echoes pop unlock:
 * 1) Hold OK (thumb+index ring, other fingers up) → armed
 * 2) Release the OK pose → ready
 * 3) A later pinch commits the pop
 *
 * Without the release step, the OK pose itself is a pinch and falsely starts loading.
 */
export interface OkGestureState {
  active: boolean;
  held: number;
  armed: boolean;
  armedFor: number;
  /** True after OK was released; pinch may commit only while ready. */
  ready: boolean;
  readyFor: number;
}

export function createOkGestureState(): OkGestureState {
  return { active: false, held: 0, armed: false, armedFor: 0, ready: false, readyFor: 0 };
}

export function isOkHandPose(joints: Partial<Record<string, Vec3>>): boolean {
  const thumb = joints['thumb-tip'];
  const index = joints['index-finger-tip'];
  const middle = joints['middle-finger-tip'];
  const ring = joints['ring-finger-tip'];
  const pinky = joints['pinky-finger-tip'];
  const wrist = joints.wrist;
  if (!thumb || !index || !middle || !wrist) return false;

  if (distance3(thumb, index) > 0.048) return false;
  if (distance3(middle, wrist) < 0.11) return false;
  if (ring && distance3(ring, wrist) < 0.1) return false;
  if (pinky && distance3(pinky, wrist) < 0.085) return false;
  if (middle.y < wrist.y + 0.02) return false;
  return true;
}

export function updateOkGesture(
  state: OkGestureState,
  joints: Partial<Record<string, Vec3>> | null,
  dt: number,
  armHoldSeconds = 0.35,
  armedMemorySeconds = 20,
): { justArmed: boolean; justReady: boolean } {
  let justArmed = false;
  let justReady = false;
  const posing = joints ? isOkHandPose(joints) : false;

  if (state.armed) {
    state.armedFor += dt;
    if (state.armedFor > armedMemorySeconds) {
      state.armed = false;
      state.armedFor = 0;
      state.ready = false;
      state.readyFor = 0;
    }
  }
  if (state.ready) state.readyFor += dt;

  if (posing) {
    state.active = true;
    state.held += dt;
    // Holding OK again clears ready until they release once more.
    if (state.ready) {
      state.ready = false;
      state.readyFor = 0;
    }
    if (!state.armed && state.held >= armHoldSeconds) {
      state.armed = true;
      state.armedFor = 0;
      justArmed = true;
    }
  } else {
    state.active = false;
    state.held = 0;
    if (state.armed && !state.ready) {
      state.ready = true;
      state.readyFor = 0;
      justReady = true;
    }
  }
  return { justArmed, justReady };
}

export function canCommitOkPop(state: OkGestureState): boolean {
  return state.armed && state.ready && state.readyFor >= 0.12;
}

export function consumeOkArm(state: OkGestureState): boolean {
  if (!state.armed) return false;
  state.armed = false;
  state.armedFor = 0;
  state.ready = false;
  state.readyFor = 0;
  state.held = 0;
  state.active = false;
  return true;
}
