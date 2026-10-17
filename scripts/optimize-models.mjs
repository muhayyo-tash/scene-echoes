import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public/assets/models');
if (!existsSync(dir)) {
  console.log('no models directory');
  process.exit(0);
}
const files = readdirSync(dir).filter((name) => name.endsWith('.glb') || name.endsWith('.gltf'));
if (!files.length) {
  console.log('no models to optimize');
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(join(root, 'public/assets/manifest.json'), 'utf8'));
const maxTriangles = 30000;

try {
  const { NodeIO, getBounds } = await import('@gltf-transform/core');
  const { dedup, prune, resample, weld } = await import('@gltf-transform/functions');
  const io = new NodeIO();
  for (const file of files) {
    const path = join(dir, file);
    const doc = await io.read(path);
    await doc.transform(dedup(), weld(), resample(), prune());
    const id = file.replace(/\.(glb|gltf)$/, '');
    const entry = manifest.objects.find((object) => (object.model ?? '').includes(id));
    const rootNode = doc.getRoot().listNodes()[0];
    if (rootNode) {
      const bounds = getBounds(doc.getRoot().listScenes()[0]);
      const size = [
        bounds.max[0] - bounds.min[0],
        bounds.max[1] - bounds.min[1],
        bounds.max[2] - bounds.min[2],
      ];
      const longest = Math.max(...size);
      const realSize = entry?.realSize ?? longest;
      const scale = longest > 0 ? realSize / longest : 1;
      rootNode.setScale(rootNode.getScale().map((v) => v * scale));
      rootNode.setTranslation([
        0,
        -(bounds.min[1] * scale) + (entry?.baseOffset ?? 0),
        0,
      ]);
    }
    void maxTriangles;
    await io.write(path, doc);
    console.log('optimized', file);
  }
} catch (error) {
  console.warn('model optimization skipped:', error.message);
}
