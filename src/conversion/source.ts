import { config, CONVERSION_API_PLACEHOLDER } from '../config.js';
import { applyManifestScale, assetUrl, loadGlbBytes } from '../assets/loaders.js';
import type { ManifestObject } from '../assets/types.js';
import { debugParams } from '../debug/params.js';
import { FilmPreloadProcessing } from './film-processing.js';
import { LiveConversionModelSource } from './live/live-conversion.js';
import { LiveFilmProcessing, type LiveFilmResult } from './live/live-film.js';

export type { LiveFilmResult };
import { StaticTokenProvider } from './live/http.js';
import { ManifestModelSource } from './manifest-source.js';
import type { FilmProcessing, ModelSource } from './types.js';

export type FilmPreloadFn = (filmId: string, report: (progress: number) => void) => Promise<void>;

export function createModelSource(
  objects: ManifestObject[],
  loadRoot: (object: ManifestObject) => Promise<unknown>,
): ModelSource {
  const manifest = new ManifestModelSource(objects, loadRoot);
  const liveRequested = config.CONVERSION_MODE === 'live' || debugParams.live;
  const liveAllowed = liveRequested && config.CONVERSION_API_URL !== CONVERSION_API_PLACEHOLDER;
  if (!liveAllowed) return manifest;
  return new LiveConversionModelSource(manifest, {
    apiUrl: () => config.CONVERSION_API_URL,
    token: new StaticTokenProvider(null),
    photoUrl: (id) => {
      const object = objects.find((entry) => entry.id === id);
      return object?.photo ? assetUrl(object.photo) : null;
    },
    parseModel: async (bytes, status, id) => {
      const catalog = objects.find((entry) => entry.id === id);
      const object: ManifestObject = {
        ...(catalog ?? { id, scene: 'furniture', label: id, realSize: status.realSize ?? 1 }),
        label: status.label ?? catalog?.label ?? id,
        realSize: status.realSize ?? catalog?.realSize ?? 1,
        up: status.up ?? catalog?.up ?? 'y',
      };
      const root = await loadGlbBytes(bytes);
      applyManifestScale(root, object);
      return { object, root, source: 'live' };
    },
  });
}

export function createFilmProcessing(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
  preload: FilmPreloadFn,
  applyLiveFilm?: (result: LiveFilmResult) => Promise<void>,
): FilmProcessing {
  const local = new FilmPreloadProcessing(storage, preload);
  const liveRequested = config.CONVERSION_MODE === 'live' || debugParams.live;
  const liveAllowed = liveRequested && config.CONVERSION_API_URL !== CONVERSION_API_PLACEHOLDER;
  if (!liveAllowed) return local;
  return new LiveFilmProcessing(local, {
    apiUrl: () => config.CONVERSION_API_URL,
    token: new StaticTokenProvider(null),
    timeoutSeconds: () => config.filmTimeoutSeconds,
    applyLiveFilm,
  });
}

export function isManifestDefault(): boolean {
  return config.CONVERSION_MODE === 'manifest';
}
