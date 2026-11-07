export type SceneCaptureResult =
  | { ok: true; dataUrl: string; label: string }
  | { ok: false; reason: 'permission' | 'no-camera' | 'empty-frame' | 'busy' | 'error'; detail: string };

export type CameraDevice = { deviceId: string; label: string };

/**
 * Front-of-headset cameras via getUserMedia (Quest "Headset cameras" permission).
 * This is not the WebXR compositor passthrough image.
 */
export class SceneCapture {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private label = '';
  private starting: Promise<SceneCaptureResult | null> | null = null;

  async ensureStarted(): Promise<SceneCaptureResult | null> {
    if (this.video && this.stream?.active) return null;
    if (this.starting) return this.starting;
    this.starting = this.start();
    try {
      return await this.starting;
    } finally {
      this.starting = null;
    }
  }

  async captureStill(): Promise<SceneCaptureResult> {
    const started = await this.ensureStarted();
    if (started && !started.ok) return started;
    const video = this.video;
    if (!video || video.videoWidth < 8 || video.videoHeight < 8) {
      return { ok: false, reason: 'empty-frame', detail: 'Camera frame was empty' };
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { ok: false, reason: 'error', detail: 'No 2D canvas' };
    }
    ctx.drawImage(video, 0, 0);
    return {
      ok: true,
      dataUrl: canvas.toDataURL('image/jpeg', 0.92),
      label: this.label || 'headset camera',
    };
  }

  private async start(): Promise<SceneCaptureResult | null> {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, reason: 'no-camera', detail: 'No mediaDevices' };
    }
    try {
      const unlocked = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      unlocked.getTracks().forEach((track) => track.stop());
      const devices = await listVideoInputs();
      if (devices.length === 0) {
        return { ok: false, reason: 'no-camera', detail: 'No browser camera input' };
      }
      const chosen = pickHeadsetCamera(devices);
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: chosen
          ? {
              deviceId: { exact: chosen.deviceId },
              width: { ideal: 1280 },
              height: { ideal: 960 },
            }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 960 },
            },
      });
      this.label = this.stream.getVideoTracks()[0]?.label ?? chosen?.label ?? 'camera';
      const video = document.createElement('video');
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      video.autoplay = true;
      video.srcObject = this.stream;
      await video.play();
      const ready = await waitForVideo(video, 4000);
      if (!ready) {
        this.stop();
        return { ok: false, reason: 'empty-frame', detail: 'Camera never produced a frame' };
      }
      this.video = video;
      return null;
    } catch (error) {
      this.stop();
      return {
        ok: false,
        reason: 'permission',
        detail: error instanceof Error ? error.message : 'Camera permission failed',
      };
    }
  }

  private stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
  }
}

export function pickHeadsetCamera(devices: CameraDevice[]): CameraDevice | null {
  if (devices.length === 0) return null;
  return [...devices].sort((a, b) => scoreCamera(b.label) - scoreCamera(a.label))[0] ?? null;
}

function scoreCamera(label: string): number {
  const text = label.toLowerCase();
  if (text.includes('avatar') || text.includes('virtual')) return -4;
  if (text.includes('front') && !text.includes('back')) return -2;
  if (text.includes('passthrough')) return 5;
  if (text.includes('back') || text.includes('environment') || text.includes('rear')) return 4;
  if (/camera 2 [12]/.test(text)) return 3;
  return 0;
}

async function listVideoInputs(): Promise<CameraDevice[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((device) => device.kind === 'videoinput' && device.deviceId)
    .map((device) => ({ deviceId: device.deviceId, label: device.label || device.deviceId }));
}

function waitForVideo(video: HTMLVideoElement, timeoutMs: number): Promise<boolean> {
  const started = performance.now();
  return new Promise((resolve) => {
    const tick = (): void => {
      if (video.videoWidth >= 8 && video.videoHeight >= 8 && video.readyState >= 2) {
        resolve(true);
        return;
      }
      if (performance.now() - started > timeoutMs) {
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}
