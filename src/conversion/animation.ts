import { Group, Vector3 } from 'three';

/**
 * Conversion marker only — no rings, discs, or wireframes.
 * The model is attached here briefly, then handed off to placement.
 */
export class ConversionAnimation {
  readonly group = new Group();
  private model: Group | null = null;

  constructor() {
    this.group.name = 'conversion-animation';
    this.group.visible = false;
  }

  attachModel(model: Group): void {
    this.model = model;
    this.model.visible = true;
    this.group.add(model);
  }

  start(origin: Vector3, _column = false): void {
    this.group.visible = true;
    this.group.position.copy(origin);
  }

  update(_progress: number): void {
    if (this.model) this.model.visible = true;
  }

  finish(): Group | null {
    this.group.visible = false;
    if (this.model) this.group.remove(this.model);
    const out = this.model;
    this.model = null;
    return out;
  }
}
