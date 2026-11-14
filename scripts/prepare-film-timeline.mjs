#!/usr/bin/env node
/**
 * Offline movie demo prep (Gemini + Hugging Face).
 *
 * 1. Samples a frame at 1s, then every N seconds (default 5) from public/assets/movie/<id>.mp4
 * 2. Asks Gemini for object + weather (rain/snow/none) per frame
 * 3. Sends object frames to SAM 3D Objects (Hugging Face) and writes the GLB
 * 4. Writes public/assets/movie/timeline.json
 * 5. Merges movie objects into public/assets/manifest.json
 * 6. Refreshes films.json
 *
 * Usage:
 *   npm run prepare-film -- park.mp4
 *   npm run prepare-film -- public/assets/movie/park.mp4
 *   npm run prepare-film -- park.mp4 --every 5 --max 4
 *   npm run prepare-film -- park.mp4 --skip-hf   # timeline only; you drop GLBs yourself
 *
 * Requires: GEMINI_API_KEY + HF_TOKEN in .env (unless --skip-hf), ffmpeg + ffprobe on PATH.
 * The argument must include .mp4 (bare ids like "park" are rejected).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FILM_FRAME_PROMPT,
  geminiText,
  loadDotenv,
  parseFilmFrame,
  reconstructObject,
} from './live-reconstruct.mjs';
import { writeFilmsIndex } from './list-films.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const movieDir = join(root, 'public/assets/movie');
const modelsDir = join(root, 'public/assets/models');
const manifestPath = join(root, 'public/assets/manifest.json');
const timelinePath = join(movieDir, 'timeline.json');

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
  snow: 'snow',
};
const SIDES = ['right', 'low-left', 'left', 'low-right'];

function usage() {
  console.error(`Usage: npm run prepare-film -- <name.mp4|path.mp4> [--every 5] [--max 8] [--skip-hf]

Example: npm run prepare-film -- park.mp4
Samples at 1s, then every N seconds (default 5). Gemini names each frame; HF builds the GLB.
Bare ids without .mp4 are rejected. Use --skip-hf to write the timeline only.`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (!args.length || args.includes('-h') || args.includes('--help')) usage();
  let every = 5;
  let max = 8;
  let skipHf = false;
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
    if (a === '--skip-hf') {
      skipHf = true;
      continue;
    }
    positional.push(a);
  }
  if (!positional[0] || !Number.isFinite(every) || every <= 0 || !Number.isFinite(max) || max < 1) {
    usage();
  }
  return { input: positional[0], every, max: Math.floor(max), skipHf };
}

function resolveFilm(input) {
  if (!input.toLowerCase().endsWith('.mp4')) {
    throw new Error(
      `Film argument must end with .mp4 (got "${input}").\n` +
        `Use: npm run prepare-film -- park.mp4\n` +
        `  or: npm run prepare-film -- public/assets/movie/park.mp4`,
    );
  }
  const id = basename(input).replace(/\.mp4$/i, '');
  if (!id) {
    throw new Error(`Invalid film name: "${input}"`);
  }
  const path = existsSync(input) ? input : join(movieDir, basename(input));
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
  if (behavior === 'rain' || behavior === 'snow') return 1;
  return 0.4;
}

function objectMomentCount(items) {
  return items.filter((item) => item.kind !== 'effect').length;
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
  const { input, every, max, skipHf } = parseArgs(process.argv);
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY missing. Copy .env.example → .env and set the key.');
  }
  if (!skipHf && !process.env.HF_TOKEN) {
    throw new Error(
      'HF_TOKEN missing. Copy .env.example → .env and set the Hugging Face token,\n' +
        'or pass --skip-hf to bake the timeline only and drop GLBs yourself.',
    );
  }

  const film = resolveFilm(input);
  const duration = probeDuration(film.path);
  const first = 1;
  const times = [];
  if (duration > first) {
    for (let t = first; t < duration; t += every) times.push(Number(t.toFixed(2)));
  }
  if (!times.length) times.push(Number(Math.min(first, Math.max(0.1, duration / 2)).toFixed(2)));

  console.log(
    `[prepare-film] ${film.id}.mp4 — ${duration.toFixed(1)}s, frames at ${first}s then every ${every}s → ${times.length} frames (cap ${max} moments)${skipHf ? ' [skip-hf]' : ''}`,
  );

  const frameDir = join(root, 'tmp', 'film-frames', `prepare-${film.id}`);
  mkdirSync(frameDir, { recursive: true });
  mkdirSync(modelsDir, { recursive: true });

  const chosen = [];
  const atmosphere = [];
  const rebuilt = new Set();
  let hfQuotaHit = false;
  let useHf = !skipHf;
  for (let i = 0; i < times.length; i++) {
    if (objectMomentCount(chosen) >= max) break;
    const time = times[i];
    const dest = join(frameDir, `t${String(time).replace('.', '_')}.jpg`);
    extractFrame(film.path, time, dest);
    const image = { bytes: readFileSync(dest), mime: 'image/jpeg' };
    let frame;
    try {
      frame = parseFilmFrame(await geminiText(image, FILM_FRAME_PROMPT));
    } catch (error) {
      console.warn(`[prepare-film] ${time}s Gemini failed:`, error instanceof Error ? error.message : error);
      continue;
    }
    console.log(
      `[prepare-film] ${time}s Gemini → object=${frame.object || 'none'} weather=${frame.weather} theme=${frame.theme ? `${frame.theme.label} ${frame.theme.color}` : 'none'}`,
    );

    if (frame.theme) {
      const lastTheme = atmosphere[atmosphere.length - 1];
      if (!lastTheme || time - lastTheme.time >= every) {
        atmosphere.push({
          id: `atmo-${String(time).replace('.', '_')}`,
          time,
          color: frame.theme.color,
          label: frame.theme.label,
        });
        console.log(`[prepare-film] ${time}s theme → ${frame.theme.label} ${frame.theme.color}`);
      }
    }

    if (frame.weather !== 'none') {
      const lastWeather = [...chosen].reverse().find((item) => item.kind === 'effect');
      if (!lastWeather || time - lastWeather.time >= every) {
        chosen.push({
          momentId: `${frame.weather}-${String(time).replace('.', '_')}`,
          time,
          objectId: frame.weather,
          label: frame.weather,
          kind: 'effect',
          behavior: frame.weather,
        });
        console.log(`[prepare-film] ${time}s weather → ${frame.weather}`);
      }
    }

    const label = frame.object;
    const labelKey = label.split(/\s+/)[0] ?? '';
    if (!label || SKIP_LABELS.has(label) || SKIP_LABELS.has(labelKey)) {
      if (frame.weather === 'none' && !frame.theme) {
        console.log(`[prepare-film] ${time}s skip (no object/weather/theme)`);
      }
      continue;
    }
    const objectId = slug(label);
    const lastSame = [...chosen].reverse().find((item) => item.label === label && item.kind === 'object');
    if (lastSame && time - lastSame.time < every) {
      console.log(`[prepare-film] ${time}s skip duplicate "${label}"`);
      continue;
    }
    const behavior = behaviorFor(label);

    if (useHf && !rebuilt.has(objectId)) {
      const outPath = join(modelsDir, `${objectId}.glb`);
      if (existsSync(outPath)) {
        rebuilt.add(objectId);
        console.log(`[prepare-film] ${time}s reuse existing public/assets/models/${objectId}.glb`);
      } else {
        const started = Date.now();
        console.log(`[prepare-film] ${time}s reconstructing "${label}" via Hugging Face…`);
        try {
          const glb = await reconstructObject(image, label);
          writeFileSync(outPath, glb);
          rebuilt.add(objectId);
          console.log(
            `[prepare-film] wrote public/assets/models/${objectId}.glb (${glb.length} bytes, ${((Date.now() - started) / 1000).toFixed(1)}s)`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[prepare-film] ${time}s HF reconstruct failed:`, message);
          if (/quota|ZeroGPU|exceeded/i.test(message)) {
            hfQuotaHit = true;
            useHf = false;
            console.warn(
              '[prepare-film] HF quota hit — continuing timeline/theme only (no more GLB calls). Re-run later for GLBs.',
            );
            // Keep the moment in the timeline; GLB can be filled on a later run.
          } else {
            continue;
          }
        }
      }
    } else if (useHf && rebuilt.has(objectId)) {
      console.log(`[prepare-film] ${time}s reuse existing ${objectId}.glb`);
    } else if (!useHf) {
      // Timeline-only: still record the object; GLB may be missing until a later HF run.
      console.log(`[prepare-film] ${time}s timeline-only "${label}" (no HF)`);
    }

    chosen.push({
      momentId: `${objectId}-${String(time).replace('.', '_')}`,
      time,
      objectId,
      label,
      kind: 'object',
      behavior,
    });
    console.log(`[prepare-film] ${time}s → ${label} (${objectId}, ${behavior})`);
  }

  if (hfQuotaHit) {
    console.warn('[prepare-film] finished with HF quota limited; some GLBs may be missing.');
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

  writeFileSync(timelinePath, `${JSON.stringify({ moments, atmosphere }, null, 2)}\n`);
  mergeManifest(movieObjects);
  writeFilmsIndex(movieDir);

  const missing = movieObjects
    .filter((o) => o.kind !== 'effect' && o.model && !existsSync(join(root, 'public', o.model)))
    .map((o) => o.model);

  console.log(
    `[prepare-film] wrote ${timelinePath} (${moments.length} moments, ${atmosphere.length} atmosphere cues)`,
  );
  console.log(`[prepare-film] updated ${manifestPath} (+${movieObjects.length} movie objects)`);
  console.log(`[prepare-film] refreshed films.json`);
  if (missing.length) {
    console.log('\nStill missing GLBs (HF skipped or failed):');
    for (const path of missing) console.log(`  public/${path}`);
    console.log('Add them manually, or re-run without --skip-hf.');
  } else {
    console.log('[prepare-film] all referenced GLBs are present');
  }
  console.log('Next: npm run validate-timeline');
}

main().catch((error) => {
  console.error('[prepare-film]', error instanceof Error ? error.message : error);
  process.exit(1);
});
