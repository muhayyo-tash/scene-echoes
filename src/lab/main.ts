import {
  Box3,
  Clock,
  Color,
  GridHelper,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  Group,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { config, DEFAULTS, resetConfig, applyConfigPatch, type AppConfig } from '../config.js';
import { loadModel, measureModel } from '../assets/loaders.js';
import bundledManifest from '../../public/assets/manifest.json';
import { parseManifest } from '../assets/validate.js';
import { ConversionAnimation } from '../conversion/animation.js';
import { conversionPhase } from '../conversion/phases.js';
import { makeFurniture, updateFurniture } from '../scenes/furniture.js';
import { SimulatedHand } from './hand.js';
import { createContactShadow } from '../core/shadows.js';

const canvas = document.getElementById('lab') as HTMLCanvasElement;
const readout = document.getElementById('readout')!;
const controlsEl = document.getElementById('controls')!;
readout.textContent = 'Loading real GLB models…';

const renderer = new WebGLRenderer({ canvas, antialias: true });
const scene = new Scene();
scene.background = new Color('#d9e4dc');
const camera = new PerspectiveCamera(50, 1, 0.01, 50);
camera.position.set(1.4, 1.2, 2.2);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.6, 0);
scene.add(new AmbientLight(0xffffff, 0.7), new DirectionalLight(0xfff1d6, 0.6));
scene.add(new GridHelper(4, 4, 0x88aa99, 0xaacbbb));
const table = new Mesh(new BoxGeometry(1.2, 0.05, 0.7), new MeshStandardMaterial({ color: 0x8b6914 }));
table.position.set(0, 0.7, 0);
scene.add(table);

const hand = new SimulatedHand();
scene.add(hand.mesh);

const { manifest } = parseManifest(bundledManifest);
const sofaObject = manifest.objects.find((item) => item.scene === 'furniture');
const bookObject = manifest.objects.find((item) => item.scene === 'book');
const birdObject = manifest.objects.find((item) => item.label === 'bird');
if (!sofaObject?.model || !bookObject?.model || !birdObject?.model) {
  throw new Error('Lab requires real GLB paths on sofa, book and bird objects');
}
const sofaDef = sofaObject;
const bookDef = bookObject;
const birdDef = birdObject;

let tab = 'conversion';
const paused = false;
const slow = 1;
const clock = new Clock();
const conversion = new ConversionAnimation();
scene.add(conversion.group);

const sofaModel = await loadModel(sofaDef);
const furniture = makeFurniture(sofaDef, sofaModel);
furniture.root.position.set(0, 0, 0);
scene.add(furniture.root);

const bookModel = await loadModel(bookDef);
const book = makeFurniture(bookDef, bookModel);
book.root.position.set(0, 0.7, 0);
scene.add(book.root);

const bird = await loadModel(birdDef);
bird.position.set(0.4, 1.1, 0);
scene.add(bird);

const conversionModel = await loadModel(sofaDef);
conversion.attachModel(conversionModel);
conversion.start(new Vector3(0, 1, 0), false);

function resize(): void {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

canvas.addEventListener('pointermove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  hand.position.set(x * 0.8, 1 + y * 0.5, hand.planeZ);
  hand.mesh.position.copy(hand.position);
});
canvas.addEventListener('pointerdown', () => {
  hand.pinch = true;
});
canvas.addEventListener('pointerup', () => {
  hand.pinch = false;
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'f' || event.key === 'F') hand.fist = !hand.fist;
  if (event.key === 'p' || event.key === 'P') hand.palm = !hand.palm;
});
canvas.addEventListener('wheel', (event) => {
  hand.planeZ += event.deltaY * 0.001;
});

function frameVisible(): void {
  const root = tab === 'conversion' ? conversion.group : visibleRoot();
  const box = new Box3().setFromObject(root);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const span = Math.max(size.x, size.y, size.z, 0.3);
  controls.target.copy(center);
  camera.position.set(center.x + span * 1.4, center.y + span * 0.9, center.z + span * 1.6);
  controls.update();
}

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => {
    tab = (button as HTMLButtonElement).dataset.tab ?? 'conversion';
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b === button)));
    renderControls();
    frameVisible();
  });
});

function slider(name: keyof AppConfig, min: number, max: number, step: number): string {
  const value = Number(config[name]);
  return `<label>${String(name)} <input type="range" data-key="${String(name)}" min="${min}" max="${max}" step="${step}" value="${value}"> <span>${value}</span></label>`;
}

function visibleRoot(): Group {
  if (tab === 'book') return book.root;
  if (tab === 'movie') return bird;
  return furniture.root;
}

function renderControls(): void {
  const measured = measureModel(visibleRoot());
  readout.textContent = `${tab}\nsize ${measured.width.toFixed(2)} x ${measured.height.toFixed(2)} x ${measured.depth.toFixed(2)} m\ntriangles ${measured.triangles}`;
  if (tab === 'conversion') {
    controlsEl.innerHTML = `${slider('popOutSeconds', 0.3, 3, 0.1)}<label>progress <input id="progress" type="range" min="0" max="1" step="0.01" value="0"></label>`;
  } else if (tab === 'furniture') {
    controlsEl.innerHTML = `${slider('jellyStiffness', 10, 200, 1)}${slider('jellyDamping', 1, 20, 0.5)}<button id="drop">Drop from height</button>`;
  } else if (tab === 'book') {
    controlsEl.innerHTML = `${slider('bookHoldSeconds', 0.2, 3, 0.1)}${slider('bookPalmMin', 0.05, 0.3, 0.01)}${slider('bookPalmMax', 0.3, 0.8, 0.01)}`;
  } else if (tab === 'movie') {
    controlsEl.innerHTML = `${slider('popOutSeconds', 0.3, 3, 0.1)}${slider('flySpeed', 0.1, 2, 0.05)}${slider('walkSpeed', 0.05, 1.5, 0.05)}${slider('rainDropCount', 20, 800, 10)}`;
  } else {
    controlsEl.innerHTML = `<p>Click the photo area conceptually: hotspot is a circle at 0.5, 0.62, r 0.28. Use Copy manifest entry.</p>`;
  }
  controlsEl.querySelectorAll('input[data-key]').forEach((input) => {
    input.addEventListener('input', () => {
      const key = (input as HTMLInputElement).dataset.key as keyof AppConfig;
      applyConfigPatch({ [key]: Number((input as HTMLInputElement).value) } as Partial<AppConfig>);
      (input.nextElementSibling as HTMLElement).textContent = (input as HTMLInputElement).value;
    });
  });
  document.getElementById('progress')?.addEventListener('input', (event) => {
    conversion.update(Number((event.target as HTMLInputElement).value));
  });
  document.getElementById('drop')?.addEventListener('click', () => {
    furniture.root.position.y = 1.2;
    furniture.falling = true;
    furniture.velocityY = 0;
  });
}

document.getElementById('reset')?.addEventListener('click', () => {
  resetConfig();
  renderControls();
  frameVisible();
});
document.getElementById('copy-config')?.addEventListener('click', async () => {
  const changed: string[] = [];
  (Object.keys(DEFAULTS) as Array<keyof AppConfig>).forEach((key) => {
    if (config[key] !== DEFAULTS[key]) changed.push(`config.${String(key)} = ${JSON.stringify(config[key])};`);
  });
  await navigator.clipboard.writeText(changed.join('\n') || '// no changes');
});
document.getElementById('copy-manifest')?.addEventListener('click', async () => {
  const object = tab === 'book' ? bookDef : sofaDef;
  await navigator.clipboard.writeText(JSON.stringify(object, null, 2));
});

renderControls();
frameVisible();

function loop(): void {
  requestAnimationFrame(loop);
  const dt = paused ? 0 : clock.getDelta() * slow;
  furniture.root.visible = tab === 'furniture';
  book.root.visible = tab === 'book';
  conversion.group.visible = tab === 'conversion';
  bird.visible = tab === 'movie';
  table.visible = tab === 'book';
  if (tab === 'furniture') {
    updateFurniture(
      furniture,
      dt,
      [{ id: 'lab', origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, horizontal: true, source: 'default' }],
      hand.palm && hand.pinch,
      hand.pinch,
      clock.elapsedTime,
    );
  }
  if (tab === 'movie') {
    bird.position.x = Math.cos(clock.elapsedTime * config.flySpeed) * 0.5;
    bird.position.z = Math.sin(clock.elapsedTime * config.flySpeed) * 0.5;
  }
  if (tab === 'conversion') {
    const phase = conversionPhase((document.getElementById('progress') as HTMLInputElement | null)?.valueAsNumber ?? 0);
    void phase;
  }
  renderer.render(scene, camera);
}
loop();

void createContactShadow;
void conversionPhase;
