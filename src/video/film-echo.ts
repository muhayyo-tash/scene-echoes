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
 * One large plane behind the player — room stays visible through it.
 */
export class FilmEcho {
  readonly group = new Group();
  private plate: Mesh;
  private strength = 0;
  private active = false;
  private bound: Texture | null = null;
  /** Size relative to the opaque player. */
  private readonly echoScale = 2.6;
  private readonly baseOpacity = 0.18;

  constructor() {
    this.plate = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        transparent: true,
        opacity: this.baseOpacity,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.plate.position.z = -0.08;
    this.plate.renderOrder = -2;
    this.group.add(this.plate);
    this.group.name = 'film-echo';
    this.group.visible = false;
  }

  bindTexture(texture: Texture): void {
    this.bound = texture;
    const mat = this.plate.material as MeshBasicMaterial;
    mat.map = texture;
    mat.needsUpdate = true;
  }

  setPlaying(on: boolean): void {
    this.active = on;
    this.group.visible = on;
    if (!on) this.strength = 0;
  }

  /** Match opaque screen size; echo grows past the bezel as one sheet. */
  layout(width: number, height: number): void {
    this.plate.geometry.dispose();
    this.plate.geometry = new PlaneGeometry(width * this.echoScale, height * this.echoScale);
  }

  update(dt: number, paused: boolean): void {
    const goal = this.active && this.bound ? (paused ? 0.55 : 1) : 0;
    this.strength += (goal - this.strength) * Math.min(1, dt * 2.4);
    const mat = this.plate.material as MeshBasicMaterial;
    mat.opacity = this.baseOpacity * this.strength;
    mat.visible = mat.opacity > 0.004;
    this.group.visible = this.active && this.strength > 0.02;
  }

  dispose(): void {
    this.plate.geometry.dispose();
    (this.plate.material as Material).dispose();
  }
}
