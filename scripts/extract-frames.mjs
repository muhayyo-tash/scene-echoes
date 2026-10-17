import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePng } from './png.mjs';

const video = process.argv[2];
if (!video) {
  console.log('Usage: npm run extract-frames -- <video>');
  process.exit(0);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tmp/frames');
mkdirSync(out, { recursive: true });
try {
  execSync(`ffmpeg -y -i ${JSON.stringify(video)} -vf fps=1/2 ${JSON.stringify(join(out, 'frame-%06d.png'))}`, {
    stdio: 'inherit',
  });
} catch {
  console.error('ffmpeg is required for extract-frames');
  process.exit(1);
}

const files = readdirSync(out).filter((name) => name.endsWith('.png'));
const ranked = files.map((name, index) => {
  const path = join(out, name);
  const score = laplacianVariance(readFileSync(path));
  return { file: name, time: index * 2, score };
});
ranked.sort((a, b) => b.score - a.score);
const best = ranked.slice(0, 20);
writeFileSync(join(out, 'best.json'), JSON.stringify(best, null, 2));
console.log('wrote', join(out, 'best.json'));
void writePng;

function laplacianVariance(buffer) {
  let sum = 0;
  const n = Math.min(buffer.length, 50000);
  for (let i = 0; i < n; i++) sum += buffer[i];
  const mean = sum / n;
  let v = 0;
  for (let i = 1; i < n - 1; i++) {
    const lap = buffer[i - 1] - 2 * buffer[i] + buffer[i + 1];
    v += (lap - mean) * (lap - mean);
  }
  return v / n;
}
