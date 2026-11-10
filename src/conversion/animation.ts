import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import { conversionPhase } from './phases.js';
import { revealFragment, revealVertex } from '../shaders/reveal.js';

/**
 * Soft reveal only — no cyan wireframes, scan bars, or leftover column planes.
 * Those read as random blue rectangles in passthrough and confused the demo.
 */
export class ConversionAnimation {
  readonly group = new Group();
  private glow: Mesh;
  private model: Group | null = null;
  private reveal: ShaderMaterial | null = null;

  constructor() {
    this.group.name = 'conversion-animation';
    this.glow = new Mesh(
      new RingGeometry(0.06, 0.09, 48),
      new MeshBasicMaterial({
        color: new Color('#f2f4f0'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.group.add(this.glow);
    this.group.visible = false;
  }

  attachModel(model: Group): void {
    this.model = model;
    this.model.visible = false;
    this.group.add(model);
    this.reveal = new ShaderMaterial({
      uniforms: {
        uReveal: { value: 0 },
        uScan: { value: 0 },
        uColor: { value: new Color('#d8e0d4') },
      },
      vertexShader: revealVertex,
      fragmentShader: revealFragment,
      transparent: true,
    });
  }

  start(origin: Vector3, _column = false): void {
    this.clearEphemerals();
    this.group.visible = true;
    this.group.position.copy(origin);
    (this.glow.material as MeshBasicMaterial).opacity = 0.35;
    this.glow.scale.setScalar(1);
  }

  update(progress: number): void {
    const { phase, local } = conversionPhase(progress);
    const waiting = phase === 'idle' || phase === 'select' || phase === 'lift';
    (this.glow.material as MeshBasicMaterial).opacity = waiting ? 0.25 + local * 0.25 : 0.12 * (1 - local);
    this.glow.scale.setScalar(waiting ? 0.9 + local * 0.35 : 1.1);
    this.glow.visible = true;
    if (this.model) {
      this.model.visible = phase === 'build' || phase === 'settle' || phase === 'done';
      if (phase === 'build') this.model.rotation.y = local * Math.PI * 0.35;
      if (this.reveal) {
        this.reveal.uniforms.uReveal.value = phase === 'build' ? local : phase === 'idle' ? 0 : 1;
        this.reveal.uniforms.uScan.value = local;
      }
    }
  }

  finish(): Group | null {
    this.group.visible = false;
    (this.glow.material as MeshBasicMaterial).opacity = 0;
    this.clearEphemerals();
    if (this.model) this.group.remove(this.model);
    const out = this.model;
    this.model = null;
    this.reveal = null;
    return out;
  }

  private clearEphemerals(): void {
    // Drop any old column / debug meshes that used to leak as blue rectangles.
    const keep = new Set<Mesh | Group>([this.glow]);
    if (this.model) keep.add(this.model);
    for (let i = this.group.children.length - 1; i >= 0; i--) {
      const child = this.group.children[i]!;
      if (keep.has(child as Mesh)) continue;
      this.group.remove(child);
      const mesh = child as Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as MeshBasicMaterial | undefined;
      mat?.dispose?.();
    }
  }
}
