import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';
import { makeGuidanceCanvas } from '../assets/drawn.js';

/**
 * Conversion marker — shows a short "Loading…" label, then holds the
 * reconstructed model briefly before placement takes over.
 */
export class ConversionAnimation {
  readonly group = new Group();
  private model: Group | null = null;
  private label: Mesh | null = null;

  constructor() {
    this.group.name = 'conversion-animation';
    this.group.visible = false;
  }

  attachModel(model: Group): void {
    this.clearLabel();
    this.model = model;
    this.model.visible = true;
    this.group.add(model);
  }

  start(origin: Vector3, _column = false, message = 'Loading…'): void {
    this.clearLabel();
    this.group.visible = true;
    this.group.position.copy(origin);
    const map = new CanvasTexture(makeGuidanceCanvas(message));
    const mesh = new Mesh(
      new PlaneGeometry(0.42, 0.07),
      new MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: DoubleSide }),
    );
    mesh.position.set(0, 0.12, 0);
    mesh.raycast = () => undefined;
    this.label = mesh;
    this.group.add(mesh);
  }

  setMessage(message: string): void {
    if (!this.label) return;
    const mat = this.label.material as MeshBasicMaterial;
    mat.map?.dispose();
    mat.map = new CanvasTexture(makeGuidanceCanvas(message));
    mat.needsUpdate = true;
  }

  update(_progress: number): void {
    if (this.model) this.model.visible = true;
  }

  finish(): Group | null {
    this.clearLabel();
    this.group.visible = false;
    if (this.model) this.group.remove(this.model);
    const out = this.model;
    this.model = null;
    return out;
  }

  private clearLabel(): void {
    if (!this.label) return;
    this.group.remove(this.label);
    this.label.geometry.dispose();
    const mat = this.label.material as MeshBasicMaterial;
    mat.map?.dispose();
    mat.dispose();
    this.label = null;
  }
}
