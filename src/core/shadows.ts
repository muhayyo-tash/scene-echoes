import {
  CircleGeometry,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
} from 'three';

export function createContactShadow(radius = 0.25): Mesh {
  const mesh = new Mesh(
    new CircleGeometry(radius, 24),
    new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.name = 'contact-shadow';
  mesh.renderOrder = 1;
  return mesh;
}

export function updateContactShadow(
  shadow: Mesh,
  grounded: boolean,
  lift: number,
  footprint: number,
): void {
  const fade = grounded ? 1 : Math.max(0, 1 - lift * 2);
  (shadow.material as MeshBasicMaterial).opacity = 0.28 * fade;
  shadow.scale.setScalar(Math.max(0.4, footprint * (1.1 + lift)));
  shadow.visible = fade > 0.04;
}
