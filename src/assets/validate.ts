import { config } from '../config.js';
import type {
  ExplorerEntry,
  Hotspot,
  ManifestFile,
  ManifestObject,
  NormalizedRect,
  TimelineFile,
  TimelineMoment,
  ValidationIssue,
} from './types.js';

export function isHotspot(value: unknown): value is Hotspot {
  if (!value || typeof value !== 'object') return false;
  const hotspot = value as Hotspot;
  if (hotspot.type === 'circle') {
    return [hotspot.x, hotspot.y, hotspot.r].every((n) => typeof n === 'number');
  }
  if (hotspot.type === 'polygon') {
    return Array.isArray(hotspot.points) && hotspot.points.length >= 3;
  }
  return false;
}

export function pointInHotspot(x: number, y: number, hotspot: Hotspot): boolean {
  if (hotspot.type === 'circle') {
    const dx = x - hotspot.x;
    const dy = y - hotspot.y;
    return dx * dx + dy * dy <= hotspot.r * hotspot.r;
  }
  let inside = false;
  const pts = hotspot.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-8) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function rectInUnit(rect: NormalizedRect): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x + rect.width <= 1.0001 &&
    rect.y + rect.height <= 1.0001
  );
}

const REQUIRED_FIELDS: Array<keyof ManifestObject> = ['id', 'scene', 'label', 'realSize'];

export function validateManifestObject(object: ManifestObject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (object[field] === undefined || object[field] === null || object[field] === '') {
      issues.push({ level: 'error', message: `Object ${object.id ?? '?'} is missing ${field}` });
    }
  }
  if (object.kind !== 'effect' && !object.model) {
    issues.push({
      level: 'error',
      message: `Object ${object.id} has no model path`,
    });
  }
  if (object.scene === 'furniture' && !object.hotspot) {
    issues.push({ level: 'warning', message: `Furniture ${object.id} has no hotspot` });
  }
  if (object.hotspot && !isHotspot(object.hotspot)) {
    issues.push({ level: 'error', message: `Object ${object.id} has an invalid hotspot` });
  }
  return issues;
}

export function parseManifest(data: unknown): { manifest: ManifestFile; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const objects = Array.isArray((data as ManifestFile)?.objects)
    ? (data as ManifestFile).objects
    : [];
  if (!Array.isArray((data as ManifestFile)?.objects)) {
    issues.push({ level: 'error', message: 'manifest.json must contain an objects array' });
  }
  const ids = new Set<string>();
  for (const object of objects) {
    issues.push(...validateManifestObject(object));
    if (ids.has(object.id)) {
      issues.push({ level: 'error', message: `Duplicate object id ${object.id}` });
    }
    ids.add(object.id);
  }
  return { manifest: { objects }, issues };
}

export function parseExplorer(data: unknown): { entries: ExplorerEntry[]; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const entries = Array.isArray(data) ? (data as ExplorerEntry[]) : [];
  if (!Array.isArray(data)) {
    issues.push({ level: 'error', message: 'explorer.json must be an array' });
  }
  for (const entry of entries) {
    if (entry.type !== 'photo' && entry.type !== 'video') {
      issues.push({ level: 'error', message: `Explorer entry ${entry.id} has invalid type` });
    }
  }
  return { entries, issues };
}

export function validateTimeline(
  timeline: TimelineFile,
  objects: ManifestObject[],
  durationSeconds?: number,
  modelExists: (path: string) => boolean = () => true,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map(objects.map((object) => [object.id, object]));
  let previousTime = -Infinity;
  for (const moment of timeline.moments) {
    issues.push(...validateMoment(moment, byId, durationSeconds, modelExists, previousTime));
    previousTime = moment.time;
  }
  return issues;
}

export function validateMoment(
  moment: TimelineMoment,
  byId: Map<string, ManifestObject>,
  durationSeconds: number | undefined,
  modelExists: (path: string) => boolean,
  previousTime: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const object = byId.get(moment.objectId);
  if (!object) {
    issues.push({ level: 'error', message: `Moment ${moment.id} references missing object ${moment.objectId}` });
  } else if (object.scene !== 'movie') {
    issues.push({ level: 'error', message: `Moment ${moment.id} object ${moment.objectId} is not a movie object` });
  } else if (object.kind !== 'effect' && object.model && !modelExists(object.model)) {
    issues.push({ level: 'error', message: `Moment ${moment.id} model file is missing: ${object.model}` });
  }
  if (typeof moment.time !== 'number' || moment.time < 0) {
    issues.push({ level: 'error', message: `Moment ${moment.id} has an invalid time` });
  }
  if (moment.time <= previousTime) {
    issues.push({ level: 'error', message: `Moment ${moment.id} time does not increase` });
  }
  if (durationSeconds !== undefined && moment.time > durationSeconds) {
    issues.push({ level: 'error', message: `Moment ${moment.id} is past the film duration` });
  }
  if (!rectInUnit(moment.rect)) {
    issues.push({ level: 'error', message: `Moment ${moment.id} rect is outside 0..1` });
  }
  if (previousTime !== -Infinity && moment.time - previousTime < 6) {
    issues.push({
      level: 'warning',
      message: `Moment ${moment.id} is less than 6 seconds after the previous moment`,
    });
  }
  return issues;
}

export function sizeDisagrees(measuredLongest: number, realSize: number): boolean {
  if (realSize <= 0) return true;
  return Math.abs(measuredLongest - realSize) / realSize > 0.1;
}

export function overTriangleBudget(triangles: number, budget = config.maxTriangles): boolean {
  return triangles > budget;
}
