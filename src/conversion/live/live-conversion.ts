import { config } from '../../config.js';
import type { ManifestObject } from '../../assets/types.js';
import type { ModelHandle, ModelProgress, ModelSource } from '../types.js';
import {
  getArrayBuffer,
  getJson,
  isGlb,
  joinUrl,
  postForm,
  type ConversionJob,
  type ConversionStatus,
  type TokenProvider,
} from './http.js';

export class LiveConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveConversionError';
  }
}

export class LiveConversionModelSource implements ModelSource {
  private readonly listeners = new Set<(progress: ModelProgress) => void>();

  constructor(
    private readonly fallback: ModelSource,
    private readonly options: {
      apiUrl: () => string;
      token: TokenProvider;
      fetchImpl?: typeof fetch;
      now?: () => number;
      sleep?: (ms: number) => Promise<void>;
      timeoutSeconds?: () => number;
      pollSeconds?: () => number;
      parseModel?: (bytes: ArrayBuffer, status: ConversionStatus) => Promise<ModelHandle>;
    },
  ) {}

  subscribe(listener: (progress: ModelProgress) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async request(id: string, point?: { x: number; y: number }): Promise<ModelHandle> {
    try {
      return await this.requestLive(id, point);
    } catch (error) {
      if (config.CONVERSION_MODE === 'live') {
        console.warn('[scene-echoes] live conversion failed, falling back to bundled model', error);
      }
      this.emit({ progress: 0, status: 'processing' });
      return this.fallback.request(id, point);
    }
  }

  private async requestLive(id: string, point?: { x: number; y: number }): Promise<ModelHandle> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const token = await this.options.token.getToken();
    const api = this.options.apiUrl();
    const form = new FormData();
    form.append('id', id);
    form.append('x', String(point?.x ?? 0.5));
    form.append('y', String(point?.y ?? 0.5));
    const created = await postForm(joinUrl(api, '/v1/conversions'), form, token, fetchImpl);
    if (created.status !== 202) {
      throw new LiveConversionError(`Unexpected status ${created.status}`);
    }
    const job = (await created.json()) as ConversionJob;
    const started = (this.options.now ?? Date.now)();
    const timeout = (this.options.timeoutSeconds ?? (() => config.conversionTimeoutSeconds))() * 1000;
    const poll = (this.options.pollSeconds ?? (() => config.pollIntervalSeconds))() * 1000;
    const sleep = this.options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    let status: ConversionStatus = { status: 'queued', progress: 0 };
    while (true) {
      if ((this.options.now ?? Date.now)() - started > timeout) {
        throw new LiveConversionError('Conversion timed out');
      }
      status = await getJson<ConversionStatus>(
        joinUrl(api, `/v1/conversions/${job.jobId}`),
        token,
        fetchImpl,
      );
      this.emit({
        progress: status.progress ?? 0,
        status: status.status === 'done' ? 'done' : status.status === 'failed' ? 'failed' : 'processing',
      });
      if (status.status === 'failed') throw new LiveConversionError(status.error ?? 'failed');
      if (status.status === 'done') break;
      await sleep(poll);
    }
    if (!status.modelUrl) throw new LiveConversionError('Missing modelUrl');
    const bytes = await getArrayBuffer(joinUrl(api, status.modelUrl), token, fetchImpl);
    if (!isGlb(bytes)) throw new LiveConversionError('invalid file');
    if (this.options.parseModel) {
      return this.options.parseModel(bytes, status);
    }
    const object: ManifestObject = {
      id,
      scene: 'furniture',
      label: id,
      realSize: status.realSize ?? 1,
      up: status.up ?? 'y',
    };
    return { object, root: bytes, source: 'live' };
  }

  private emit(progress: ModelProgress): void {
    for (const listener of this.listeners) listener(progress);
  }
}
