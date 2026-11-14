export type ConversionMode = 'manifest' | 'live';

export const CONVERSION_API_PLACEHOLDER = 'https://example.invalid';

const numericDefaults = {
  /** Tip-contact backup when select/gamepad misses a frame. Tips must nearly touch. */
  pinchOnDistance: 0.02,
  pinchOffDistance: 0.035,
  longPressSeconds: 0.3,
  longPressMoveTolerance: 0.18,
  /**
   * Empty-space scene load uses Meta palm/power grab (fist), not pinch.
   * Hold a clear fist this long in front of you — pinch / side hands never commit.
   */
  sceneFistHoldSeconds: 1.25,
  /** Ignore fists that wander more than this while holding. */
  sceneFistMoveTolerance: 0.06,
  /** Cooldown after a scene/demo load so one fist cannot spawn many eagles. */
  sceneFistCooldownSeconds: 5,
  /** Must fully open the hand this long before another fist can arm. */
  sceneFistOpenSeconds: 0.45,
  /** Fist must stay roughly this far in front of the headset (meters). */
  sceneFistMinDistance: 0.28,
  sceneFistMaxDistance: 0.75,
  pokeDepth: 0.015,
  pokeCooldownMs: 300,
  palmTouchDistance: 0.03,
  surfaceFallbackSeconds: 15,
  maxObjects: 3,
  hintIdleSeconds: 8,
  maxTriangles: 30000,
  /** Quest-style panel distance (meters in front of the head). */
  libraryDistance: 0.9,
  libraryWidth: 0.9,
  openBookWidth: 0.42,
  moviePrepSeconds: 20,
  objectMinScale: 0.35,
  objectMaxScale: 2.2,
  jellyRadius: 0.15,
  jellyDepth: 0.06,
  jellyStiffness: 90,
  jellyDamping: 8,
  objectBounces: 2,
  /** Floating cinema screen — large but not full-FOV. */
  videoScreenWidth: 1.7,
  videoScreenDistance: 1.55,
  momentLeadSeconds: 1,
  popOutSeconds: 1.2,
  maxMovieObjects: 2,
  objectDistanceMin: 0.4,
  objectDistanceMax: 0.7,
  objectBobAmplitude: 0.02,
  objectBobSeconds: 4,
  flySpeed: 0.5,
  walkSpeed: 0.35,
  walkRadius: 1.5,
  rainRadius: 1.2,
  rainDropCount: 500,
  perchSearchDistance: 1.5,
  reactionCooldownSeconds: 1,
  objectLifetimeSeconds: 30,
  masterVolume: 0.35,
  swipeDistance: 0.25,
  swipeSeconds: 0.5,
  bookHoldSeconds: 0.8,
  bookPalmMin: 0.12,
  bookPalmMax: 0.55,
  bookTableAboveFloor: 0.25,
  bookOpenMemorySeconds: 8,
  surfaceHoldDistance: 0.03,
  conversionTimeoutSeconds: 120,
  filmTimeoutSeconds: 600,
  pollIntervalSeconds: 1,
  objectGravity: 9.8,
  dropRestitution: 0.35,
  flickSpeed: 3.2,
  explorerTiltDegrees: 0,
  openPhotoTiltDegrees: 0,
  videoMinScale: 0.7,
  videoMaxScale: 1.6,
  chestOffset: 0.35,
  defaultFloorHandOffset: 0.1,
  ghostHintSeconds: 4,
  handlessDelaySeconds: 0.6,
  /** How far in front of the headset a new 3D object appears (meters). */
  spawnDistance: 1.15,
  /** Cap so a flower or car does not spawn life-size beside the player. */
  maxSpawnRealSize: 0.5,
  grabReachPad: 0.14,
} as const;

export type NumericConfig = { -readonly [K in keyof typeof numericDefaults]: number };

export interface AppConfig extends NumericConfig {
  CONVERSION_MODE: ConversionMode;
  CONVERSION_API_URL: string;
  explorerDistance: number;
  explorerWidth: number;
  openPhotoWidth: number;
}

export const DEFAULTS: Readonly<AppConfig> = Object.freeze({
  ...numericDefaults,
  CONVERSION_MODE: 'manifest',
  CONVERSION_API_URL: CONVERSION_API_PLACEHOLDER,
  explorerDistance: numericDefaults.libraryDistance,
  explorerWidth: numericDefaults.libraryWidth,
  openPhotoWidth: 0.42,
});

export const config: AppConfig = {
  ...DEFAULTS,
};

export function resetConfig(): void {
  Object.assign(config, DEFAULTS);
}

export function applyConfigPatch(patch: Partial<AppConfig>): void {
  Object.assign(config, patch);
  config.explorerDistance = config.libraryDistance;
  config.explorerWidth = config.libraryWidth;
  config.openPhotoWidth = config.openBookWidth;
}
