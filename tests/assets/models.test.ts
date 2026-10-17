import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import bundledManifest from '../../public/assets/manifest.json';

describe('real bundled models', () => {
  it('points every object at a real GLB that starts with glTF', () => {
    for (const object of bundledManifest.objects) {
      if (object.kind === 'effect') continue;
      expect(object.model, `${object.id} needs a model path`).toBeTruthy();
      const path = `public/${object.model}`;
      expect(existsSync(path), `missing ${path}`).toBe(true);
      const magic = readFileSync(path).subarray(0, 4).toString();
      expect(magic).toBe('glTF');
    }
  });

  it('does not ship placeholder or cat assets', () => {
    const text = JSON.stringify(bundledManifest);
    expect(text).not.toMatch(/placeholder|cat/i);
  });
});
