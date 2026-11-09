import { describe, expect, it } from 'vitest';
import { parseExplorer, parseManifest, pointInHotspot, validateManifestObject } from '../../src/assets/validate.js';
import bundledManifest from '../../public/assets/manifest.json';
import bundledExplorer from '../../public/assets/explorer.json';

describe('manifest and explorer', () => {
  it('parses the bundled files', () => {
    const { manifest, issues } = parseManifest(bundledManifest);
    expect(manifest.objects.some((o) => o.id === 'sofa')).toBe(true);
    expect(manifest.objects.some((o) => o.scene === 'book')).toBe(true);
    expect(manifest.objects.some((o) => o.scene === 'cat')).toBe(false);
    expect(issues.some((i) => i.level === 'error')).toBe(false);
    const { entries } = parseExplorer(bundledExplorer);
    expect(entries.map((e) => e.type)).toEqual(['photo']);
  });

  it('flags a missing required field', () => {
    const issues = validateManifestObject({
      id: 'broken',
      scene: 'object3d',
      label: 'sofa',
      realSize: undefined as unknown as number,
    });
    expect(issues.some((i) => i.message.includes('realSize'))).toBe(true);
  });

  it('tests sofa hotspot containment', () => {
    const hotspot = bundledManifest.objects[0].hotspot;
    expect(hotspot).toBeTruthy();
    if (hotspot && hotspot.type === 'circle') {
      expect(pointInHotspot(0.5, 0.4, hotspot)).toBe(true);
      expect(pointInHotspot(0, 0, hotspot)).toBe(false);
    }
  });
});
