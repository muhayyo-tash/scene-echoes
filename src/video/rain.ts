import {
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { config } from '../config.js';

export class RainEffect {
  readonly points: Points;
  private velocities: Float32Array;
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

  setCenter(center: Vector3): void {
    this.points.position.copy(center);
  }

  update(dt: number, floorY: number, hand?: Vector3 | null): boolean {
    const pos = this.points.geometry.getAttribute('position');
    let splashHand = false;
    this.ripples.length = 0;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - this.velocities[i] * dt;
      if (y < floorY) {
        this.ripples.push({
          x: this.points.position.x + pos.getX(i),
          y: floorY,
          z: this.points.position.z + pos.getZ(i),
          age: 0,
        });
        y = floorY + 2.1;
      }
      if (hand) {
        const dx = this.points.position.x + pos.getX(i) - hand.x;
        const dy = y - hand.y;
        const dz = this.points.position.z + pos.getZ(i) - hand.z;
        if (dx * dx + dy * dy + dz * dz < 0.03) splashHand = true;
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    return splashHand;
  }
}
