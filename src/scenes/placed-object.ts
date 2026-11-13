import {
  Box3,
  Group,
  Mesh,
  Vector3,
  Vector4,
  type Material,
} from 'three';
import type { ManifestObject } from '../assets/types.js';
import { config } from '../config.js';
import {
  createJellySpring,
  stepJellySpring,
  volumePreservingSquash,
  type ContactPoint,
  type JellySpring,
} from '../core/jelly.js';
import { createContactShadow, updateContactShadow } from '../core/shadows.js';
import type { RoomSurface } from '../core/surfaces.js';
import { nearestHorizontal, projectOntoSurface } from '../core/surfaces.js';

export interface LocalJelly {
  contactVecs: Vector4[];
  uRadius: { value: number };
  uDepth: { value: number };
}

export interface PlacedObject {
  id: string;
  object: ManifestObject;
  root: Group;
  visual: Group;
  shadow: Mesh;
  scale: number;
  contacts: ContactPoint[];
  spring: JellySpring;
  squash: JellySpring;
  jelly: LocalJelly;
  falling: boolean;
  velocityY: number;
  bounces: number;
}

function attachLocalJelly(_model: Group): LocalJelly {
  // Do NOT inject onBeforeCompile jelly (inverse(modelMatrix)) — it breaks under
  // WebXR multiview on Quest: meshes vanish in immersive AR and only reappear when
  // the session blurs (browser "Resume" view). Keep spring state for squash only.
  const contactVecs = [0, 1, 2, 3, 4, 5].map(() => new Vector4());
  return {
    contactVecs,
    uRadius: { value: config.jellyRadius },
    uDepth: { value: 0 },
  };
}

/** Make GLB meshes reliably drawable in immersive AR passthrough. */
export function prepareModelForAr(model: Group): void {
  model.visible = true;
  model.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.visible = true;
    // XR camera frustum culling is often wrong for freshly placed content.
    mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const mat of mats) {
      if (!mat) continue;
      mat.transparent = false;
      mat.depthTest = true;
      mat.depthWrite = true;
      mat.needsUpdate = true;
      const std = mat as Material & {
        emissive?: { setRGB: (r: number, g: number, b: number) => void };
        metalness?: number;
        roughness?: number;
        envMapIntensity?: number;
      };
      // Slight lift so PBR sofas read against bright passthrough.
      std.emissive?.setRGB(0.08, 0.08, 0.08);
      if (typeof std.metalness === 'number') std.metalness = Math.min(std.metalness, 0.35);
      if (typeof std.roughness === 'number') std.roughness = Math.max(std.roughness, 0.45);
      if (typeof std.envMapIntensity === 'number') std.envMapIntensity = Math.max(std.envMapIntensity, 1);
    }
  });
}

function applyLocalJelly(item: PlacedObject): void {
  // Uniforms retained for API compatibility; vertex jelly shader is disabled on Quest.
  const amount = Math.max(0, Math.min(1, (1 - item.squash.displacement) / 0.32));
  item.jelly.uDepth.value = amount * Math.max(config.jellyDepth, item.object.realSize * 0.055);
  item.jelly.uRadius.value = Math.max(config.jellyRadius, item.object.realSize * 0.16);
}

export function makePlacedObject(object: ManifestObject, model: Group): PlacedObject {
  prepareModelForAr(model);
  const shadow = createContactShadow(object.realSize * 0.35);
  const jelly = attachLocalJelly(model);
  const root = new Group();
  root.name = `placed-${object.id}`;
  root.visible = true;
  root.frustumCulled = false;
  root.add(model, shadow);
  return {
    id: object.id,
    object,
    root,
    visual: model,
    shadow,
    scale: 1,
    contacts: [],
    spring: createJellySpring(),
    squash: { displacement: 1, velocity: 0 },
    jelly,
    falling: false,
    velocityY: 0,
    bounces: 0,
  };
}

export function setObjectContacts(item: PlacedObject, points: ContactPoint[]): void {
  item.contacts = points.slice(0, 6);
}

const contactBox = new Box3();
const contactSize = new Vector3();
const contactPoint = new Vector3();

export function isOnSeatTop(item: PlacedObject, point: { x: number; y: number; z: number }): boolean {
  contactBox.setFromObject(item.visual);
  if (contactBox.isEmpty()) return false;
  contactBox.getSize(contactSize);
  const pad = Math.max(0.05, contactSize.x * 0.08);
  const seatMinY = contactBox.min.y + contactSize.y * 0.32;
  const seatMaxY = contactBox.min.y + contactSize.y * 0.82;
  return (
    point.y >= seatMinY &&
    point.y <= seatMaxY + 0.06 &&
    point.x >= contactBox.min.x - pad &&
    point.x <= contactBox.max.x + pad &&
    point.z >= contactBox.min.z - pad &&
    point.z <= contactBox.max.z + pad
  );
}

export function isOnObject(item: PlacedObject, point: { x: number; y: number; z: number }): boolean {
  contactBox.setFromObject(item.visual);
  if (contactBox.isEmpty()) return false;
  contactBox.expandByScalar(0.06);
  return contactBox.containsPoint(contactPoint.set(point.x, point.y, point.z));
}

export function pressSeat(item: PlacedObject, point?: { x: number; y: number; z: number }): void {
  item.squash.displacement = Math.min(item.squash.displacement, 0.78);
  item.squash.velocity = -2.8;
  if (point) {
    item.contacts = [{ x: point.x, y: point.y, z: point.z, strength: 1, time: 0 }];
  }
}

export function updatePlacedObject(
  item: PlacedObject,
  dt: number,
  surfaces: RoomSurface[],
  palmPress: boolean,
  poke: boolean,
  time: number,
  seatPress = false,
): void {
  void time;
  const target = item.contacts.reduce((max, c) => Math.max(max, c.strength), 0);
  stepJellySpring(item.spring, target, dt, config.jellyStiffness, config.jellyDamping);
  const squashTarget =
    item.object.scene === 'object3d'
      ? seatPress || palmPress
        ? 0.7
        : poke
          ? 0.88
          : 1
      : 1;
  stepJellySpring(item.squash, squashTarget, dt, config.jellyStiffness, config.jellyDamping);
  if (item.falling) {
    const vol = volumePreservingSquash(item.squash.displacement);
    item.visual.scale.set(vol.xz, vol.y, vol.xz);
  } else {
    item.visual.scale.set(1, 1, 1);
    applyLocalJelly(item);
  }

  if (item.falling) {
    item.velocityY -= config.objectGravity * dt;
    item.root.position.y += item.velocityY * dt;
    const surface = nearestHorizontal(surfaces, {
      x: item.root.position.x,
      y: item.root.position.y,
      z: item.root.position.z,
    });
    const floorY = surface ? projectOntoSurface(item.root.position, surface).y : 0;
    if (item.root.position.y <= floorY) {
      item.root.position.y = floorY;
      if (item.bounces < config.objectBounces && Math.abs(item.velocityY) > 0.4) {
        item.velocityY = -item.velocityY * config.dropRestitution;
        item.bounces += 1;
        item.squash.displacement = 0.75;
      } else {
        item.falling = false;
        item.velocityY = 0;
      }
    }
  }
  const lift = Math.max(0, item.root.position.y - 0.02);
  updateContactShadow(item.shadow, !item.falling, lift, item.object.realSize * 0.25 * item.scale);
}

export function dropObject(item: PlacedObject): void {
  item.falling = true;
  item.bounces = 0;
  item.velocityY = 0;
}

export function resizeObject(item: PlacedObject, factor: number): void {
  item.scale = Math.min(config.objectMaxScale, Math.max(config.objectMinScale, factor));
  item.root.scale.setScalar(item.scale);
}
