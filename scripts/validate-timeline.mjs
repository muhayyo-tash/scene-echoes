import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'public/assets/manifest.json'), 'utf8'));
const timeline = JSON.parse(readFileSync(join(root, 'public/assets/movie/timeline.json'), 'utf8'));
const byId = new Map(manifest.objects.map((o) => [o.id, o]));
const errors = [];
const warnings = [];
let previous = -Infinity;
for (const moment of timeline.moments) {
  const object = byId.get(moment.objectId);
  if (!object) errors.push(`Moment ${moment.id} references missing object ${moment.objectId}`);
  else if (object.scene !== 'movie') errors.push(`Moment ${moment.id} object is not a movie object`);
  else if (object.kind !== 'effect' && object.model && !existsSync(join(root, 'public', object.model))) {
    // prepare-film writes the timeline before GLBs exist — warn, don't fail the build.
    warnings.push(`Moment ${moment.id} model file is missing: ${object.model}`);
  }
  if (!(moment.time > previous)) errors.push(`Moment ${moment.id} time does not increase`);
  const r = moment.rect;
  if (r.x < 0 || r.y < 0 || r.x + r.width > 1.0001 || r.y + r.height > 1.0001) {
    errors.push(`Moment ${moment.id} rect is outside 0..1`);
  }
  if (previous !== -Infinity && moment.time - previous < 6) {
    warnings.push(`Moment ${moment.id} is less than 6 seconds after the previous moment`);
  }
  previous = moment.time;
}
for (const warning of warnings) console.warn(warning);
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log('timeline ok');
