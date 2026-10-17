import {
  applyConfigPatch,
  config,
  CONVERSION_API_PLACEHOLDER,
  type ConversionMode,
} from '../config.js';

export interface DebugParams {
  debug: boolean;
  openId: string | null;
  objectId: string | null;
  movieReady: boolean;
  reset: boolean;
  fast: boolean;
  startTime: number | null;
  surfacesDefault: boolean;
  handsLess: boolean;
  live: boolean;
}

function flag(params: URLSearchParams, name: string): boolean {
  const value = params.get(name);
  return value === '1' || value === 'true';
}

export function parseDebugParams(
  search = typeof window === 'undefined' ? '' : window.location.search,
): DebugParams {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const start = params.get('t');
  return {
    debug: flag(params, 'debug'),
    openId: params.get('open'),
    objectId: params.get('object'),
    movieReady: params.get('movie') === 'ready',
    reset: flag(params, 'reset'),
    fast: flag(params, 'fast'),
    startTime: start !== null && start !== '' ? Number(start) : null,
    surfacesDefault: params.get('surfaces') === 'default',
    handsLess: flag(params, 'handsless'),
    live: flag(params, 'live'),
  };
}

export function applyDebugParams(params: DebugParams): void {
  if (params.fast) {
    applyConfigPatch({ popOutSeconds: 0.3, bookHoldSeconds: 0.2 });
  }
  if (params.live && config.CONVERSION_API_URL !== CONVERSION_API_PLACEHOLDER) {
    applyConfigPatch({ CONVERSION_MODE: 'live' as ConversionMode });
  }
}

export const debugParams = parseDebugParams();
applyDebugParams(debugParams);
