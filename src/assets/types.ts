export type SceneKind = 'furniture' | 'book' | 'movie';
export type ObjectKind = 'object' | 'effect';
export type UpAxis = 'y' | 'z';
export type Landing = 'float' | 'perch';
export type BehaviorName = 'fly' | 'walk' | 'sway' | 'drift' | 'hover' | 'rain';
export type ReactionName = 'wobble' | 'hop' | 'spin' | 'glow' | 'dart' | 'pause';
export type ExplorerType = 'photo' | 'video';
export type SlotName = 'left' | 'right' | 'low-left' | 'low-right';

export interface CircleHotspot {
  type: 'circle';
  x: number;
  y: number;
  r: number;
}

export interface PolygonHotspot {
  type: 'polygon';
  points: Array<{ x: number; y: number }>;
}

export type Hotspot = CircleHotspot | PolygonHotspot;

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ManifestObject {
  id: string;
  scene: SceneKind;
  photo?: string;
  mask?: string;
  model?: string;
  kind?: ObjectKind;
  label: string;
  realSize: number;
  up?: UpAxis;
  baseOffset?: number;
  hotspot?: Hotspot;
  behavior?: BehaviorName;
  reaction?: ReactionName;
  landing?: Landing;
  floatScale?: number;
}

export interface ManifestFile {
  objects: ManifestObject[];
}

export interface ExplorerEntry {
  type: ExplorerType;
  id: string;
}

export interface TimelineMoment {
  id: string;
  time: number;
  objectId: string;
  rect: NormalizedRect;
  side?: SlotName;
  lifetime?: number;
}

export interface TimelineFile {
  moments: TimelineMoment[];
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
}
