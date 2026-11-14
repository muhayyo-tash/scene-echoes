import {
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { config } from '../config.js';

export type WeatherKind = 'rain' | 'snow';

export class RainEffect {
  readonly points: Points;
  private velocities: Float32Array;
  private kind: WeatherKind = 'rain';
  readonly ripples: Array<{ x: number; y: number; z: number; age: number }> = [];

  constructor() {
    const count = config.rainDropCount;
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * config.rainRadius * 2;
      positions[i * 3 + 1] = Math.random() * 2.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * config.rainRadius * 2;
      this.velocities[i] = 1.6 + Math.random() * 1.2;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.points = new Points(
      geo,
      new PointsMaterial({ color: 0xb8d8ff, size: 0.012, transparent: true, opacity: 0.65 }),
    );
    this.points.visible = false;
  }

  setKind(kind: WeatherKind): void {
    this.kind = kind;
    const mat = this.points.material as PointsMaterial;
    if (kind === 'snow') {
      mat.color.setHex(0xffffff);
      mat.size = 0.028;
      mat.opacity = 0.9;
      for (let i = 0; i < this.velocities.length; i++) {
        this.velocities[i] = 0.35 + Math.random() * 0.45;
      }
    } else {
      mat.color.setHex(0xb8d8ff);
      mat.size = 0.012;
      mat.opacity = 0.65;
      for (let i = 0; i < this.velocities.length; i++) {
        this.velocities[i] = 1.6 + Math.random() * 1.2;
      }
    }
    mat.needsUpdate = true;
  }

  setCenter(center: Vector3): void {
    this.points.position.copy(center);
  }

  update(dt: number, floorY: number, hand?: Vector3 | null): boolean {
    const pos = this.points.geometry.getAttribute('position');
    let splashHand = false;
    this.ripples.length = 0;
    const drift = this.kind === 'snow' ? 0.15 : 0;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + Math.sin(i + pos.getY(i) * 2) * drift * dt;
      let y = pos.getY(i) - this.velocities[i] * dt;
      if (y < floorY) {
        this.ripples.push({
          x: this.points.position.x + x,
          y: floorY,
          z: this.points.position.z + pos.getZ(i),
          age: 0,
        });
        y = floorY + 2.1;
        x = (Math.random() - 0.5) * config.rainRadius * 2;
      }
      if (hand) {
        const dx = this.points.position.x + x - hand.x;
        const dy = y - hand.y;
        const dz = this.points.position.z + pos.getZ(i) - hand.z;
        if (dx * dx + dy * dy + dz * dz < 0.03) splashHand = true;
      }
      pos.setX(i, x);
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    return splashHand;
  }
}
