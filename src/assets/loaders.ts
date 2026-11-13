import {
  Box3,
  Color,
  Group,
  MeshBasicMaterial,
  Texture,
  TextureLoader,
  Vector3,
  type Material,
  type Mesh,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { config } from '../config.js';
import { debugParams } from '../debug/params.js';
import type { ManifestObject } from './types.js';
import { overTriangleBudget, sizeDisagrees } from './validate.js';

const textureLoader = new TextureLoader();
const gltfLoader = new GLTFLoader();

export const modelWarnings: string[] = [];
const modelCache = new Map<string, Group>();

let meshoptReady: Promise<void> | null = null;

/**
 * Quest Browser can stall for tens of seconds on the first meshopt GLB if WASM
 * has not finished instantiating. Await this before any load (ideally at boot).
 */
export function ensureMeshoptDecoder(): Promise<void> {
  if (!meshoptReady) {
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    meshoptReady = Promise.resolve(MeshoptDecoder.ready as PromiseLike<unknown>)
      .then(() => {
        console.info('[scene-echoes] meshopt decoder ready');
      })
      .catch((error) => {
        console.warn('[scene-echoes] meshopt decoder failed', error);
      });
  }
  return meshoptReady;
}

export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? './';
  return `${base}${path.replace(/^\/+/, '')}`;
}

export async function loadTexture(path: string): Promise<Texture> {
  return textureLoader.loadAsync(assetUrl(path));
}

function countTriangles(root: Group): number {
  let count = 0;
  root.traverse((child) => {
    const mesh = child as { isMesh?: boolean; geometry?: { index?: { count: number }; attributes?: { position?: { count: number } } } };
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.geometry.index) count += mesh.geometry.index.count / 3;
    else count += (mesh.geometry.attributes?.position?.count ?? 0) / 3;
  });
  return count;
}

function longestSize(root: Group): number {
  const box = new Box3().setFromObject(root);
  const size = new Vector3();
  box.getSize(size);
  return Math.max(size.x, size.y, size.z);
}

export function applyManifestScale(root: Group, object: ManifestObject): void {
  const longest = longestSize(root) || 1;
  const scale = object.realSize / longest;
  root.scale.multiplyScalar(scale);
  const box = new Box3().setFromObject(root);
  root.position.y -= box.min.y - (object.baseOffset ?? 0);
  if (object.up === 'z') {
    root.rotation.x = -Math.PI / 2;
  }
}

export function cacheModelTemplate(id: string, template: Group): void {
  modelCache.set(id, template);
}

export async function loadGlbBytes(bytes: ArrayBuffer): Promise<Group> {
  await ensureMeshoptDecoder();
  return new Promise((resolve, reject) => {
    gltfLoader.parse(
      bytes,
      '',
      (gltf) => resolve(gltf.scene),
      (error) => reject(error),
    );
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function loadModel(object: ManifestObject): Promise<Group> {
  if (!object.model) {
    throw new Error(`Object ${object.id} has no GLB path`);
  }
  await ensureMeshoptDecoder();
  const cached = modelCache.get(object.id);
  if (cached) {
    const clone = cached.clone(true);
    applyManifestScale(clone, object);
    return clone;
  }
  const url = assetUrl(object.model);
  console.info('[scene-echoes] loading glb', object.id, url);
  const started = performance.now();
  const gltf = await withTimeout(gltfLoader.loadAsync(url), 20_000, `GLB ${object.id}`);
  console.info('[scene-echoes] glb ready', object.id, `${(performance.now() - started).toFixed(0)}ms`);
  const template = gltf.scene;
  const triangles = countTriangles(template);
  if (overTriangleBudget(triangles) && debugParams.debug) {
    const warning = `[model] ${object.id} has ${triangles} triangles (budget ${config.maxTriangles})`;
    modelWarnings.push(warning);
    console.warn(warning);
  }
  modelCache.set(object.id, template);
  const root = template.clone(true);
  applyManifestScale(root, object);
  if (sizeDisagrees(longestSize(root), object.realSize) && debugParams.debug) {
    const warning = `[model] ${object.id} size disagrees with realSize`;
    modelWarnings.push(warning);
    console.warn(warning);
  }
  return root;
}

/** Unlit materials so PBR sofas stay visible in Quest passthrough / multiview. */
export function toUnlitArMaterials(root: Group): void {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.frustumCulled = false;
    mesh.visible = true;
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = source.map((mat: Material) => {
      const std = mat as Material & {
        map?: Texture | null;
        color?: Color;
      };
      const basic = new MeshBasicMaterial({
        map: std.map ?? null,
        color: std.color ? std.color.clone() : new Color(0xcccccc),
        toneMapped: false,
      });
      return basic;
    });
    mesh.material = (next.length === 1 ? next[0] : next) as Mesh['material'];
  });
}

export function measureModel(root: Group): { width: number; height: number; depth: number; triangles: number } {
  const box = new Box3().setFromObject(root);
  const size = new Vector3();
  box.getSize(size);
  return { width: size.x, height: size.y, depth: size.z, triangles: countTriangles(root) };
}
