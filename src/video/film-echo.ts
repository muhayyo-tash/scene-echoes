import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Texture,
  Group,
  type Material,
} from 'three';

/**
 * Soft transparent continuation of the film beyond the opaque video plate.
 * Same frame texture, larger planes behind the player — room stays visible through them.
 */
export class FilmEcho {
  readonly group = new Group();
  private mid: Mesh;
  private far: Mesh;
  private strength = 0;
  private active = false;
  private bound: Texture | null = null;

  constructor() {
    this.mid = this.makePlate(1.35, 0.11, -0.06);
    this.far = this.makePlate(1.72, 0.07, -0.14);
    this.group.add(this.far, this.mid);
    this.group.name = 'film-echo';
    this.group.visible = false;
  }

  private makePlate(scale: number, opacity: number, z: number): Mesh {
    const mesh = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    mesh.position.z = z;
    mesh.userData.echoScale = scale;
    mesh.userData.baseOpacity = opacity;
    mesh.renderOrder = -2;
    return mesh;
  }

  bindTexture(texture: Texture): void {
    this.bound = texture;
    for (const plate of [this.mid, this.far]) {
      const mat = plate.material as MeshBasicMaterial;
      mat.map = texture;
      mat.needsUpdate = true;
    }
  }

  setPlaying(on: boolean): void {
    this.active = on;
    this.group.visible = on;
    if (!on) this.strength = 0;
  }

  /** Match opaque screen size; echo planes grow past the bezel. */
  layout(width: number, height: number): void {
    for (const plate of [this.mid, this.far]) {
      const scale = Number(plate.userData.echoScale) || 1.4;
      plate.geometry.dispose();
      plate.geometry = new PlaneGeometry(width * scale, height * scale);
    }
  }

  update(dt: number, paused: boolean): void {
    const goal = this.active && this.bound ? (paused ? 0.45 : 1) : 0;
    this.strength += (goal - this.strength) * Math.min(1, dt * 2.4);
    for (const plate of [this.mid, this.far]) {
      const mat = plate.material as MeshBasicMaterial;
      const base = Number(plate.userData.baseOpacity) || 0.08;
      mat.opacity = base * this.strength;
      mat.visible = mat.opacity > 0.004;
    }
    this.group.visible = this.active && this.strength > 0.02;
  }

  dispose(): void {
    for (const plate of [this.mid, this.far]) {
      plate.geometry.dispose();
      (plate.material as Material).dispose();
    }
  }
}
