import {
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import { conversionPhase } from './phases.js';
import { revealFragment, revealVertex } from '../shaders/reveal.js';

export class ConversionAnimation {
  readonly group = new Group();
  private outline: Mesh;
  private cutout: Mesh;
  private wire: LineSegments | null = null;
  private scan: Mesh;
  private particles: Points;
  private model: Group | null = null;
  private reveal: ShaderMaterial | null = null;
  private column = false;

  constructor() {
    this.group.name = 'conversion-animation';
    this.outline = new Mesh(
      new RingGeometry(0.08, 0.09, 48),
      new MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, side: DoubleSide }),
    );
    this.cutout = new Mesh(
      new PlaneGeometry(0.22, 0.16),
      new MeshBasicMaterial({ color: 0xcfe8d8, transparent: true, opacity: 0, side: DoubleSide }),
    );
    this.scan = new Mesh(
      new PlaneGeometry(0.3, 0.008),
      new MeshBasicMaterial({ color: 0xb8f3ff, transparent: true, opacity: 0 }),
    );
    const positions = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 1] = Math.random() * 0.3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.particles = new Points(
      geo,
      new PointsMaterial({ color: 0x9fe8ff, size: 0.008, transparent: true, opacity: 0 }),
    );
    this.group.add(this.outline, this.cutout, this.scan, this.particles);
    this.group.visible = false;
  }

  attachModel(model: Group): void {
    this.model = model;
    this.model.visible = false;
    this.group.add(model);
    try {
      const edges = new EdgesGeometry(geometryOf(model), 25);
      this.wire = new LineSegments(
        edges,
        new LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0 }),
      );
      this.group.add(this.wire);
    } catch {
      this.wire = null;
    }
    this.reveal = new ShaderMaterial({
      uniforms: {
        uReveal: { value: 0 },
        uScan: { value: 0 },
        uColor: { value: new Color('#8fb896') },
      },
      vertexShader: revealVertex,
      fragmentShader: revealFragment,
      transparent: true,
    });
  }

  start(origin: Vector3, column = false): void {
    this.column = column;
    this.group.visible = true;
    this.group.position.copy(origin);
    if (column) {
      const light = new Mesh(
        new PlaneGeometry(0.04, 0.5),
        new MeshBasicMaterial({ color: 0xcfffff, transparent: true, opacity: 0.35, side: DoubleSide }),
      );
      light.position.y = 0.25;
      this.group.add(light);
    }
  }

  update(progress: number): void {
    const { phase, local } = conversionPhase(progress);
    // No press-target ring or cutout — the open photo stays clean.
    this.outline.visible = false;
    this.cutout.visible = false;
    if (this.wire) {
      this.wire.visible = phase === 'build' || phase === 'settle';
      this.wire.scale.set(1, phase === 'build' ? Math.max(0.05, local) : 1, 1);
      (this.wire.material as LineBasicMaterial).opacity = phase === 'settle' ? 1 - local : 0.85;
    }
    this.scan.visible = phase === 'build';
    this.scan.position.y = local * 0.28;
    (this.scan.material as MeshBasicMaterial).opacity = phase === 'build' ? 0.8 : 0;
    (this.particles.material as PointsMaterial).opacity = phase === 'build' ? 0.7 : 0;
    if (this.model) {
      this.model.visible = phase === 'build' || phase === 'settle' || phase === 'done';
      this.model.rotation.y = phase === 'build' ? local * Math.PI : this.model.rotation.y;
      if (this.reveal) {
        this.reveal.uniforms.uReveal.value = phase === 'build' ? local : 1;
        this.reveal.uniforms.uScan.value = local;
      }
    }
  }

  finish(): Group | null {
    this.group.visible = false;
    if (this.model) this.group.remove(this.model);
    return this.model;
  }
}

function geometryOf(model: Group): BufferGeometry {
  let found: BufferGeometry | null = null;
  model.traverse((child) => {
    const mesh = child as Mesh;
    if (!found && mesh.isMesh) found = mesh.geometry;
  });
  return found ?? new PlaneGeometry(0.2, 0.2);
}
