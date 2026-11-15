import { Box3, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import type { ManifestObject, SlotName, TimelineMoment } from '../assets/types.js';
import { loadModel } from '../assets/loaders.js';
import { config } from '../config.js';
import { behaviorFromLabel, reactionFromBehavior } from '../video/behaviors.js';
import { assignSlot, slotAppearFrom, slotPosition } from '../video/slots.js';
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
  baseScale: number;
  phase: 'in' | 'live' | 'out';
  leaveAge: number;
  home: Vector3;
  appearFrom: Vector3;
}

export class MovieScene {
  readonly group = new Group();
  objects: MovieObject[] = [];
  rain = new RainEffect();
  private spawned = new Set<string>();
  private activeEffects = new Set<string>();
  private readonly scratch = new Vector3();

  constructor(private catalog: ManifestObject[]) {
    this.group.name = 'movie-objects';
    this.group.add(this.rain.points);
  }

  replaceCatalog(objects: ManifestObject[]): void {
    this.catalog = objects;
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
    screen: { x: number; y: number; z: number },
    head: { x: number; y: number; z: number },
    forward: { x: number; z: number },
    right: { x: number; z: number },
    surfaces: RoomSurface[],
    onAppear: (id: string, pos: Vector3) => void,
  ): Promise<void> {
    const scheduled = scheduleMoments(moments, time, this.spawned);
    const introDone = time >= config.movieIntroSeconds;
    for (const item of scheduled) {
      // First seconds of a film: watch the video only — no props yet.
      if (item.stage === 'appear' && !this.spawned.has(item.moment.id) && introDone) {
        await this.spawn(item.moment, screen, head, forward, right, surfaces, onAppear);
      }
      if (item.stage === 'leave' && this.spawned.has(item.moment.id)) {
        this.beginLeave(item.moment.id);
      }
    }
  }

  update(
    dt: number,
    time: number,
    screen: { x: number; y: number; z: number },
    head: { x: number; y: number; z: number },
    forward: { x: number; z: number },
    right: { x: number; z: number },
    surfaces: RoomSurface[],
    floorY: number,
  ): void {
    const finishedLeave: string[] = [];
    for (const object of this.objects) {
      if (object.grabbed) continue;
      const def = object.object;
      const behavior = behaviorFromLabel(def.label, def.behavior);
      updateReaction(object.reaction, dt);
      if (behavior === 'rain' || behavior === 'snow') continue;

      // home / appearFrom are frozen at spawn — never re-bind to head yaw
      // (that was shoving props behind the screen when you turned).

      if (object.phase === 'in') {
        const age = time - object.born;
        const u = easeInOut(age / config.popOutSeconds);
        object.root.position.copy(object.appearFrom).lerp(object.home, u);
        object.root.scale.setScalar(object.baseScale * (0.12 + 0.88 * u));
        if (u >= 1) {
          object.phase = 'live';
          object.root.scale.setScalar(object.baseScale);
        }
        continue;
      }

      if (object.phase === 'out') {
        object.leaveAge += dt;
        const u = easeInOut(object.leaveAge / config.movieLeaveSeconds);
        object.root.position.copy(object.home).lerp(object.appearFrom, u);
        object.root.scale.setScalar(object.baseScale * Math.max(0.01, 1 - u));
        if (object.leaveAge >= config.movieLeaveSeconds) finishedLeave.push(object.id);
        continue;
      }

      // Live: world-fixed beside the screen so you can walk around and inspect.
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
          // Tiny local flutter around the frozen slot — not head-locked.
          const p = flyPoint(time, object.home, 0.06, config.flySpeed * 0.4, 0.04);
          object.root.position.set(p.x, p.y, p.z);
          object.root.rotation.y = p.yaw;
        }
      } else if (behavior === 'walk') {
        const p = walkPoint(time, object.home, 0.18, config.walkSpeed * 0.7, floorY);
        object.root.position.set(p.x, p.y, p.z);
        object.root.rotation.y = p.yaw;
        object.root.rotation.x = p.sniff * 0.2;
      } else if (behavior === 'sway') {
        object.root.position.copy(object.home);
        object.root.rotation.z = Math.sin(time * 1.2) * 0.08;
      } else if (behavior === 'drift') {
        object.root.position.copy(object.home);
        object.root.position.y += bobOffset(time, 0.03, 3);
        object.root.rotation.y += dt * 0.4;
      } else {
        object.root.position.set(
          object.home.x,
          object.home.y + bobOffset(time, config.objectBobAmplitude, config.objectBobSeconds),
          object.home.z,
        );
      }
      if (object.reaction.name === 'hop') {
        object.root.position.y += Math.sin(object.reaction.elapsed * 8) * 0.08;
      }
      if (object.reaction.name === 'spin') {
        object.root.rotation.y += dt * Math.PI * 2;
      }
      void head;
      void screen;
      void forward;
      void right;
    }
    for (const id of finishedLeave) this.despawn(id);
    if (this.rain.points.visible) {
      this.rain.update(dt, floorY);
    }
  }

  touch(point: Vector3): MovieObject | null {
    for (const object of this.objects) {
      if (object.phase === 'out') continue;
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

  private beginLeave(id: string): void {
    const object = this.objects.find((item) => item.id === id);
    if (!object || object.phase === 'out') return;
    if (this.activeEffects.has(id)) {
      this.despawn(id);
      return;
    }
    object.phase = 'out';
    object.leaveAge = 0;
  }

  private async spawn(
    moment: TimelineMoment,
    screen: { x: number; y: number; z: number },
    head: { x: number; y: number; z: number },
    forward: { x: number; z: number },
    right: { x: number; z: number },
    surfaces: RoomSurface[],
    onAppear: (id: string, pos: Vector3) => void,
  ): Promise<void> {
    const def = this.catalog.find((item) => item.id === moment.objectId);
    if (!def) return;
    const behavior = behaviorFromLabel(def.label, def.behavior);
    if (behavior === 'rain' || behavior === 'snow') {
      this.rain.setKind(behavior === 'snow' ? 'snow' : 'rain');
      this.rain.points.visible = true;
      this.rain.setCenter(new Vector3(screen.x, screen.y + 0.6, screen.z));
      this.spawned.add(moment.id);
      this.activeEffects.add(moment.id);
      return;
    }
    const liveObjects = this.objects.filter((o) => {
      const b = behaviorFromLabel(o.object.label, o.object.behavior);
      return b !== 'rain' && b !== 'snow' && o.phase !== 'out';
    });
    if (liveObjects.length >= config.maxMovieObjects) {
      this.beginLeave(liveObjects[0].id);
    }
    let model: Group;
    try {
      model = await loadModel(def);
    } catch {
      return;
    }
    const occupied = this.objects
      .filter((o) => o.phase !== 'out')
      .map((o) => o.slot)
      .filter(Boolean) as SlotName[];
    const slot = assignSlot(moment.side, occupied) ?? 'left';
    const root = new Group();
    // Normalize every film prop to the same hand-reachable size.
    model.updateWorldMatrix(true, true);
    const size = new Box3().setFromObject(model).getSize(this.scratch);
    const longest = Math.max(size.x, size.y, size.z, 1e-4);
    const baseScale = (config.moviePropSize / longest) * (def.floatScale ?? 1);
    root.add(model);
    root.add(createContactShadow(config.moviePropSize * 0.45));
    root.scale.setScalar(0.12 * baseScale);
    root.renderOrder = 2;
    this.group.add(root);
    // Freeze world slot from the screen pose at spawn — stays put if you turn.
    const homePos = slotPosition(slot, screen, forward, right);
    const fromPos = slotAppearFrom(slot, screen, forward, right);
    const home = new Vector3(homePos.x, homePos.y, homePos.z);
    const appearFrom = new Vector3(fromPos.x, fromPos.y, fromPos.z);
    root.position.copy(appearFrom);
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
      baseScale,
      phase: 'in',
      leaveAge: 0,
      home,
      appearFrom,
    });
    this.spawned.add(moment.id);
    onAppear(moment.id, appearFrom);
    void surfaces;
    void head;
    void this.scratch;
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
