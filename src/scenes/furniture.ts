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

export interface PlacedFurniture {
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

function attachLocalJelly(model: Group): LocalJelly {
  const contactVecs = [0, 1, 2, 3, 4, 5].map(() => new Vector4());
  const uContacts = { value: contactVecs };
  const uRadius = { value: config.jellyRadius };
  const uDepth = { value: 0 };
  model.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const source = mesh.material;
    const next = Array.isArray(source) ? source.map((mat) => patchJellyMaterial(mat, uContacts, uRadius, uDepth)) : patchJellyMaterial(source, uContacts, uRadius, uDepth);
    mesh.material = next as Mesh['material'];
  });
  return { contactVecs, uRadius, uDepth };
}

function patchJellyMaterial(
  material: Material,
  uContacts: { value: Vector4[] },
  uRadius: { value: number },
  uDepth: { value: number },
): Material {
  const next = material.clone();
  next.customProgramCacheKey = () => 'scene-echoes-local-jelly-v1';
  next.onBeforeCompile = (shader) => {
    shader.uniforms.uContacts = uContacts;
    shader.uniforms.uRadius = uRadius;
    shader.uniforms.uDepth = uDepth;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec4 uContacts[6];
uniform float uRadius;
uniform float uDepth;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  vec3 world = (modelMatrix * vec4(transformed, 1.0)).xyz;
  for (int i = 0; i < 6; i++) {
    float strength = uContacts[i].w;
    if (strength > 0.001) {
      vec3 delta = world - uContacts[i].xyz;
      float d = length(delta);
      float t = clamp(1.0 - d / max(uRadius, 0.0001), 0.0, 1.0);
      float fall = t * t * (3.0 - 2.0 * t);
      world.y -= uDepth * strength * fall;
      vec2 side = delta.xz;
      float slen = length(side);
      if (slen > 0.0001) {
        world.xz += (side / slen) * uDepth * 0.22 * strength * fall;
      }
    }
  }
  transformed = (inverse(modelMatrix) * vec4(world, 1.0)).xyz;
}`,
      );
  };
  next.needsUpdate = true;
  return next;
}

function applyLocalJelly(item: PlacedFurniture): void {
  const vecs = item.jelly.contactVecs;
  for (let i = 0; i < 6; i++) {
    const contact = item.contacts[i];
    if (contact) vecs[i].set(contact.x, contact.y, contact.z, contact.strength);
    else vecs[i].set(0, 0, 0, 0);
  }
  const amount = Math.max(0, Math.min(1, (1 - item.squash.displacement) / 0.32));
  item.jelly.uDepth.value = amount * Math.max(config.jellyDepth, item.object.realSize * 0.055);
  item.jelly.uRadius.value = Math.max(config.jellyRadius, item.object.realSize * 0.16);
}

export function makeFurniture(object: ManifestObject, model: Group): PlacedFurniture {
  const shadow = createContactShadow(object.realSize * 0.35);
  const jelly = attachLocalJelly(model);
  const root = new Group();
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

export function setFurnitureContacts(item: PlacedFurniture, points: ContactPoint[]): void {
  item.contacts = points.slice(0, 6);
}

const seatBox = new Box3();
const seatSize = new Vector3();
const seatPoint = new Vector3();

export function isOnSeatTop(item: PlacedFurniture, point: { x: number; y: number; z: number }): boolean {
  seatBox.setFromObject(item.visual);
  if (seatBox.isEmpty()) return false;
  seatBox.getSize(seatSize);
  const pad = Math.max(0.05, seatSize.x * 0.08);
  const seatMinY = seatBox.min.y + seatSize.y * 0.32;
  const seatMaxY = seatBox.min.y + seatSize.y * 0.82;
  return (
    point.y >= seatMinY &&
    point.y <= seatMaxY + 0.06 &&
    point.x >= seatBox.min.x - pad &&
    point.x <= seatBox.max.x + pad &&
    point.z >= seatBox.min.z - pad &&
    point.z <= seatBox.max.z + pad
  );
}

export function isOnFurniture(item: PlacedFurniture, point: { x: number; y: number; z: number }): boolean {
  seatBox.setFromObject(item.visual);
  if (seatBox.isEmpty()) return false;
  seatBox.expandByScalar(0.06);
  return seatBox.containsPoint(seatPoint.set(point.x, point.y, point.z));
}

export function pressSeat(item: PlacedFurniture, point?: { x: number; y: number; z: number }): void {
  item.squash.displacement = Math.min(item.squash.displacement, 0.78);
  item.squash.velocity = -2.8;
  if (point) {
    item.contacts = [{ x: point.x, y: point.y, z: point.z, strength: 1, time: 0 }];
  }
}

export function updateFurniture(
  item: PlacedFurniture,
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
    item.object.scene === 'furniture'
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
    item.velocityY -= config.furnitureGravity * dt;
    item.root.position.y += item.velocityY * dt;
    const surface = nearestHorizontal(surfaces, {
      x: item.root.position.x,
      y: item.root.position.y,
      z: item.root.position.z,
    });
    const floorY = surface ? projectOntoSurface(item.root.position, surface).y : 0;
    if (item.root.position.y <= floorY) {
      item.root.position.y = floorY;
      if (item.bounces < config.furnitureBounces && Math.abs(item.velocityY) > 0.4) {
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

export function dropFurniture(item: PlacedFurniture): void {
  item.falling = true;
  item.bounces = 0;
  item.velocityY = 0;
}

export function resizeFurniture(item: PlacedFurniture, factor: number): void {
  item.scale = Math.min(config.furnitureMaxScale, Math.max(config.furnitureMinScale, factor));
  item.root.scale.setScalar(item.scale);
}
