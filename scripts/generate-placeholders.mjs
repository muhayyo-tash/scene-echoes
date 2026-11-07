import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writePng } from './png.mjs';
import { writeFilmsIndex } from './list-films.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fill(width, height, paint) {
  const rgba = Buffer.alloc(width * height * 4, 255);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = a;
  };
  paint(set, width, height, rgba);
  return rgba;
}

function rect(set, x, y, w, h, r, g, b, a = 255) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, r, g, b, a);
}

const photos = join(root, 'public/assets/photos');
const masks = join(root, 'public/assets/masks');
const models = join(root, 'public/assets/models');
const movie = join(root, 'public/assets/movie');
mkdirSync(photos, { recursive: true });
mkdirSync(masks, { recursive: true });
mkdirSync(models, { recursive: true });
mkdirSync(movie, { recursive: true });

const sofa = fill(640, 480, (set, w, h) => {
  rect(set, 0, 0, w, Math.floor(h * 0.55), 232, 239, 228);
  rect(set, 0, Math.floor(h * 0.55), w, Math.floor(h * 0.45), 183, 196, 176);
  rect(set, Math.floor(w * 0.18), Math.floor(h * 0.42), Math.floor(w * 0.64), Math.floor(h * 0.38), 107, 143, 113);
  rect(set, Math.floor(w * 0.28), Math.floor(h * 0.52), Math.floor(w * 0.44), Math.floor(h * 0.08), 143, 184, 150);
});
const sofaPng = join(photos, 'sofa.png');
writePng(sofaPng, 640, 480, sofa);

const mask = fill(640, 480, (set, w, h) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, 0, 0, 0, 0);
  rect(set, Math.floor(w * 0.18), Math.floor(h * 0.42), Math.floor(w * 0.64), Math.floor(h * 0.38), 255, 255, 255, 255);
});
writePng(join(masks, 'sofa.png'), 640, 480, mask);

const poster = fill(640, 360, (set, w, h) => {
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.round(159 + (217 - 159) * t);
    const g = Math.round(212 + (240 - 212) * t);
    const b = Math.round(240 + (199 - 240) * t);
    rect(set, 0, y, w, 1, r, g, b);
  }
  rect(set, 0, Math.floor(h * 0.7), w, Math.floor(h * 0.3), 124, 181, 106);
});
const posterPng = join(movie, 'poster.png');
writePng(posterPng, 640, 360, poster);

function toJpeg(pngPath, jpgPath) {
  try {
    execSync(`sips -s format jpeg ${JSON.stringify(pngPath)} --out ${JSON.stringify(jpgPath)}`, {
      stdio: 'ignore',
    });
  } catch {
    writeFileSync(jpgPath, sofa.subarray(0, 0));
    try {
      execSync(`ffmpeg -y -i ${JSON.stringify(pngPath)} ${JSON.stringify(jpgPath)}`, { stdio: 'ignore' });
    } catch {
      writeFileSync(jpgPath.replace(/\.jpg$/, '.png'), '');
    }
  }
}

const sofaJpg = join(photos, 'sofa.jpg');
if (!existsSync(sofaJpg)) {
  toJpeg(sofaPng, sofaJpg);
}
toJpeg(posterPng, join(movie, 'poster.jpg'));

writeFilmsIndex(movie);
console.log('Photos and film poster generated.');
