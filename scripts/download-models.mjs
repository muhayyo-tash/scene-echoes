import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public/assets/models');
mkdirSync(dir, { recursive: true });

const MODELS = [
  {
    dest: 'duck.glb',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb',
    license: 'Khronos glTF Sample Assets — Duck',
  },
];

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000 || buf.subarray(0, 4).toString() !== 'glTF') {
    throw new Error(`${url} did not return a GLB (${buf.length} bytes)`);
  }
  writeFileSync(dest, buf);
  console.log('downloaded', dest, buf.length, 'bytes');
}

for (const model of MODELS) {
  const dest = join(dir, model.dest);
  if (existsSync(dest)) {
    console.log('exists', model.dest);
    continue;
  }
  await download(model.url, dest);
}
writeFileSync(
  join(dir, 'LICENSES.md'),
  [
    '# Model licenses',
    '',
    '- `duck.glb`: Khronos glTF Sample Assets — Duck',
    '  https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb',
    '- `sofa.glb`: competition demo asset for the Meta Echoes photo → 3D path (keep for submission)',
    '- `eagle.glb`: local / scene-pinch demo stand-in (safe to remove before submission; not listed in Meta Echoes)',
    '',
  ].join('\n'),
);
console.log('models ready');
