import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Competition demo ships sofa.glb + eagle.glb in git.
 * This script only ensures the models directory and license notes exist.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public/assets/models');
mkdirSync(dir, { recursive: true });

for (const name of ['sofa.glb', 'eagle.glb']) {
  const path = join(dir, name);
  if (existsSync(path)) console.log('exists', name);
  else console.warn('missing', name, '— add it under public/assets/models/');
}

writeFileSync(
  join(dir, 'LICENSES.md'),
  [
    '# Model licenses',
    '',
    '- `sofa.glb`: competition demo asset for the Meta Echoes photo → 3D path (keep for submission)',
    '- `eagle.glb`: empty-space fist demo / live-API fallback (safe to remove before submission; not listed in Meta Echoes)',
    '',
  ].join('\n'),
);
console.log('models ready');
