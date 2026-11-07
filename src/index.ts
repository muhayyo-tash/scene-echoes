import {
  createSystem,
  DepthSensingSystem,
  SessionMode,
  VisibilityState,
  World,
  XRPlane,
} from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { Vector3 } from 'three';
import { SceneEchoesApp } from './runtime/app.js';
import { samplesFromFrame } from './runtime/xr-hands.js';
import type { RoomSurface } from './core/surfaces.js';

const landing = document.getElementById('landing');
const enter = document.getElementById('enter');
const support = document.getElementById('support');
const container = document.getElementById('scene-container') as HTMLDivElement;

async function checkSupport(): Promise<string | null> {
  if (!navigator.xr) {
    return 'Open this page in the Meta Quest Browser and turn on hand tracking in Settings.';
  }
  const ar = await navigator.xr.isSessionSupported(SessionMode.ImmersiveAR).catch(() => false);
  if (!ar) {
    return 'Open this page in the Meta Quest Browser. This app needs immersive AR.';
  }
  return null;
}

class SceneEchoesSystem extends createSystem({
  planes: { required: [XRPlane] },
}) {
  private app!: SceneEchoesApp;

  init(): void {
    this.app = (this.world as World & { __app?: SceneEchoesApp }).__app!;
  }

  update(delta: number): void {
    const world = this.world;
    const paused =
      world.visibilityState.value === VisibilityState.Hidden ||
      world.visibilityState.value === VisibilityState.VisibleBlurred;
    const samples = samplesFromFrame(world, world.xrFrame);
    const planes: RoomSurface[] = [];
    for (const entity of this.queries.planes.entities) {
      const obj = entity.object3D;
      if (!obj) continue;
      planes.push({
        id: `plane-${obj.id}`,
        origin: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        normal: { x: 0, y: 1, z: 0 },
        horizontal: true,
        source: 'plane',
      });
    }
    const head = new Vector3();
    world.camera.getWorldPosition(head);
    this.app.update(delta, {
      left: samples.left,
      right: samples.right,
      planes,
      head: {
        position: head,
        quaternion: {
          x: world.camera.quaternion.x,
          y: world.camera.quaternion.y,
          z: world.camera.quaternion.z,
          w: world.camera.quaternion.w,
        },
      },
      paused,
    });
  }
}

void (async () => {
  const missing = await checkSupport();
  if (missing && support) {
    support.textContent =
      'No headset AR in this browser. Press Enter for a 3D preview you can orbit and click.';
    support.hidden = false;
  }

  const world = await World.create(container, {
    ...projectOptions,
    xr: {
      ...projectOptions.xr,
      sessionMode: SessionMode.ImmersiveAR,
      offer: 'none',
      features: {
        ...(projectOptions.xr && typeof projectOptions.xr === 'object'
          ? projectOptions.xr.features
          : {}),
        handTracking: true,
        anchors: true,
        planeDetection: true,
        meshDetection: true,
        hitTest: true,
        depthSensing: { required: false, usage: 'gpu-optimized', format: 'float32' },
      },
    },
    features: {
      ...projectOptions.features,
      grabbing: { useHandPinchForGrab: true },
      locomotion: false,
      physics: true,
      sceneUnderstanding: { showWireFrame: false },
      environmentRaycast: true,
    },
  });

  world.scene.background = null;
  world.renderer.setClearAlpha(0);
  try {
    world.registerSystem(DepthSensingSystem, {
      configData: {
        enableDepthTexture: true,
        enableOcclusion: true,
        useFloat32: true,
        blurRadius: 20,
      },
    });
  } catch {
    /* depth sensing is optional */
  }

  const app = new SceneEchoesApp(world.scene, world.camera, world.renderer);
  (world as World & { __app?: SceneEchoesApp }).__app = app;
  await app.boot();
  world.registerSystem(SceneEchoesSystem);

  enter?.addEventListener('click', async () => {
    try {
      await app.startAudio();
    } catch {
      /* audio is optional in the desktop preview */
    }
    try {
      await app.prepareCamera();
    } catch {
      /* headset camera is optional until the user long-presses a real object */
    }
    landing?.setAttribute('hidden', '');
    if (missing) {
      app.enableDesktopPreview(world.camera, world.renderer.domElement);
      return;
    }
    try {
      await Promise.resolve(world.launchXR({ sessionMode: SessionMode.ImmersiveAR }));
      void app.prepareCamera();
    } catch {
      app.enableDesktopPreview(world.camera, world.renderer.domElement);
    }
  });
})();
