import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = join(root, 'tmp', 'conversions');
const SPACE = 'https://dev-bjoern-sam3d-objects-mcp.hf.space';
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];
const NAME_PROMPT =
  'The red circle marks one object. Name the whole object in one or two common English words. If it is a couch, say sofa not armchair. Do not name a part (not cushion, arm, fabric, wall, or floor). Reply with only those words.';
const COORD_PROMPT = (x, y) =>
  `A user tapped at ${x.toFixed(2)} from the left and ${y.toFixed(2)} from the top (0 is top-left, 1 is bottom-right). Name the whole object at that point in one or two common English words. Do not name a part. Reply with only those words.`;

export const jobs = new Map();
let seq = 1;

function hfAuthHeaders(extra = {}) {
  const token = process.env.HF_TOKEN;
  if (!token) return extra;
  return { ...extra, Authorization: `Bearer ${token}` };
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function log(...args) {
  console.log(`[${nowStamp()}]`, ...args);
}

function warn(...args) {
  console.warn(`[${nowStamp()}]`, ...args);
}

function secondsSince(startMs) {
  return ((Date.now() - startMs) / 1000).toFixed(1);
}

export function loadDotenv() {
  const path = join(root, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eq = trimmed.indexOf('=');
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function parseObjectName(raw) {
  let line = String(raw ?? '')
    .trim()
    .split('\n')[0] ?? '';
  line = line.replace(/^["'`]+|["'`]+$/g, '').trim();
  line = line.replace(
    /^(the object is|the object marked is|it is|this is|that is|that's|the item is)\s+/i,
    '',
  );
  line = line.replace(/^(a|an|the)\s+/i, '');
  line = line.replace(/[.!?]+$/g, '');
  const words = line
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.join(' ');
}

export function createJob() {
  const id = `job-${seq++}`;
  const job = {
    id,
    status: 'queued',
    progress: 0,
    modelPath: null,
    timelinePath: null,
    manifestPath: null,
    files: {},
    label: '',
    error: null,
    realSize: 0.5,
    up: 'y',
  };
  jobs.set(id, job);
  return job;
}

export function jobStatus(job) {
  return {
    status: job.status,
    progress: job.progress,
    modelUrl: job.modelPath ? `/models/${job.id}.glb` : undefined,
    timelineUrl: job.timelinePath ? `/films/${job.id}/timeline.json` : undefined,
    manifestUrl: job.manifestPath ? `/films/${job.id}/manifest.json` : undefined,
    realSize: job.realSize,
    up: job.up,
    label: job.label || undefined,
    error: job.error || undefined,
  };
}

export function filmJson(job, name) {
  if (name === 'timeline.json' && job.timelinePath && existsSync(job.timelinePath)) {
    return readFileSync(job.timelinePath);
  }
  if (name === 'manifest.json' && job.manifestPath && existsSync(job.manifestPath)) {
    return readFileSync(job.manifestPath);
  }
  return null;
}

function decodeDataUrlOrBase64(value) {
  if (!value) return null;
  const match = String(value).match(/^data:([^;]+);base64,(.+)$/);
  if (match) return { mime: match[1], bytes: Buffer.from(match[2], 'base64') };
  return { mime: 'image/jpeg', bytes: Buffer.from(String(value), 'base64') };
}

async function markTapOnImage(image, x, y) {
  const sharp = (await import('sharp')).default;
  const base = sharp(image.bytes);
  const { width, height } = await base.metadata();
  if (!width || !height) return image;
  const cx = Math.round(x * width);
  const cy = Math.round(y * height);
  const r = Math.max(12, Math.round(Math.min(width, height) * 0.045));
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="${Math.max(4, Math.round(r * 0.28))}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ff2a2a" stroke-width="${Math.max(3, Math.round(r * 0.2))}"/>
      <circle cx="${cx}" cy="${cy}" r="${Math.round(r * 0.22)}" fill="#ff2a2a"/>
    </svg>`,
  );
  const bytes = await base.composite([{ input: svg }]).jpeg({ quality: 88 }).toBuffer();
  return { bytes, mime: 'image/jpeg' };
}

function photoFromManifest(id) {
  const manifestPath = join(root, 'public/assets/manifest.json');
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const object = manifest.objects?.find((entry) => entry.id === id);
  if (!object?.photo) return null;
  const path = join(root, 'public', object.photo);
  if (!existsSync(path)) return null;
  return { bytes: readFileSync(path), mime: path.endsWith('.png') ? 'image/png' : 'image/jpeg' };
}

export async function geminiText(image, prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is missing');
  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: image.mime, data: image.bytes.toString('base64') } },
          { text: prompt },
        ],
      },
    ],
  };
  let lastError = 'Gemini request failed';
  for (const model of GEMINI_MODELS) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify(body),
      },
    );
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      lastError = json.error?.message || `Gemini ${response.status}`;
      continue;
    }
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text).join(' ') ?? '';
    const name = parseObjectName(text);
    if (name) {
      log(`[conversion] Gemini (${model}) named: ${name}`);
      return name;
    }
    lastError = 'Gemini returned an empty name';
  }
  throw new Error(lastError);
}

export async function geminiName({ marked, original, x, y }) {
  if (!original && !marked) throw new Error('No image to name');
  let image = marked;
  if (!image && original) {
    try {
      image = await markTapOnImage(original, x, y);
    } catch {
      image = original;
    }
  }
  const prompt = image === original ? COORD_PROMPT(x, y) : NAME_PROMPT;
  return geminiText(image, prompt);
}

async function uploadGradio(bytes, filename) {
  const form = new FormData();
  form.append('files', new Blob([bytes]), filename);
  const response = await fetch(`${SPACE}/gradio_api/upload`, {
    method: 'POST',
    headers: hfAuthHeaders(),
    body: form,
  });
  if (!response.ok) throw new Error(`Gradio upload ${response.status}`);
  const json = await response.json();
  const path = Array.isArray(json) ? json[0] : json;
  if (!path) throw new Error('Gradio upload missing path');
  return path;
}

async function reconstructObject(image, prompt) {
  const uploaded = await uploadGradio(image.bytes, 'photo.jpg');
  const started = await fetch(`${SPACE}/gradio_api/call/reconstruct_objects`, {
    method: 'POST',
    headers: hfAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      data: [{ path: uploaded, meta: { _type: 'gradio.FileData' } }, prompt],
    }),
  });
  if (!started.ok) throw new Error(`SAM 3D start ${started.status}`);
  const created = await started.json();
  const eventId = created.event_id || created.eventId;
  if (!eventId) throw new Error('SAM 3D missing event id');
  const stream = await fetch(`${SPACE}/gradio_api/call/reconstruct_objects/${eventId}`, {
    headers: hfAuthHeaders(),
  });
  if (!stream.ok) throw new Error(`SAM 3D poll ${stream.status}`);
  const text = await stream.text();
  const complete = [...text.matchAll(/event: complete\ndata: (.*)/g)].pop();
  const errorEvent = [...text.matchAll(/event: error\ndata: (.*)/g)].pop();
  if (errorEvent) throw new Error(String(errorEvent[1]).slice(0, 300));
  if (!complete) throw new Error('SAM 3D produced no result');
  const payload = JSON.parse(complete[1]);
  const file = Array.isArray(payload) ? payload[0] : payload;
  const url = file?.url || file?.path;
  if (!url) throw new Error('SAM 3D missing GLB url');
  const glbUrl = url.startsWith('http') ? url : `${SPACE}/gradio_api/file=${url}`;
  const glb = await fetch(glbUrl, { headers: hfAuthHeaders() });
  if (!glb.ok) throw new Error(`GLB download ${glb.status}`);
  const bytes = Buffer.from(await glb.arrayBuffer());
  if (bytes.length < 12 || bytes.subarray(0, 4).toString() !== 'glTF') {
    throw new Error('SAM 3D did not return a GLB');
  }
  return bytes;
}

export async function runConversion(job, input) {
  try {
    job.status = 'processing';
    job.progress = 0.1;
    const original = decodeDataUrlOrBase64(input.image) ?? photoFromManifest(input.id);
    const marked = decodeDataUrlOrBase64(input.marked);
    if (!original) throw new Error('No photo for conversion');
    job.progress = 0.25;
    const label = await geminiName({
      marked,
      original,
      x: Number(input.x ?? 0.5),
      y: Number(input.y ?? 0.5),
    });
    job.label = label;
    job.progress = 0.4;
    const reconstructStarted = Date.now();
    log(
      `[conversion] reconstructing "${label}" via SAM 3D Objects (HF auth ${process.env.HF_TOKEN ? 'on' : 'off'})`,
    );
    const glb = await reconstructObject(original, label);
    mkdirSync(tmpDir, { recursive: true });
    const out = join(tmpDir, `${job.id}.glb`);
    writeFileSync(out, glb);
    job.modelPath = out;
    job.progress = 1;
    job.status = 'done';
    log(
      `[conversion] ${job.id} ready (${glb.length} bytes, label=${label}, ${secondsSince(reconstructStarted)}s)`,
    );
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
    warn('[conversion] failed:', job.error);
  }
}

export function modelBytes(name) {
  const id = String(name).replace(/\.glb$/, '');
  for (const job of jobs.values()) {
    if (job.files?.[id] && existsSync(job.files[id])) return readFileSync(job.files[id]);
    if (job.id === id && job.modelPath && existsSync(job.modelPath)) return readFileSync(job.modelPath);
  }
  const loose = join(tmpDir, `${id}.glb`);
  return existsSync(loose) ? readFileSync(loose) : null;
}

const FILM_SAMPLE_SECONDS = 6;
const FILM_MAX_RECONSTRUCTS = 4;
const FILM_NAME_PROMPT =
  'This is one frame from a short film. Name the one main whole object that should become a 3D prop in the room, in one or two common English words. If the frame is only landscape, sky, or nothing distinct, reply none. If it is weather, reply rain. Do not name people, logos, or parts.';
const SKIP_LABELS = new Set(['none', 'nothing', 'no', 'n/a', 'na', 'empty', 'landscape', 'sky', 'ground', 'background']);
const EFFECT_LABELS = new Set(['rain', 'snow', 'storm']);
const LABEL_BEHAVIOR = {
  bird: 'fly',
  flamingo: 'fly',
  butterfly: 'fly',
  dog: 'walk',
  fox: 'walk',
  horse: 'walk',
  tree: 'sway',
  flower: 'sway',
  grass: 'sway',
  bench: 'sway',
  leaf: 'drift',
  petal: 'drift',
  rain: 'rain',
};
const SIDES = ['right', 'low-left', 'left', 'low-right'];

function filmPath(input) {
  const url = String(input.filmUrl ?? '');
  const id = String(input.filmId ?? url.split('/').pop()?.replace(/\.mp4$/i, '') ?? '');
  if (!id) throw new Error('Missing film id');
  const direct = join(root, 'public/assets/movie', `${id}.mp4`);
  if (existsSync(direct)) return { id, path: direct };
  const fromUrl = join(root, 'public', url.replace(/^\.?\//, ''));
  if (existsSync(fromUrl)) return { id, path: fromUrl };
  return { id, path: direct };
}

function probeDuration(path) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
    { encoding: 'utf8' },
  ).trim();
  const duration = Number(out);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not read film duration');
  return duration;
}

function extractFrame(path, time, dest) {
  execFileSync(
    'ffmpeg',
    ['-y', '-ss', String(time), '-i', path, '-frames:v', '1', dest],
    { stdio: 'pipe' },
  );
}

function slug(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'object';
}

function behaviorFor(label) {
  const parts = label.toLowerCase().split(/\s+/);
  for (const part of parts) {
    if (LABEL_BEHAVIOR[part]) return LABEL_BEHAVIOR[part];
  }
  return 'hover';
}

function realSizeFor(behavior) {
  if (behavior === 'fly') return 0.28;
  if (behavior === 'walk') return 0.45;
  if (behavior === 'rain') return 1;
  return 0.4;
}

export async function runFilm(job, input) {
  try {
    job.status = 'processing';
    job.progress = 0.05;
    job.files = job.files ?? {};
    const film = filmPath(input);
    if (!existsSync(film.path)) throw new Error(`Missing film ${film.path}`);
    const duration = probeDuration(film.path);
    const times = [];
    for (let t = FILM_SAMPLE_SECONDS; t < duration; t += FILM_SAMPLE_SECONDS) times.push(t);
    if (!times.length) times.push(Math.min(FILM_SAMPLE_SECONDS, duration / 2));
    log(`[conversion] ${job.id} sampling ${times.length} frames every ${FILM_SAMPLE_SECONDS}s from ${duration.toFixed(1)}s ${film.id}`);
    const frameDir = join(root, 'tmp', 'film-frames', job.id);
    mkdirSync(frameDir, { recursive: true });
    const chosen = [];
    const reconstructed = new Map();
    let reconstructs = 0;
    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      const dest = join(frameDir, `t${String(time).replace('.', '_')}.jpg`);
      extractFrame(film.path, time, dest);
      job.progress = 0.1 + (i / times.length) * 0.25;
      const image = { bytes: readFileSync(dest), mime: 'image/jpeg' };
      let label = '';
      try {
        label = await geminiText(image, FILM_NAME_PROMPT);
      } catch (error) {
        warn(`[conversion] ${job.id} frame ${time}s name failed:`, error instanceof Error ? error.message : error);
        continue;
      }
      if (!label || SKIP_LABELS.has(label)) {
        log(`[conversion] ${job.id} ${time}s skip (${label || 'empty'})`);
        continue;
      }
      const objectId = `live-${slug(label)}`;
      const lastSame = [...chosen].reverse().find((item) => item.label === label);
      if (lastSame && time - lastSame.time < FILM_SAMPLE_SECONDS) continue;
      if (EFFECT_LABELS.has(label.split(' ')[0])) {
        chosen.push({
          id: `${objectId}-${time}`,
          time,
          objectId,
          label,
          kind: 'effect',
          behavior: 'rain',
        });
        continue;
      }
      if (!reconstructed.has(objectId) && reconstructs < FILM_MAX_RECONSTRUCTS) {
        const started = Date.now();
        log(`[conversion] ${job.id} ${time}s reconstructing "${label}"`);
        try {
          const glb = await reconstructObject(image, label);
          mkdirSync(tmpDir, { recursive: true });
          const out = join(tmpDir, `${objectId}.glb`);
          writeFileSync(out, glb);
          reconstructed.set(objectId, { path: out, label });
          job.files[objectId] = out;
          reconstructs += 1;
          log(`[conversion] ${job.id} ${objectId} ready (${glb.length} bytes, ${secondsSince(started)}s)`);
        } catch (error) {
          warn(`[conversion] ${job.id} ${time}s reconstruct failed:`, error instanceof Error ? error.message : error);
          continue;
        }
      }
      if (!reconstructed.has(objectId) && !EFFECT_LABELS.has(label.split(' ')[0])) continue;
      chosen.push({
        id: `${objectId}-${time}`,
        time,
        objectId,
        label,
        kind: 'object',
        behavior: behaviorFor(label),
      });
      job.progress = 0.35 + (reconstructs / FILM_MAX_RECONSTRUCTS) * 0.55;
    }
    if (!chosen.length) throw new Error('No usable objects in film frames');
    const objects = [];
    const seen = new Set();
    for (const item of chosen) {
      if (seen.has(item.objectId)) continue;
      seen.add(item.objectId);
      const behavior = item.behavior;
      objects.push({
        id: item.objectId,
        scene: 'movie',
        kind: item.kind,
        label: item.label,
        realSize: realSizeFor(behavior),
        up: 'y',
        behavior,
        model: item.kind === 'effect' ? undefined : `/models/${item.objectId}.glb`,
        modelUrl: item.kind === 'effect' ? undefined : `/models/${item.objectId}.glb`,
      });
    }
    const moments = chosen.map((item, index) => ({
      id: item.id,
      time: item.time,
      objectId: item.objectId,
      rect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      side: SIDES[index % SIDES.length],
      lifetime: 30,
    }));
    const filmDir = join(root, 'tmp', 'films', job.id);
    mkdirSync(filmDir, { recursive: true });
    job.timelinePath = join(filmDir, 'timeline.json');
    job.manifestPath = join(filmDir, 'manifest.json');
    writeFileSync(job.timelinePath, JSON.stringify({ moments }, null, 2));
    writeFileSync(job.manifestPath, JSON.stringify({ objects }, null, 2));
    job.progress = 1;
    job.status = 'done';
    log(`[conversion] ${job.id} film ready (${moments.length} moments, ${objects.length} objects)`);
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
    warn('[conversion] film failed:', job.error);
  }
}
