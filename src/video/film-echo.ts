import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Texture,
  Group,
  type Material,
} from 'three';

/**
 * Soft transparent continuation of the film beyond the opaque video plate.
 * One large plane behind the player — edges feather out so there is no hard frame.
 */
export class FilmEcho {
  readonly group = new Group();
  private plate: Mesh;
  private readonly edgeMask: CanvasTexture;
  private strength = 0;
  private active = false;
  private bound: Texture | null = null;
  /** Size relative to the opaque player. */
  private readonly echoScale = 3.35;
  private readonly baseOpacity = 0.28;

  constructor() {
    this.edgeMask = createSoftEdgeAlphaMap();
    this.plate = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        transparent: true,
        opacity: this.baseOpacity,
        depthWrite: false,
        toneMapped: false,
        alphaMap: this.edgeMask,
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
    mat.alphaMap = this.edgeMask;
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
    this.edgeMask.dispose();
  }
}

/** Rectangular soft mask: opaque in the center, fades to 0 at the borders. */
function createSoftEdgeAlphaMap(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  // Fade starts ~28% in from each edge so the rim disappears gradually.
  const fade = 0.28;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const edge = Math.min(u, v, 1 - u, 1 - v);
      let a = edge / fade;
      if (a < 0) a = 0;
      else if (a > 1) a = 1;
      // Smoothstep for a softer falloff.
      a = a * a * (3 - 2 * a);
      const g = Math.round(a * 255);
      const i = (y * size + x) * 4;
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
