import {
  DirectionalLight,
  HemisphereLight,
  Scene,
} from 'three';

export function createFallbackLights(scene: Scene): { hemi: HemisphereLight; dir: DirectionalLight } {
  // Bright enough to read PBR meshes against Quest passthrough (dim lights look “missing”).
  const hemi = new HemisphereLight(0xffffff, 0x5a5a58, 1.55);
  const dir = new DirectionalLight(0xfff5e8, 1.15);
  dir.position.set(0.5, 2.4, 0.8);
  dir.castShadow = false;
  scene.add(hemi, dir);
  return { hemi, dir };
}

export async function tryLightEstimation(
  session: XRSession | undefined,
  scene: Scene,
  lights: { hemi: HemisphereLight; dir: DirectionalLight },
): Promise<() => void> {
  const xr = session as XRSession & {
    requestLightProbe?: () => Promise<unknown>;
  };
  if (!session || typeof xr.requestLightProbe !== 'function') {
    return () => undefined;
  }
  try {
    await xr.requestLightProbe();
    lights.hemi.visible = true;
    return () => undefined;
  } catch {
    lights.hemi.visible = true;
    scene.background = null;
    return () => undefined;
  }
}
