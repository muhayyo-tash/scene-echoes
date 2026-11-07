import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import type { HandSample } from '../core/hands.js';

export class SimulatedHand {
  readonly mesh: Mesh;
  position = new Vector3(0.15, 1.1, -0.45);
  pinch = false;
  fist = false;
  palm = false;
  planeZ = -0.45;

  constructor() {
    this.mesh = new Mesh(new SphereGeometry(0.03, 12, 10), new MeshBasicMaterial({ color: 0x9fd6ff }));
  }

  sample(): HandSample {
    const p = { x: this.position.x, y: this.position.y, z: this.position.z };
    const thumb = this.pinch
      ? { x: p.x + 0.005, y: p.y, z: p.z }
      : { x: p.x + 0.04, y: p.y, z: p.z };
    return {
      handedness: 'right',
      tracked: true,
      joints: {
        wrist: p,
        'index-finger-tip': p,
        'thumb-tip': thumb,
        'middle-finger-phalanx-proximal': p,
      },
      indexTip: p,
      thumbTip: thumb,
      palm: p,
      palmNormal: { x: 0, y: this.palm ? -1 : 0, z: this.palm ? 0 : -1 },
      wrist: p,
      rayOrigin: p,
      rayDirection: { x: 0, y: 0, z: -1 },
    };
  }
}
