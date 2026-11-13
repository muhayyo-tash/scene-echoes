#!/usr/bin/env node
/**
 * Offline movie demo prep (Gemini only — no Hugging Face).
 *
 * 1. Samples frames every N seconds from public/assets/movie/<id>.mp4
 * 2. Asks Gemini what the main object in each frame is
 * 3. Writes public/assets/movie/timeline.json
 * 4. Merges movie objects into public/assets/manifest.json
 * 5. Refreshes films.json
 *
 * You still drop matching GLBs at public/assets/models/<objectId>.glb
 * (the script prints which files are missing).
 *
 * Usage:
 *   npm run prepare-film -- <filmId>
 *   npm run prepare-film -- park
 *   npm run prepare-film -- park --every 6 --max 4
 *
 * Requires: GEMINI_API_KEY in .env, ffmpeg + ffprobe on PATH.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geminiText, loadDotenv, parseObjectName } from './live-reconstruct.mjs';
import { writeFilmsIndex } from './list-films.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const movieDir = join(root, 'public/assets/movie');
const modelsDir = join(root, 'public/assets/models');
const manifestPath = join(root, 'public/assets/manifest.json');
const timelinePath = join(movieDir, 'timeline.json');

const FILM_NAME_PROMPT =
  'This is one frame from a short film. Name the one main whole object that should become a 3D prop in the room, in one or two common English words. If the frame is only landscape, sky, or nothing distinct, reply none. If it is weather, reply rain. Do not name people, logos, or parts.';
const SKIP_LABELS = new Set([
  'none',
  'nothing',
  'no',
  'n/a',
  'na',
  'empty',
  'landscape',
  'sky',
  'ground',
  'background',
]);
const EFFECT_LABELS = new Set(['rain', 'snow', 'storm']);
const LABEL_BEHAVIOR = {
  bird: 'fly',
  flamingo: 'fly',
  butterfly: 'fly',
  eagle: 'fly',
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

function usage() {
  console.error(`Usage: npm run prepare-film -- <filmId|path.mp4> [--every 6] [--max 8]

Example: npm run prepare-film -- park
Put park.mp4 in public/assets/movie/ first.`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (!args.length || args.includes('-h') || args.includes('--help')) usage();
  let every = 6;
  let max = 8;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--every') {
      every = Number(args[++i]);
      continue;
    }
    if (a === '--max') {
      max = Number(args[++i]);
      continue;
    }
    positional.push(a);
  }
  if (!positional[0] || !Number.isFinite(every) || every <= 0 || !Number.isFinite(max) || max < 1) {
    usage();
  }
  return { input: positional[0], every, max: Math.floor(max) };
}

function resolveFilm(input) {
  if (input.toLowerCase().endsWith('.mp4') && existsSync(input)) {
    const id = basename(input).replace(/\.mp4$/i, '');
    return { id, path: input };
  }
  const id = input.replace(/\.mp4$/i, '');
  const path = join(movieDir, `${id}.mp4`);
  if (!existsSync(path)) {
    throw new Error(`Missing film: ${path}\nDrop the MP4 there first, then re-run.`);
  }
  return { id, path };
}

function probeDuration(path) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
    { encoding: 'utf8' },
  ).trim();
  const duration = Number(out);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not read film duration (ffprobe)');
  return duration;
}

function extractFrame(path, time, dest) {
  execFileSync('ffmpeg', ['-y', '-ss', String(time), '-i', path, '-frames:v', '1', dest], {
    stdio: 'pipe',
  });
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

function mergeManifest(movieObjects) {
  const current = JSON.parse(readFileSync(manifestPath, 'utf8'));
  // Keep sofa/eagle/etc.; replace previous movie props with this run's set.
  const nonMovie = (current.objects ?? []).filter((o) => o.scene !== 'movie');
  const objects = [...nonMovie, ...movieObjects];
  writeFileSync(manifestPath, `${JSON.stringify({ objects }, null, 2)}\n`);
  return objects;
}

async function main() {
  loadDotenv();
  const { input, every, max } = parseArgs(process.argv);
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY missing. Copy .env.example → .env and set the key.');
  }

  const film = resolveFilm(input);
  const duration = probeDuration(film.path);
  const times = [];
  for (let t = every; t < duration; t += every) times.push(Number(t.toFixed(2)));
  if (!times.length) times.push(Number(Math.min(every, duration / 2).toFixed(2)));

  console.log(
    `[prepare-film] ${film.id}.mp4 — ${duration.toFixed(1)}s, sample every ${every}s → ${times.length} frames (cap ${max} moments)`,
  );

  const frameDir = join(root, 'tmp', 'film-frames', `prepare-${film.id}`);
  mkdirSync(frameDir, { recursive: true });

  const chosen = [];
  for (let i = 0; i < times.length; i++) {
    if (chosen.length >= max) break;
    const time = times[i];
    const dest = join(frameDir, `t${String(time).replace('.', '_')}.jpg`);
    extractFrame(film.path, time, dest);
    const image = { bytes: readFileSync(dest), mime: 'image/jpeg' };
    let label = '';
    try {
      label = parseObjectName(await geminiText(image, FILM_NAME_PROMPT));
    } catch (error) {
      console.warn(`[prepare-film] ${time}s Gemini failed:`, error instanceof Error ? error.message : error);
      continue;
    }
    if (!label || SKIP_LABELS.has(label)) {
      console.log(`[prepare-film] ${time}s skip (${label || 'empty'})`);
      continue;
    }
    const objectId = slug(label);
    const lastSame = [...chosen].reverse().find((item) => item.label === label);
    if (lastSame && time - lastSame.time < every) {
      console.log(`[prepare-film] ${time}s skip duplicate "${label}"`);
      continue;
    }
    const isEffect = EFFECT_LABELS.has(label.split(/\s+/)[0]);
    const behavior = isEffect ? 'rain' : behaviorFor(label);
    chosen.push({
      momentId: `${objectId}-${String(time).replace('.', '_')}`,
      time,
      objectId,
      label,
      kind: isEffect ? 'effect' : 'object',
      behavior,
    });
    console.log(`[prepare-film] ${time}s → ${label} (${objectId}, ${behavior})`);
  }

  if (!chosen.length) {
    throw new Error('No usable objects found in sampled frames. Try another film or a smaller --every.');
  }

  const movieObjects = [];
  const seen = new Set();
  for (const item of chosen) {
    if (seen.has(item.objectId)) continue;
    seen.add(item.objectId);
    const entry = {
      id: item.objectId,
      scene: 'movie',
      kind: item.kind,
      label: item.label,
      realSize: realSizeFor(item.behavior),
      up: 'y',
      behavior: item.behavior,
    };
    if (item.kind !== 'effect') {
      entry.model = `assets/models/${item.objectId}.glb`;
    }
    movieObjects.push(entry);
  }

  const moments = chosen.map((item, index) => ({
    id: item.momentId,
    time: item.time,
    objectId: item.objectId,
    rect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    side: SIDES[index % SIDES.length],
    lifetime: 30,
  }));

  writeFileSync(timelinePath, `${JSON.stringify({ moments }, null, 2)}\n`);
  mergeManifest(movieObjects);
  writeFilmsIndex(movieDir);

  const missing = movieObjects
    .filter((o) => o.kind !== 'effect' && o.model && !existsSync(join(root, 'public', o.model)))
    .map((o) => o.model);

  console.log(`[prepare-film] wrote ${timelinePath} (${moments.length} moments)`);
  console.log(`[prepare-film] updated ${manifestPath} (+${movieObjects.length} movie objects)`);
  console.log(`[prepare-film] refreshed films.json`);
  if (missing.length) {
    console.log('\nAdd these pre-baked GLBs, then re-run npm run validate-timeline:');
    for (const path of missing) console.log(`  public/${path}`);
  } else {
    console.log('[prepare-film] all referenced GLBs are present');
  }
}

main().catch((error) => {
  console.error('[prepare-film]', error instanceof Error ? error.message : error);
  process.exit(1);
});
