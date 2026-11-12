import { config } from '../config.js';
import { createLongPressState, updateLongPress, type LongPressState } from './long-press.js';
import { createPokeState, updatePoke, type PokeState } from './poke.js';
import { distance3, pinchMidpoint, updatePinch, type PinchState } from './pinch.js';
import { createSlideState, updateSlide, type SlideDirection, type SlideState } from './slide.js';
import { createSurfaceHoldState, updateSurfaceHold, type SurfaceHoldState, type Vec3 } from './touch.js';

export interface HandSample {
  handedness: 'left' | 'right';
  tracked: boolean;
  joints: Partial<Record<string, Vec3>>;
  indexTip: Vec3 | null;
  thumbTip: Vec3 | null;
  palm: Vec3 | null;
  palmNormal: Vec3 | null;
  wrist: Vec3 | null;
  rayOrigin: Vec3 | null;
  rayDirection: Vec3 | null;
  /**
   * Meta Quest WebXR exposes regular pinch as emulated Gamepad button 0
   * (see developers.meta.com WebXR Hands). Prefer this over tip distance.
   */
  selectPressed: boolean | null;
  /** Analog pinch strength 0–1 when the runtime reports gamepad.value. */
  selectValue: number | null;
}

export interface HandRuntime {
  handedness: 'left' | 'right';
  tracked: boolean;
  pinch: PinchState;
  pinched: boolean;
  pinchPosition: Vec3 | null;
  indexTip: Vec3 | null;
  thumbTip: Vec3 | null;
  palm: Vec3 | null;
  palmNormal: Vec3 | null;
  wrist: Vec3 | null;
  rayOrigin: Vec3 | null;
  rayDirection: Vec3 | null;
  /** Latest joint map for custom gestures (OK unlock, etc.). */
  joints: Partial<Record<string, Vec3>>;
  justPinched: boolean;
  velocity: Vec3;
  open: boolean;
  longPress: LongPressState;
  poke: PokeState;
  slide: SlideState;
  surfaceHold: SurfaceHoldState;
  lost: boolean;
}

export interface HandsFrame {
  left: HandRuntime;
  right: HandRuntime;
  anyPinch: boolean;
  slide: SlideDirection;
}

function emptyHand(handedness: 'left' | 'right'): HandRuntime {
  return {
    handedness,
    tracked: false,
    pinch: { pinched: false },
    pinched: false,
    pinchPosition: null,
    indexTip: null,
    thumbTip: null,
    palm: null,
    palmNormal: null,
    wrist: null,
    rayOrigin: null,
    rayDirection: null,
    joints: {},
    justPinched: false,
    velocity: { x: 0, y: 0, z: 0 },
    open: false,
    longPress: createLongPressState(),
    poke: createPokeState(),
    slide: createSlideState(),
    surfaceHold: createSurfaceHoldState(),
    lost: false,
  };
}

export function createHands(): HandsFrame {
  return {
    left: emptyHand('left'),
    right: emptyHand('right'),
    anyPinch: false,
    slide: null,
  };
}

export function updateHandRuntime(
  hand: HandRuntime,
  sample: HandSample | null,
  dt: number,
  chestY: number,
  touchingObject: boolean,
  explorerClosed: boolean,
  filmPlaying: boolean,
  nearSurface: boolean,
): SlideDirection {
  if (!sample || !sample.tracked) {
    const wasTracked = hand.tracked;
    hand.tracked = false;
    hand.lost = wasTracked;
    hand.pinched = false;
    hand.pinch.pinched = false;
    hand.pinchPosition = null;
    hand.rayOrigin = null;
    hand.rayDirection = null;
    hand.joints = {};
    hand.justPinched = false;
    return null;
  }
  hand.lost = false;
  hand.tracked = true;
  const prev = hand.wrist;
  hand.indexTip = sample.indexTip;
  hand.thumbTip = sample.thumbTip;
  hand.palm = sample.palm;
  hand.palmNormal = sample.palmNormal;
  hand.wrist = sample.wrist;
  hand.rayOrigin = sample.rayOrigin;
  hand.rayDirection = sample.rayDirection;
  hand.joints = sample.joints;
  if (prev && sample.wrist && dt > 0) {
    const alpha = 0.35;
    const vx = (sample.wrist.x - prev.x) / dt;
    const vy = (sample.wrist.y - prev.y) / dt;
    const vz = (sample.wrist.z - prev.z) / dt;
    hand.velocity = {
      x: hand.velocity.x * (1 - alpha) + vx * alpha,
      y: hand.velocity.y * (1 - alpha) + vy * alpha,
      z: hand.velocity.z * (1 - alpha) + vz * alpha,
    };
  }
  const dist =
    sample.thumbTip && sample.indexTip ? distance3(sample.thumbTip, sample.indexTip) : 1;
  const wasPinched = hand.pinched;
  // Meta: selectstart / gamepad button 0. Also keep tight tip-contact so Finder
  // still opens if a frame misses the gamepad poll (tips must nearly touch).
  const tipPinched = updatePinch(
    hand.pinch,
    dist,
    config.pinchOnDistance,
    config.pinchOffDistance,
  );
  hand.pinched = Boolean(sample.selectPressed) || tipPinched;
  hand.pinch.pinched = hand.pinched;
  hand.justPinched = hand.pinched && !wasPinched;
  hand.pinchPosition =
    hand.pinched && sample.thumbTip && sample.indexTip
      ? pinchMidpoint(sample.thumbTip, sample.indexTip)
      : null;
  hand.open = !hand.pinched && dist > config.pinchOffDistance;
  if (hand.pinchPosition) {
    updateLongPress(
      hand.longPress,
      hand.pinched,
      hand.pinchPosition,
      dt,
      config.longPressSeconds,
      config.longPressMoveTolerance,
    );
  } else {
    updateLongPress(hand.longPress, false, null, dt, config.longPressSeconds, config.longPressMoveTolerance);
  }
  const allowedHold = explorerClosed && !filmPlaying && !touchingObject;
  updateSurfaceHold(
    hand.surfaceHold,
    nearSurface,
    allowedHold,
    sample.indexTip,
    dt,
    config.bookHoldSeconds,
    config.longPressMoveTolerance,
  );
  const atChest = sample.palm ? Math.abs(sample.palm.y - chestY) < 0.22 : false;
  return updateSlide(
    hand.slide,
    hand.open,
    atChest,
    touchingObject,
    sample.palm?.x ?? 0,
    dt,
    config.swipeDistance,
    config.swipeSeconds,
  );
}

export function pokeSurface(
  hand: HandRuntime,
  distance: number | null,
  dt: number,
): boolean {
  return updatePoke(hand.poke, distance, config.pokeDepth, dt, config.pokeCooldownMs);
}

export function sampleFromJoints(
  handedness: 'left' | 'right',
  joints: Partial<Record<string, Vec3>>,
): HandSample {
  const indexTip = joints['index-finger-tip'] ?? null;
  const thumbTip = joints['thumb-tip'] ?? null;
  const wrist = joints.wrist ?? null;
  const palm = joints['middle-finger-phalanx-proximal'] ?? wrist;
  let palmNormal: Vec3 | null = null;
  const ring = joints['ring-finger-phalanx-proximal'];
  const index = joints['index-finger-phalanx-proximal'];
  if (wrist && index && ring) {
    const ax = index.x - wrist.x;
    const ay = index.y - wrist.y;
    const az = index.z - wrist.z;
    const bx = ring.x - wrist.x;
    const by = ring.y - wrist.y;
    const bz = ring.z - wrist.z;
    palmNormal = {
      x: ay * bz - az * by,
      y: az * bx - ax * bz,
      z: ax * by - ay * bx,
    };
  }
  return {
    handedness,
    tracked: Boolean(indexTip || wrist),
    joints,
    indexTip,
    thumbTip,
    palm,
    palmNormal,
    wrist,
    rayOrigin: null,
    rayDirection: null,
    selectPressed: null,
    selectValue: null,
  };
}

export function handSpeed(hand: HandRuntime): number {
  return Math.hypot(hand.velocity.x, hand.velocity.y, hand.velocity.z);
}
