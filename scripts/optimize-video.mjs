import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const input = process.argv[2];
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'public/assets/movie/park.mp4');
if (!input) {
  console.log('Usage: npm run optimize-video -- <input>');
  process.exit(input ? 1 : 0);
}
if (!existsSync(input)) {
  console.error('missing input', input);
  process.exit(1);
}
try {
  execSync(
    `ffmpeg -y -i ${JSON.stringify(input)} -vf scale='min(1920,iw)':-2 -r 30 -c:v libx264 -pix_fmt yuv420p -b:v 3.5M -c:a aac -b:a 128k -movflags +faststart ${JSON.stringify(output)}`,
    { stdio: 'inherit' },
  );
  execSync(`ffprobe -v error -show_entries format=duration,size -of default=nw=1 ${JSON.stringify(output)}`, {
    stdio: 'inherit',
  });
} catch {
  console.error('ffmpeg is required for optimize-video');
  process.exit(1);
}
