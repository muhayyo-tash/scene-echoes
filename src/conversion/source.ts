import { config, CONVERSION_API_PLACEHOLDER } from '../config.js';
import type { ManifestObject } from '../assets/types.js';
import { debugParams } from '../debug/params.js';
import { FilmPreloadProcessing } from './film-processing.js';
import { LiveConversionModelSource } from './live/live-conversion.js';
import { LiveFilmProcessing } from './live/live-film.js';
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
  });
}

export function createFilmProcessing(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
  preload: FilmPreloadFn,
): FilmProcessing {
  const local = new FilmPreloadProcessing(storage, preload);
  const liveRequested = config.CONVERSION_MODE === 'live' || debugParams.live;
  const liveAllowed = liveRequested && config.CONVERSION_API_URL !== CONVERSION_API_PLACEHOLDER;
  if (!liveAllowed) return local;
  return new LiveFilmProcessing(local, {
    apiUrl: () => config.CONVERSION_API_URL,
    token: new StaticTokenProvider(null),
  });
}

export function isManifestDefault(): boolean {
  return config.CONVERSION_MODE === 'manifest';
}
