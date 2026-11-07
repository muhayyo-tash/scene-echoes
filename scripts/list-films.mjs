import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function listFilmIds(movieDir = join(root, 'public/assets/movie')) {
  if (!existsSync(movieDir)) return [];
  return readdirSync(movieDir)
    .filter((name) => name.toLowerCase().endsWith('.mp4'))
    .map((name) => name.replace(/\.mp4$/i, ''))
    .sort();
}

export function writeFilmsIndex(movieDir = join(root, 'public/assets/movie')) {
  mkdirSync(movieDir, { recursive: true });
  const films = listFilmIds(movieDir);
  writeFileSync(join(movieDir, 'films.json'), `${JSON.stringify({ films }, null, 2)}\n`);
  return films;
}
