import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from 'three';

export function createGhostHand(): Group {
  const group = new Group();
  group.name = 'ghost-hand';
  const mat = new MeshBasicMaterial({
    color: 0x9fd6ff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: DoubleSide,
  });
  const palm = new Mesh(new SphereGeometry(0.035, 12, 10), mat);
  palm.scale.set(1.2, 0.45, 1.6);
  group.add(palm);
  for (let i = 0; i < 4; i++) {
    const finger = new Mesh(new SphereGeometry(0.012, 8, 8), mat);
    finger.scale.set(1, 1, 3.2);
    finger.position.set(-0.03 + i * 0.02, 0.01, -0.06);
    group.add(finger);
  }
  group.visible = false;
  return group;
}

export function playGhostSlide(hand: Group, t: number): void {
  hand.visible = t < 1;
  const x = 0.2 - t * 0.45;
  hand.position.set(x, 1.2, -0.45);
  hand.rotation.set(-0.4, 0.6, 0);
}

export function playGhostPinchHold(hand: Group, t: number, target: { x: number; y: number; z: number }): void {
  hand.visible = t < 1;
  hand.position.set(target.x, target.y, target.z);
  hand.scale.setScalar(0.9 + Math.sin(t * Math.PI * 4) * 0.08);
}
