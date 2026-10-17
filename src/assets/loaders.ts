import {
  Box3,
  Group,
  Texture,
  TextureLoader,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { config } from '../config.js';
import { debugParams } from '../debug/params.js';
import type { ManifestObject } from './types.js';
import { overTriangleBudget, sizeDisagrees } from './validate.js';

const textureLoader = new TextureLoader();
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

export const modelWarnings: string[] = [];
const modelCache = new Map<string, Group>();

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

export async function loadModel(object: ManifestObject): Promise<Group> {
  if (!object.model) {
    throw new Error(`Object ${object.id} has no GLB path`);
  }
  const cached = modelCache.get(object.id);
  if (cached) {
    const clone = cached.clone(true);
    applyManifestScale(clone, object);
    return clone;
  }
  const gltf = await gltfLoader.loadAsync(assetUrl(object.model));
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

export function measureModel(root: Group): { width: number; height: number; depth: number; triangles: number } {
  const box = new Box3().setFromObject(root);
  const size = new Vector3();
  box.getSize(size);
  return { width: size.x, height: size.y, depth: size.z, triangles: countTriangles(root) };
}
