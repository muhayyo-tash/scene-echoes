import {
  DirectionalLight,
  HemisphereLight,
  Scene,
} from 'three';

export function createFallbackLights(scene: Scene): { hemi: HemisphereLight; dir: DirectionalLight } {
  const hemi = new HemisphereLight(0xfff2dd, 0x2a2a28, 0.85);
  const dir = new DirectionalLight(0xffe6c8, 0.35);
  dir.position.set(0.4, 2.2, 0.6);
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
