import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs';
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

try {
  const { NodeIO, getBounds } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const {
    dedup,
    prune,
    resample,
    weld,
    simplify,
    textureCompress,
    meshopt,
    quantize,
  } = await import('@gltf-transform/functions');
  const { MeshoptEncoder, MeshoptSimplifier } = await import('meshoptimizer');
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
      'meshopt.decoder': MeshoptEncoder,
    });

  for (const file of files) {
    const path = join(dir, file);
    const before = statSync(path).size;
    // Already Quest-sized — skip re-work that can re-expand textures.
    if (before < 2_500_000 && file !== 'sofa.glb') {
      console.log('skip small', file, `${(before / 1024).toFixed(0)}KB`);
      continue;
    }
    const doc = await io.read(path);
    const id = file.replace(/\.(glb|gltf)$/, '');
    const entry = manifest.objects.find((object) => (object.model ?? '').includes(id));
    const transforms = [dedup(), weld()];
    // Heavy sofa must be tiny for Quest Browser + GitHub Pages Wi-Fi.
    if (file === 'sofa.glb' || before > 3_000_000) {
      transforms.push(
        simplify({ simplifier: MeshoptSimplifier, ratio: 0.35, error: 0.001 }),
        textureCompress({ targetFormat: 'webp', resize: [1024, 1024] }),
      );
    }
    transforms.push(resample(), prune());
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
    if (file === 'sofa.glb' || before > 3_000_000) {
      transforms.push(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    }
    await doc.transform(...transforms);
    await io.write(path, doc);
    const after = statSync(path).size;
    console.log(
      'optimized',
      file,
      `${(before / 1024 / 1024).toFixed(2)}MB → ${(after / 1024 / 1024).toFixed(2)}MB`,
    );
  }
} catch (error) {
  console.warn('model optimization skipped:', error.message);
}
