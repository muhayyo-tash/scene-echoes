import type { ManifestObject } from '../assets/types.js';
import { requestPhotoConversion } from './photo-conversion.js';
import type { ModelHandle, ModelProgress, ModelSource } from './types.js';

export class ManifestModelSource implements ModelSource {
  private readonly listeners = new Set<(progress: ModelProgress) => void>();

  constructor(
    private readonly objects: ManifestObject[],
    private readonly loadRoot: (object: ManifestObject) => Promise<unknown>,
  ) {}

  subscribe(listener: (progress: ModelProgress) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async request(id: string, point?: { x: number; y: number }): Promise<ModelHandle> {
    const object = this.objects.find((entry) => entry.id === id);
    if (!object) {
      throw new Error(`Unknown object ${id}`);
    }
    const loadBundled = async (): Promise<ModelHandle> => {
      this.emit({ progress: 0, status: 'processing' });
      const root = await this.loadRoot(object);
      this.emit({ progress: 1, status: 'done' });
      return { object, root, source: 'manifest' };
    };
    if (object.scene === 'furniture') {
      return requestPhotoConversion(
        {
          objectId: id,
          imagePath: object.photo,
          uv: point ?? { x: 0.5, y: 0.5 },
        },
        loadBundled,
      );
    }
    return loadBundled();
  }

  private emit(progress: ModelProgress): void {
    for (const listener of this.listeners) listener(progress);
  }
}
