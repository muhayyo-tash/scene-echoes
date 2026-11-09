import { describe, expect, it } from 'vitest';
import { config } from '../../src/config.js';
import { ManifestModelSource } from '../../src/conversion/manifest-source.js';
import { requestPhotoConversion } from '../../src/conversion/photo-conversion.js';
import { isManifestDefault } from '../../src/conversion/source.js';

describe('manifest conversion', () => {
  it('is the default mode', () => {
    expect(isManifestDefault()).toBe(true);
    expect(config.CONVERSION_MODE).toBe('manifest');
  });

  it('loads the bundled model immediately through ModelSource', async () => {
    const source = new ManifestModelSource(
      [{ id: 'sofa', scene: 'object3d', label: 'sofa', realSize: 2 }],
      async (object) => ({ id: object.id }),
    );
    const progress: number[] = [];
    source.subscribe((p) => progress.push(p.progress));
    const handle = await source.request('sofa', { x: 0.51, y: 0.4 });
    expect(handle.source).toBe('manifest');
    expect(handle.object.id).toBe('sofa');
    expect(progress.at(-1)).toBe(1);
  });

  it('placeholder photo conversion keeps the press UV and returns the bundled model', async () => {
    const uv = { x: 0.51, y: 0.4 };
    const handle = await requestPhotoConversion(
      { objectId: 'sofa', imagePath: 'assets/photos/sofa.jpg', uv },
      async () => ({ object: { id: 'sofa', scene: 'object3d', label: 'sofa', realSize: 1.5 }, root: { uv }, source: 'manifest' }),
    );
    expect(handle.source).toBe('manifest');
    expect(handle.root).toEqual({ uv });
  });
});
