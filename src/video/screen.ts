import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  VideoTexture,
  Group,
  Color,
} from 'three';
import { config } from '../config.js';
import { assetUrl } from '../assets/loaders.js';
import { FilmEcho } from './film-echo.js';

export class VideoScreen {
  readonly group = new Group();
  readonly mesh: Mesh;
  readonly echo = new FilmEcho();
  private glow: Mesh;
  video: HTMLVideoElement | null = null;
  private filmId: string | null = null;
  private usingFallback = false;
  private clock = 0;
  paused = false;
  ended = false;
  scale = 1;

  constructor() {
    this.mesh = new Mesh(
      new PlaneGeometry(config.videoScreenWidth, config.videoScreenWidth * (9 / 16)),
      new MeshBasicMaterial({ color: 0x111111 }),
    );
    this.glow = new Mesh(
      new PlaneGeometry(config.videoScreenWidth * 1.04, config.videoScreenWidth * (9 / 16) * 1.04),
      new MeshBasicMaterial({ color: new Color('#9fe8ff'), transparent: true, opacity: 0.12, depthWrite: false }),
    );
    this.glow.position.z = -0.01;
    // Echo behind the opaque plate; room stays visible through it.
    this.group.add(this.echo.group, this.glow, this.mesh);
    this.group.visible = false;
    this.group.name = 'video-screen';
    this.echo.layout(config.videoScreenWidth, config.videoScreenWidth * (9 / 16));
  }

  async init(): Promise<void> {
    this.group.visible = false;
    this.echo.setPlaying(false);
  }

  async preload(filmId: string): Promise<void> {
    if (
      this.filmId === filmId &&
      this.video &&
      this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return;
    }
    this.clearVideo();
    this.filmId = filmId;
    const video = document.createElement('video');
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.loop = false;
    video.muted = false;
    video.src = assetUrl(`assets/movie/${filmId}.mp4`);
    video.addEventListener('ended', () => {
      this.ended = true;
      this.paused = true;
      (this.mesh.material as MeshBasicMaterial).opacity = 0.7;
    });
    await waitForVideoReady(video, filmId);
    const texture = new VideoTexture(video);
    texture.colorSpace = SRGBColorSpace;
    const prev = this.mesh.material as MeshBasicMaterial;
    prev.map?.dispose();
    prev.dispose();
    this.mesh.material = new MeshBasicMaterial({ map: texture });
    this.echo.bindTexture(texture);
    this.video = video;
    this.usingFallback = false;
  }

  private clearVideo(): void {
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
      this.video = null;
    }
    this.filmId = null;
  }

  place(head: { x: number; y: number; z: number }, forward: { x: number; z: number }): void {
    this.applyScreenSize(config.videoScreenWidth);
    this.group.visible = true;
    this.group.scale.setScalar(1);
    this.scale = 1;
    this.echo.setPlaying(true);
    // Slightly below eye height so it reads as a big panel, not a HUD overlay.
    const y = head.y - 0.05;
    this.group.position.set(
      head.x + forward.x * config.videoScreenDistance,
      y,
      head.z + forward.z * config.videoScreenDistance,
    );
    this.group.lookAt(head.x, y, head.z);
  }

  /** Rebuild planes from current config so width changes apply at open time. */
  private applyScreenSize(width: number): void {
    const height = width * (9 / 16);
    this.mesh.geometry.dispose();
    this.mesh.geometry = new PlaneGeometry(width, height);
    this.glow.geometry.dispose();
    this.glow.geometry = new PlaneGeometry(width * 1.04, height * 1.04);
    this.echo.layout(width, height);
  }

  async play(at = 0): Promise<void> {
    this.paused = false;
    this.ended = false;
    (this.mesh.material as MeshBasicMaterial).opacity = 1;
    this.echo.setPlaying(true);
    if (!this.video) {
      this.usingFallback = true;
      this.clock = at;
      return;
    }
    try {
      this.video.currentTime = at;
    } catch {
      /* Quest may throw if seeking before enough data */
    }
    try {
      await this.video.play();
    } catch (error) {
      console.warn('[scene-echoes] video.play failed', error);
      // Retry muted once — Quest sometimes blocks unmuted autoplay.
      this.video.muted = true;
      await this.video.play();
      this.video.muted = false;
    }
  }

  togglePause(): void {
    if (this.ended) {
      void this.play(0);
      return;
    }
    this.paused = !this.paused;
    if (this.video) {
      if (this.paused) this.video.pause();
      else void this.video.play();
    }
    (this.mesh.material as MeshBasicMaterial).opacity = this.paused ? 0.7 : 1;
  }

  currentTime(): number {
    if (this.video && !this.usingFallback) return this.video.currentTime;
    return this.clock;
  }

  duration(): number {
    if (this.video && Number.isFinite(this.video.duration) && this.video.duration > 0) {
      return this.video.duration;
    }
    return 30;
  }

  update(dt: number): void {
    this.echo.update(dt, this.paused || this.ended);
    if (this.paused) return;
    if (this.usingFallback) {
      this.clock += dt;
      if (this.clock >= 30) {
        this.ended = true;
        this.paused = true;
      }
    }
  }

  setScale(scale: number): void {
    this.scale = Math.min(config.videoMaxScale, Math.max(config.videoMinScale, scale));
    this.group.scale.setScalar(this.scale);
  }

  pauseForExplorer(pause: boolean): void {
    if (!this.group.visible) return;
    if (pause) {
      this.video?.pause();
    } else if (!this.paused && !this.ended) {
      void this.video?.play();
    }
  }

  hide(): void {
    this.group.visible = false;
    this.echo.setPlaying(false);
  }
}

function waitForVideoReady(video: HTMLVideoElement, filmId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok: boolean, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener('canplaythrough', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('error', onError);
      if (ok) resolve();
      else reject(error ?? new Error(`Failed to preload ${filmId}.mp4`));
    };
    const onReady = () => finish(true);
    const onError = () => finish(false, new Error(`Failed to preload ${filmId}.mp4`));
    // Large MP4s on Quest may never reach canplaythrough — accept canplay/loadeddata.
    video.addEventListener('canplaythrough', onReady, { once: true });
    video.addEventListener('canplay', onReady, { once: true });
    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
    const timer = setTimeout(() => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) finish(true);
      else finish(false, new Error(`Timed out preloading ${filmId}.mp4`));
    }, 45000);
    video.load();
  });
}
