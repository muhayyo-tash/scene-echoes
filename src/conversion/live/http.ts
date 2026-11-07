export interface ConversionJob {
  jobId: string;
}

export interface ConversionStatus {
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: number;
  modelUrl?: string;
  realSize?: number;
  up?: 'y' | 'z';
  error?: string;
  label?: string;
  timelineUrl?: string;
  manifestUrl?: string;
}

export interface TokenProvider {
  getToken(): Promise<string | null>;
}

export class StaticTokenProvider implements TokenProvider {
  constructor(private readonly token: string | null = null) {}
  async getToken(): Promise<string | null> {
    return this.token;
  }
}

export async function postJson(
  url: string,
  body: unknown,
  token: string | null,
  fetchImpl: typeof fetch,
): Promise<Response> {
  return fetchImpl(url, {
    method: 'POST',
    headers: headers(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
}

export async function postForm(
  url: string,
  form: FormData,
  token: string | null,
  fetchImpl: typeof fetch,
): Promise<Response> {
  return fetchImpl(url, {
    method: 'POST',
    headers: headers(token),
    body: form,
  });
}

export async function getJson<T>(
  url: string,
  token: string | null,
  fetchImpl: typeof fetch,
): Promise<T> {
  const response = await fetchImpl(url, { headers: headers(token) });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function getArrayBuffer(
  url: string,
  token: string | null,
  fetchImpl: typeof fetch,
): Promise<ArrayBuffer> {
  const response = await fetchImpl(url, { headers: headers(token) });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  return response.arrayBuffer();
}

function headers(token: string | null, extra: Record<string, string> = {}): HeadersInit {
  const next: Record<string, string> = { ...extra };
  if (token) next.Authorization = `Bearer ${token}`;
  return next;
}

export function isGlb(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 12) return false;
  const view = new DataView(bytes);
  return view.getUint32(0, true) === 0x46546c67;
}

export function joinUrl(base: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
