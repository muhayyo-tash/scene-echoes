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
    if (this.video && this.video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;
    const video = document.createElement('video');
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.loop = false;
    video.src = assetUrl(`assets/movie/${filmId}.mp4`);
    video.addEventListener('ended', () => {
      this.ended = true;
      this.paused = true;
      (this.mesh.material as MeshBasicMaterial).opacity = 0.7;
    });
    await new Promise<void>((resolve, reject) => {
      const ok = () => {
        video.removeEventListener('error', bad);
        resolve();
      };
      const bad = () => {
        video.removeEventListener('canplaythrough', ok);
        reject(new Error(`Failed to preload ${filmId}.mp4`));
      };
      video.addEventListener('canplaythrough', ok, { once: true });
      video.addEventListener('error', bad, { once: true });
      video.load();
    });
    const texture = new VideoTexture(video);
    texture.colorSpace = SRGBColorSpace;
    this.mesh.material = new MeshBasicMaterial({ map: texture });
    this.echo.bindTexture(texture);
    this.video = video;
    this.usingFallback = false;
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
    this.video.currentTime = at;
    await this.video.play();
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
