import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import type { Vec3 } from './touch.js';

const DEFAULT_LENGTH = 1.6;

export class PointerRay {
  readonly group = new Group();
  private readonly shaft: Mesh;
  private readonly dot: Mesh;
  private readonly origin = new Vector3();
  private readonly dir = new Vector3();
  private readonly end = new Vector3();
  private readonly mid = new Vector3();
  private readonly up = new Vector3(0, 1, 0);

  constructor() {
    this.shaft = new Mesh(
      new CylinderGeometry(0.0016, 0.0016, 1, 8),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false }),
    );
    this.dot = new Mesh(
      new SphereGeometry(0.01, 16, 16),
      new MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
    );
    this.shaft.renderOrder = 10;
    this.dot.renderOrder = 11;
    this.group.add(this.shaft, this.dot);
    this.group.visible = false;
    this.group.name = 'pointer-ray';
  }

  update(origin: Vec3 | null, direction: Vec3 | null, hit: Vector3 | null): void {
    if (!origin || !direction) {
      this.group.visible = false;
      return;
    }
    this.dir.set(direction.x, direction.y, direction.z);
    if (this.dir.lengthSq() < 1e-6) {
      this.group.visible = false;
      return;
    }
    this.dir.normalize();
    this.origin.set(origin.x, origin.y, origin.z);
    if (hit) this.end.copy(hit);
    else this.end.copy(this.origin).addScaledVector(this.dir, DEFAULT_LENGTH);
    const length = Math.max(0.02, this.origin.distanceTo(this.end));
    this.mid.copy(this.origin).addScaledVector(this.dir, length * 0.5);
    this.shaft.position.copy(this.mid);
    this.shaft.scale.set(1, length, 1);
    this.shaft.quaternion.setFromUnitVectors(this.up, this.dir);
    this.dot.position.copy(this.end);
    this.group.visible = true;
  }
}

const poseQuat = new Quaternion();
const minusZ = new Vector3();

export function rayFromOrientation(
  position: { x: number; y: number; z: number },
  orientation: { x: number; y: number; z: number; w: number },
): { origin: Vec3; direction: Vec3 } {
  poseQuat.set(orientation.x, orientation.y, orientation.z, orientation.w);
  minusZ.set(0, 0, -1).applyQuaternion(poseQuat);
  return {
    origin: { x: position.x, y: position.y, z: position.z },
    direction: { x: minusZ.x, y: minusZ.y, z: minusZ.z },
  };
}
