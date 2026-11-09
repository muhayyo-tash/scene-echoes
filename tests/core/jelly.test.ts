import { BoxGeometry, Group, Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { createJellySpring, falloff, stepJellySpring, volumePreservingSquash } from '../../src/core/jelly.js';
import { isOnSeatTop, makePlacedObject, pressSeat, setObjectContacts, updatePlacedObject } from '../../src/scenes/placed-object.js';

describe('jelly', () => {
  it('springs toward a press then settles', () => {
    const spring = createJellySpring();
    for (let i = 0; i < 30; i++) stepJellySpring(spring, 1, 0.016, 90, 8);
    expect(spring.displacement).toBeGreaterThan(0.3);
    for (let i = 0; i < 80; i++) stepJellySpring(spring, 0, 0.016, 90, 8);
    expect(Math.abs(spring.displacement)).toBeLessThan(0.15);
  });

  it('preserves volume when squashing', () => {
    const { y, xz } = volumePreservingSquash(0.8);
    expect(y * xz * xz).toBeCloseTo(1, 5);
  });

  it('falloff is 1 at center and 0 at radius', () => {
    expect(falloff(0, 0.15)).toBe(1);
    expect(falloff(0.15, 0.15)).toBe(0);
  });

  it('presses the sofa seat top and ignores the floor of the mesh', () => {
    const model = new Group();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1));
    mesh.position.y = 0.5;
    model.add(mesh);
    const item = makePlacedObject({ id: 'sofa', scene: 'object3d', label: 'sofa', realSize: 1 }, model);
    item.visual.updateWorldMatrix(true, true);
    expect(isOnSeatTop(item, { x: 0, y: 0.6, z: 0 })).toBe(true);
    expect(isOnSeatTop(item, { x: 0, y: 0.05, z: 0 })).toBe(false);
    pressSeat(item, { x: 0, y: 0.6, z: 0 });
    expect(item.squash.velocity).toBeLessThan(0);
    expect(item.squash.displacement).toBeLessThanOrEqual(0.78);
    setObjectContacts(item, [{ x: 0, y: 0.6, z: 0, strength: 1, time: 0 }]);
    updatePlacedObject(item, 0.016, [], false, false, 0, true);
    expect(item.visual.scale.y).toBeCloseTo(1);
    expect(item.jelly.uDepth.value).toBeGreaterThan(0);
  });
});
