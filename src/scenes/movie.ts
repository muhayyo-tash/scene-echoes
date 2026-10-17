import { Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import type { ManifestObject, SlotName, TimelineMoment } from '../assets/types.js';
import { loadModel } from '../assets/loaders.js';
import { config } from '../config.js';
import { behaviorFromLabel, reactionFromBehavior } from '../video/behaviors.js';
import { assignSlot, slotPosition } from '../video/slots.js';
import { bobOffset, easeInOut, flyPoint, perchTarget, walkPoint } from '../video/paths.js';
import {
  createReactionState,
  tryStartReaction,
  updateReaction,
  type ReactionState,
} from '../video/reactions.js';
import { RainEffect } from '../video/rain.js';
import { createContactShadow } from '../core/shadows.js';
import type { RoomSurface } from '../core/surfaces.js';
import { scheduleMoments } from '../video/timeline.js';

export interface MovieObject {
  id: string;
  moment: TimelineMoment;
  object: ManifestObject;
  root: Group;
  slot: SlotName | null;
  born: number;
  lifetime: number;
  grabbed: boolean;
  reaction: ReactionState;
  perch: Vector3 | null;
}

export class MovieScene {
  readonly group = new Group();
  objects: MovieObject[] = [];
  rain = new RainEffect();
  private spawned = new Set<string>();
  private activeEffects = new Set<string>();

  constructor(private readonly catalog: ManifestObject[]) {
    this.group.name = 'movie-objects';
    this.group.add(this.rain.points);
  }

  reset(): void {
    for (const object of this.objects) this.group.remove(object.root);
    this.objects = [];
    this.spawned.clear();
    this.activeEffects.clear();
    this.rain.points.visible = false;
  }

  async tick(
    time: number,
    moments: TimelineMoment[],
    head: { x: number; y: number; z: number },
    forward: { x: number; z: number },
    right: { x: number; z: number },
    surfaces: RoomSurface[],
    onAppear: (id: string, pos: Vector3) => void,
  ): Promise<void> {
    const scheduled = scheduleMoments(moments, time, this.spawned);
    for (const item of scheduled) {
      if (item.stage === 'appear' && !this.spawned.has(item.moment.id)) {
        await this.spawn(item.moment, head, forward, right, surfaces, onAppear);
      }
      if (item.stage === 'leave' && this.spawned.has(item.moment.id)) {
        this.despawn(item.moment.id);
      }
    }
  }

  update(
    dt: number,
    time: number,
    head: { x: number; y: number; z: number },
    forward: { x: number; z: number },
    right: { x: number; z: number },
    surfaces: RoomSurface[],
    floorY: number,
  ): void {
    const occupied = this.objects.map((o) => o.slot).filter(Boolean) as SlotName[];
    for (const object of this.objects) {
      if (object.grabbed) continue;
      const def = object.object;
      const behavior = behaviorFromLabel(def.label, def.behavior);
      updateReaction(object.reaction, dt);
      if (behavior === 'rain') continue;
      const age = time - object.born;
      if (age < config.popOutSeconds) {
        const t = easeInOut(age / config.popOutSeconds);
        const target = object.slot
          ? slotPosition(object.slot, head, forward, right, (config.objectDistanceMin + config.objectDistanceMax) / 2)
          : object.root.position;
        object.root.position.lerp(new Vector3(target.x, target.y, target.z), t);
        continue;
      }
      if (behavior === 'fly') {
        if (def.landing === 'perch' && !object.perch) {
          const found = perchTarget(
            surfaces.map((s) => ({ x: s.origin.x, y: s.origin.y, z: s.origin.z, horizontal: s.horizontal })),
            object.root.position,
            config.perchSearchDistance,
          );
          if (found) object.perch = new Vector3(found.x, found.y, found.z);
        }
        if (object.perch) {
          object.root.position.lerp(object.perch, dt * 2);
        } else {
          const p = flyPoint(time, head, (config.objectDistanceMin + config.objectDistanceMax) / 2, config.flySpeed);
          object.root.position.set(p.x, p.y, p.z);
          object.root.rotation.y = p.yaw;
        }
      } else if (behavior === 'walk') {
        const p = walkPoint(time, head, config.walkRadius, config.walkSpeed, floorY);
        object.root.position.set(p.x, p.y, p.z);
        object.root.rotation.y = p.yaw;
        object.root.rotation.x = p.sniff * 0.2;
      } else if (behavior === 'sway') {
        object.root.rotation.z = Math.sin(time * 1.2) * 0.08;
      } else if (behavior === 'drift') {
        object.root.position.y -= dt * 0.08;
        object.root.rotation.y += dt;
        if (object.root.position.y < floorY + 0.2) object.root.position.y = head.y;
      } else {
        object.root.position.y += bobOffset(time, config.objectBobAmplitude, config.objectBobSeconds) * dt * 0;
        object.root.position.y = (object.slot
          ? slotPosition(object.slot, head, forward, right, (config.objectDistanceMin + config.objectDistanceMax) / 2).y
          : object.root.position.y) + bobOffset(time, config.objectBobAmplitude, config.objectBobSeconds);
      }
      if (object.reaction.name === 'hop') {
        object.root.position.y += Math.sin(object.reaction.elapsed * 8) * 0.08;
      }
      if (object.reaction.name === 'spin') {
        object.root.rotation.y += dt * Math.PI * 2;
      }
      void occupied;
    }
    if (this.rain.points.visible) {
      this.rain.update(dt, floorY);
    }
  }

  touch(point: Vector3): MovieObject | null {
    for (const object of this.objects) {
      if (object.root.position.distanceTo(point) < 0.18) {
        const reaction = reactionFromBehavior(
          behaviorFromLabel(object.object.label, object.object.behavior),
          object.object.reaction,
        );
        if (tryStartReaction(object.reaction, reaction, config.reactionCooldownSeconds)) {
          return object;
        }
      }
    }
    return null;
  }

  private async spawn(
    moment: TimelineMoment,
    head: { x: number; y: number; z: number },
    forward: { x: number; z: number },
    right: { x: number; z: number },
    surfaces: RoomSurface[],
    onAppear: (id: string, pos: Vector3) => void,
  ): Promise<void> {
    const def = this.catalog.find((item) => item.id === moment.objectId);
    if (!def) return;
    const behavior = behaviorFromLabel(def.label, def.behavior);
    if (behavior === 'rain') {
      this.rain.points.visible = true;
      this.rain.setCenter(new Vector3(head.x, head.y + 0.6, head.z + forward.z * 0.8));
      this.spawned.add(moment.id);
      this.activeEffects.add(moment.id);
      return;
    }
    const liveObjects = this.objects.filter((o) => behaviorFromLabel(o.object.label, o.object.behavior) !== 'rain');
    if (liveObjects.length >= config.maxMovieObjects) {
      this.despawn(liveObjects[0].id);
    }
    let model: Group;
    try {
      model = await loadModel(def);
    } catch {
      return;
    }
    const occupied = this.objects.map((o) => o.slot).filter(Boolean) as SlotName[];
    const slot = behavior === 'walk' ? null : assignSlot(moment.side, occupied);
    const root = new Group();
    root.add(model);
    root.add(createContactShadow(0.12));
    const floatScale = def.floatScale ?? 1;
    if (behavior === 'fly' || behavior === 'hover') root.scale.setScalar(floatScale);
    this.group.add(root);
    const start = new Vector3(
      head.x + forward.x * config.videoScreenDistance,
      head.y,
      head.z + forward.z * config.videoScreenDistance,
    );
    root.position.copy(start);
    this.objects.push({
      id: moment.id,
      moment,
      object: def,
      root,
      slot,
      born: moment.time,
      lifetime: moment.lifetime ?? config.objectLifetimeSeconds,
      grabbed: false,
      reaction: createReactionState(),
      perch: null,
    });
    this.spawned.add(moment.id);
    onAppear(moment.id, start);
    void surfaces;
  }

  private despawn(id: string): void {
    const index = this.objects.findIndex((o) => o.id === id);
    if (index >= 0) {
      this.group.remove(this.objects[index].root);
      this.objects.splice(index, 1);
    }
    if (this.activeEffects.has(id)) {
      this.rain.points.visible = false;
      this.activeEffects.delete(id);
    }
    this.spawned.delete(id);
  }
}

export function outlineMesh(): Mesh {
  return new Mesh(
    new PlaneGeometry(0.12, 0.08),
    new MeshBasicMaterial({ color: new Color('#9fe8ff'), transparent: true, opacity: 0.6 }),
  );
}
