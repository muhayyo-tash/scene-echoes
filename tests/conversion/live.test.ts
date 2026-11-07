import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManifestModelSource } from '../../src/conversion/manifest-source.js';
import { LiveConversionModelSource } from '../../src/conversion/live/live-conversion.js';
import { LiveFilmProcessing } from '../../src/conversion/live/live-film.js';
import { FilmPreloadProcessing } from '../../src/conversion/film-processing.js';
import { isGlb } from '../../src/conversion/live/http.js';
import { StaticTokenProvider } from '../../src/conversion/live/http.js';

function glbBytes(): ArrayBuffer {
  const bytes = new Uint8Array(12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  return bytes.buffer;
}

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    return handler(url, init);
  }) as typeof fetch;
}

const sofa = [{ id: 'sofa', scene: 'furniture' as const, label: 'sofa', realSize: 2 }];

describe('live conversion client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('polls progress, downloads a GLB, and succeeds', async () => {
    let polls = 0;
    const fetchImpl = mockFetch(async (url) => {
      if (url.endsWith('/v1/conversions') ) {
        return new Response(JSON.stringify({ jobId: 'job-1' }), { status: 202 });
      }
      if (url.includes('/v1/conversions/job-1')) {
        polls += 1;
        if (polls < 2) {
          return new Response(JSON.stringify({ status: 'processing', progress: 0.4 }));
        }
        return new Response(JSON.stringify({ status: 'done', progress: 1, modelUrl: '/models/sofa.glb', realSize: 2, up: 'y' }));
      }
      if (url.endsWith('/models/sofa.glb')) {
        return new Response(glbBytes());
      }
      return new Response('missing', { status: 404 });
    });
    const fallback = new ManifestModelSource(sofa, async (o) => o);
    const live = new LiveConversionModelSource(fallback, {
      apiUrl: () => 'http://localhost:8787',
      token: new StaticTokenProvider('tok'),
      fetchImpl,
      pollSeconds: () => 0,
      timeoutSeconds: () => 30,
      sleep: async () => undefined,
    });
    const handle = await live.request('sofa', { x: 0.5, y: 0.6 });
    expect(handle.source).toBe('live');
    expect(isGlb(handle.root as ArrayBuffer)).toBe(true);
  });

  it('posts a captured still and does not fall back when asked', async () => {
    let posted: { id?: string; image?: string } = {};
    const fetchImpl = mockFetch(async (url, init) => {
      if (url.endsWith('/v1/conversions')) {
        posted = JSON.parse(String(init?.body ?? '{}')) as { id?: string; image?: string };
        return new Response(JSON.stringify({ jobId: 'scene-1' }), { status: 202 });
      }
      if (url.includes('/v1/conversions/scene-1')) {
        return new Response(
          JSON.stringify({ status: 'done', progress: 1, modelUrl: '/models/scene.glb', label: 'flower', realSize: 0.3 }),
        );
      }
      if (url.endsWith('/models/scene.glb')) return new Response(glbBytes());
      return new Response('missing', { status: 404 });
    });
    const fallback = new ManifestModelSource(sofa, async (o) => o);
    const live = new LiveConversionModelSource(fallback, {
      apiUrl: () => 'http://localhost:8787',
      token: new StaticTokenProvider(null),
      fetchImpl,
      pollSeconds: () => 0,
      timeoutSeconds: () => 30,
      sleep: async () => undefined,
    });
    const image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP/AABEIAQEBAf/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAPwA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AfwD/2Q==';
    const handle = await live.request('scene-1', { x: 0.5, y: 0.5, image, allowFallback: false });
    expect(posted.id).toBe('scene-1');
    expect(posted.image).toBe(image);
    expect(handle.source).toBe('live');
  });

  it('throws instead of using a bundled model when fallback is disabled', async () => {
    const fetchImpl = mockFetch(async () => new Response('no', { status: 500 }));
    const fallback = new ManifestModelSource(sofa, async (o) => ({ ok: o.id }));
    const live = new LiveConversionModelSource(fallback, {
      apiUrl: () => 'http://localhost:8787',
      token: new StaticTokenProvider(null),
      fetchImpl,
      pollSeconds: () => 0,
      sleep: async () => undefined,
    });
    await expect(
      live.request('scene-9', { x: 0.5, y: 0.5, image: 'data:image/jpeg;base64,QQ==', allowFallback: false }),
    ).rejects.toBeTruthy();
  });

  it('falls back to the bundled model on failure', async () => {
    const fetchImpl = mockFetch(async () => new Response('no', { status: 500 }));
    const fallback = new ManifestModelSource(sofa, async (o) => ({ ok: o.id }));
    const live = new LiveConversionModelSource(fallback, {
      apiUrl: () => 'http://localhost:8787',
      token: new StaticTokenProvider(null),
      fetchImpl,
      pollSeconds: () => 0,
      sleep: async () => undefined,
    });
    const handle = await live.request('sofa');
    expect(handle.source).toBe('manifest');
  });

  it('falls back on timeout', async () => {
    const fetchImpl = mockFetch(async (url) => {
      if (url.endsWith('/v1/conversions')) return new Response(JSON.stringify({ jobId: 'slow' }), { status: 202 });
      return new Response(JSON.stringify({ status: 'processing', progress: 0.1 }));
    });
    let now = 0;
    const fallback = new ManifestModelSource(sofa, async (o) => o);
    const live = new LiveConversionModelSource(fallback, {
      apiUrl: () => 'http://localhost:8787',
      token: new StaticTokenProvider(null),
      fetchImpl,
      now: () => now,
      timeoutSeconds: () => 0.001,
      pollSeconds: () => 0,
      sleep: async () => {
        now += 20;
      },
    });
    const handle = await live.request('sofa');
    expect(handle.source).toBe('manifest');
  });

  it('falls back on an invalid file', async () => {
    const fetchImpl = mockFetch(async (url) => {
      if (url.endsWith('/v1/conversions')) return new Response(JSON.stringify({ jobId: 'bad' }), { status: 202 });
      if (url.includes('/v1/conversions/bad')) {
        return new Response(JSON.stringify({ status: 'done', progress: 1, modelUrl: '/models/bad.glb' }));
      }
      return new Response(new Uint8Array([1, 2, 3]));
    });
    const fallback = new ManifestModelSource(sofa, async (o) => o);
    const live = new LiveConversionModelSource(fallback, {
      apiUrl: () => 'http://localhost:8787',
      token: new StaticTokenProvider(null),
      fetchImpl,
      pollSeconds: () => 0,
      sleep: async () => undefined,
    });
    const handle = await live.request('sofa');
    expect(handle.source).toBe('manifest');
  });

  it('downloads a live film timeline and models', async () => {
    const applied: Array<{ objectId: string; glb: number }> = [];
    const fetchImpl = mockFetch(async (url) => {
      if (url.endsWith('/v1/films')) return new Response(JSON.stringify({ jobId: 'film' }), { status: 202 });
      if (url.includes('/v1/films/film')) {
        return new Response(
          JSON.stringify({
            status: 'done',
            progress: 1,
            timelineUrl: '/films/film/timeline.json',
            manifestUrl: '/films/film/manifest.json',
          }),
        );
      }
      if (url.endsWith('/timeline.json')) {
        return new Response(
          JSON.stringify({
            moments: [{ id: 'm1', time: 6, objectId: 'live-fox', rect: { x: 0, y: 0, width: 1, height: 1 } }],
          }),
        );
      }
      if (url.endsWith('/manifest.json')) {
        return new Response(
          JSON.stringify({
            objects: [
              {
                id: 'live-fox',
                scene: 'movie',
                label: 'fox',
                realSize: 0.45,
                modelUrl: '/models/live-fox.glb',
              },
            ],
          }),
        );
      }
      if (url.endsWith('/models/live-fox.glb')) return new Response(glbBytes());
      return new Response('missing', { status: 404 });
    });
    const fallback = new FilmPreloadProcessing(null, async (_id, report) => report(1));
    const live = new LiveFilmProcessing(fallback, {
      apiUrl: () => 'http://localhost:8787',
      token: new StaticTokenProvider(null),
      fetchImpl,
      pollSeconds: () => 0,
      sleep: async () => undefined,
      applyLiveFilm: async (result) => {
        applied.push({ objectId: result.objects[0]?.id ?? '', glb: result.glbs['live-fox']?.byteLength ?? 0 });
      },
    });
    await live.start('park');
    expect(live.get('park').status).toBe('ready');
    expect(applied).toEqual([{ objectId: 'live-fox', glb: 12 }]);
  });

  it('processes a film then falls back on live film failure', async () => {
    const okFetch = mockFetch(async (url) => {
      if (url.endsWith('/v1/films')) return new Response(JSON.stringify({ jobId: 'film' }), { status: 202 });
      return new Response(
        JSON.stringify({ status: 'done', progress: 1, timelineUrl: '/t.json', manifestUrl: '/m.json' }),
      );
    });
    const fallback = new FilmPreloadProcessing(null, async (_id, report) => report(1));
    const live = new LiveFilmProcessing(fallback, {
      apiUrl: () => 'http://localhost:8787',
      token: new StaticTokenProvider(null),
      fetchImpl: okFetch,
      pollSeconds: () => 0,
      sleep: async () => undefined,
    });
    await live.start('park');
    expect(live.get('park').status).toBe('ready');

    const preload = new FilmPreloadProcessing(null, async (_id, report) => report(1));
    const bad = new LiveFilmProcessing(preload, {
      apiUrl: () => 'http://localhost:8787',
      token: new StaticTokenProvider(null),
      fetchImpl: mockFetch(async () => new Response('no', { status: 500 })),
      sleep: async () => undefined,
    });
    await bad.start('park');
    expect(preload.get('park').status).toBe('ready');
  });
});
