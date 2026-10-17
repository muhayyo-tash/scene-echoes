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
  {
    dest: 'fox.glb',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb',
    license: 'Khronos glTF Sample Assets — Fox',
  },
  {
    dest: 'flamingo.glb',
    url: 'https://raw.githubusercontent.com/mrdoob/three.js/r181/examples/models/gltf/Flamingo.glb',
    license: 'three.js examples — Flamingo (MIT)',
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

const licenses = ['# Model licenses', ''];
for (const model of MODELS) {
  const dest = join(dir, model.dest);
  licenses.push(`- \`${model.dest}\`: ${model.license}`);
  licenses.push(`  ${model.url}`);
  if (existsSync(dest)) {
    console.log('exists', model.dest);
    continue;
  }
  await download(model.url, dest);
}
writeFileSync(join(dir, 'LICENSES.md'), `${licenses.join('\n')}\n`);
console.log('models ready');
