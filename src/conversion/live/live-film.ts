import { config } from '../../config.js';
import type { FilmProcessing, FilmProgress } from '../types.js';
import {
  getJson,
  joinUrl,
  postJson,
  type ConversionJob,
  type ConversionStatus,
  type TokenProvider,
} from './http.js';

export class LiveFilmProcessing implements FilmProcessing {
  private readonly snapshots = new Map<string, FilmProgress>();
  private readonly listeners = new Set<(id: string, progress: FilmProgress) => void>();

  constructor(
    private readonly fallback: FilmProcessing,
    private readonly options: {
      apiUrl: () => string;
      token: TokenProvider;
      fetchImpl?: typeof fetch;
      now?: () => number;
      sleep?: (ms: number) => Promise<void>;
      timeoutSeconds?: () => number;
      pollSeconds?: () => number;
      onComplete?: (timelineUrl: string, manifestUrl: string) => Promise<void>;
    },
  ) {}

  get(filmId: string): FilmProgress {
    return this.snapshots.get(filmId) ?? this.fallback.get(filmId);
  }

  subscribe(listener: (id: string, progress: FilmProgress) => void): () => void {
    this.listeners.add(listener);
    const inner = this.fallback.subscribe(listener);
    return () => {
      this.listeners.delete(listener);
      inner();
    };
  }

  async start(filmId: string): Promise<void> {
    try {
      await this.startLive(filmId);
    } catch (error) {
      console.warn('[scene-echoes] live film processing failed, falling back to local preload', error);
      await this.fallback.start(filmId);
    }
  }

  private async startLive(filmId: string): Promise<void> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const token = await this.options.token.getToken();
    const api = this.options.apiUrl();
    const created = await postJson(
      joinUrl(api, '/v1/films'),
      { filmUrl: `assets/movie/${filmId}.mp4` },
      token,
      fetchImpl,
    );
    if (created.status !== 202) throw new Error(`Unexpected status ${created.status}`);
    const job = (await created.json()) as ConversionJob;
    const started = (this.options.now ?? Date.now)();
    const timeout = (this.options.timeoutSeconds ?? (() => config.filmTimeoutSeconds))() * 1000;
    const poll = (this.options.pollSeconds ?? (() => config.pollIntervalSeconds))() * 1000;
    const sleep = this.options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    this.commit(filmId, { status: 'processing', progress: 0 });
    while (true) {
      if ((this.options.now ?? Date.now)() - started > timeout) {
        throw new Error('Film processing timed out');
      }
      const status = await getJson<ConversionStatus>(
        joinUrl(api, `/v1/films/${job.jobId}`),
        token,
        fetchImpl,
      );
      this.commit(filmId, {
        status: status.status === 'done' ? 'ready' : status.status === 'failed' ? 'failed' : 'processing',
        progress: status.progress ?? 0,
      });
      if (status.status === 'failed') throw new Error(status.error ?? 'failed');
      if (status.status === 'done') {
        if (status.timelineUrl && status.manifestUrl && this.options.onComplete) {
          await this.options.onComplete(status.timelineUrl, status.manifestUrl);
        }
        return;
      }
      await sleep(poll);
    }
  }

  private commit(filmId: string, progress: FilmProgress): void {
    this.snapshots.set(filmId, progress);
    for (const listener of this.listeners) listener(filmId, progress);
  }
}
