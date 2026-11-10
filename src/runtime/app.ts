import {
  Color,
  GridHelper,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  Scene,
  Vector2,
  Vector3,
  type Object3D,
  type Camera,
  type WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { config } from '../config.js';
import { debugParams } from '../debug/params.js';
import { parseExplorer, parseManifest } from '../assets/validate.js';
import type { ExplorerEntry, ManifestObject, TimelineFile } from '../assets/types.js';
import { cacheModelTemplate, loadGlbBytes, loadModel } from '../assets/loaders.js';
import bundledManifest from '../../public/assets/manifest.json';
import bundledExplorer from '../../public/assets/explorer.json';
import bundledFilms from '../../public/assets/movie/films.json';
import bundledTimeline from '../../public/assets/movie/timeline.json';
import { explorerWithFilms } from '../assets/films.js';
import { AudioEngine } from '../core/audio.js';
import {
  createHands,
  pokeSurface,
  updateHandRuntime,
  handSpeed,
} from '../core/hands.js';
import {
  createSurfaceFinder,
  fingertipNearSurface,
  maybeDefaultFloor,
  nearestHorizontal,
  palmCalibrate,
  upsertSurface,
  type RoomSurface,
  type SurfaceFinderState,
} from '../core/surfaces.js';
import {
  closeExplorer,
  closePhoto,
  createSpaceState,
  openExplorer,
  openMovie,
  openPhoto,
} from '../core/space.js';
import {
  createBookDetector,
  floorHeight,
  isBookOpenPose,
  isElevatedSurface,
  tableHeight,
  updateBookDetector,
  type BookDetector,
} from '../core/book.js';
import { spawnInFront } from '../core/placement.js';
import { applyObjectLimit } from '../core/object-limit.js';
import { createFallbackLights } from '../core/lighting.js';
import { createGhostHand, playGhostPinchHold, playGhostSlide } from '../core/ghost-hand.js';
import { SceneCapture } from '../core/scene-capture.js';
import { FileExplorer } from '../library/explorer.js';
import type { FinderSection } from '../assets/drawn.js';
import { createModelSource, createFilmProcessing, type LiveFilmResult } from '../conversion/source.js';
import { ConversionAnimation } from '../conversion/animation.js';
import type { ConversionPoint, FilmProcessing, ModelSource } from '../conversion/types.js';
import {
  dropObject,
  isOnObject,
  makePlacedObject,
  pressSeat,
  resizeObject,
  setObjectContacts,
  updatePlacedObject,
  type PlacedObject,
} from '../scenes/placed-object.js';
import { MovieScene } from '../scenes/movie.js';
import { VideoScreen } from '../video/screen.js';
import { parseTimelineMoments } from '../video/timeline.js';
import { mountDebugPanel, renderDebugPanel } from '../debug/panel.js';
import type { HandSample } from '../core/hands.js';

export interface FrameInput {
  left: HandSample | null;
  right: HandSample | null;
  planes: RoomSurface[];
  head: { position: Vector3; quaternion: { x: number; y: number; z: number; w: number } };
  paused: boolean;
}

export class SceneEchoesApp {
  space = createSpaceState();
  hands = createHands();
  surfaces: SurfaceFinderState = createSurfaceFinder();
  audio = new AudioEngine();
  explorer!: FileExplorer;
  objects: ManifestObject[] = [];
  entries: ExplorerEntry[] = [];
  timeline: TimelineFile = { moments: [] };
  modelSource!: ModelSource;
  films!: FilmProcessing;
  placedObjects: PlacedObject[] = [];
  movie = new MovieScene([]);
  screen = new VideoScreen();
  conversion = new ConversionAnimation();
  ghost = createGhostHand();
  placed = new Group();
  book: BookDetector = createBookDetector();
  landingRing = new Mesh(
    new RingGeometry(0.08, 0.09, 32),
    new MeshBasicMaterial({ color: new Color('#dff6e8'), transparent: true, opacity: 0.4 }),
  );
  /** Neutral hold progress (only while index long-press is active on a photo). */
  private holdProgressRing = new Mesh(
    new RingGeometry(0.03, 0.042, 40),
    new MeshBasicMaterial({
      color: new Color('#ffffff'),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  debug = mountDebugPanel();
  idle = 0;
  desktop = false;
  activeFilmId: string | null = null;
  converting = false;
  conversionElapsed = 0;
  sceneCapture = new SceneCapture();
  private sceneCaptureBusy = false;
  pendingConverted: { object: ManifestObject; model: Group; origin: Vector3 } | null = null;
  grab:
    | { kind: 'object3d' | 'movie' | 'screen' | 'explorer'; id: string; hand: 'left' | 'right' }
    | null = null;
  twoHandScale: number | null = null;
  private twoHandScaleBase: number | null = null;
  private grabOffset = new Vector3();
  /** Yaw-only spin while holding a 3D object (no pitch/roll). */
  private grabYaw = { object: 0, hand: 0 };
  private twoHandYaw = { object: 0, hands: 0 };
  hintPlayed = { slide: false, pinch: false };
  time = 0;
  fps = 0;
  frames = 0;
  fpsT = 0;
  private storage: Storage | null;
  private carrying: Group | null = null;
  private desktopControls: OrbitControls | null = null;
  private desktopRay = new Raycaster();
  private uiRaycaster = new Raycaster();
  private uiOrigin = new Vector3();
  private uiDir = new Vector3();
  private desktopPointer = new Vector2();
  private seatPressed: PlacedObject | null = null;
  private photoHold: {
    hand: 'left' | 'right' | null;
    elapsed: number;
    origin: { x: number; y: number; z: number } | null;
    uv: { x: number; y: number } | null;
    contacted: boolean;
    lastTick: number;
    /** Seconds since last valid contact — absorbs Quest tracking dropouts. */
    lost: number;
  } = { hand: null, elapsed: 0, origin: null, uv: null, contacted: false, lastTick: 0, lost: 0 };
  private desktopHold: {
    x: number;
    y: number;
    started: number;
    kind: 'photo' | 'card' | 'icon' | 'close' | 'seat' | 'folder' | 'other';
    point: Vector3 | null;
    uv: { x: number; y: number } | null;
    cardId?: string;
    cardType?: ExplorerEntry['type'];
    seatItem?: PlacedObject;
    folder?: FinderSection;
    fired: boolean;
  } | null = null;

  constructor(
    readonly scene: Scene,
    readonly camera: Camera,
    readonly renderer?: WebGLRenderer,
  ) {
    this.storage = typeof localStorage === 'undefined' ? null : localStorage;
    this.scene.background = null;
    createFallbackLights(this.scene);
    this.landingRing.rotation.x = -Math.PI / 2;
    this.landingRing.visible = false;
    this.holdProgressRing.visible = false;
    this.scene.add(
      this.placed,
      this.conversion.group,
      this.ghost,
      this.landingRing,
      this.holdProgressRing,
      this.screen.group,
    );
    this.movie = new MovieScene([]);
    this.scene.add(this.movie.group);
  }

  async boot(): Promise<void> {
    const manifest = parseManifest(bundledManifest);
    const explorer = parseExplorer(bundledExplorer);
    this.objects = manifest.manifest.objects;
    this.entries = explorerWithFilms(explorer.entries, bundledFilms.films ?? []);
    this.timeline = { moments: parseTimelineMoments(bundledTimeline) };
    this.explorer = new FileExplorer(this.entries, this.objects);
    await this.explorer.init();
    this.scene.add(this.explorer.group, this.explorer.photoGroup, this.explorer.iconGroup);
    this.modelSource = createModelSource(this.objects, (object) => loadModel(object));
    this.films = createFilmProcessing(
      this.storage,
      (filmId, report) => this.preloadFilm(filmId, report),
      (result) => this.applyLiveFilm(result),
    );
    this.movie = new MovieScene(this.objects);
    this.scene.add(this.movie.group);
    await this.screen.init();
    const filmsEx = this.films as FilmProcessing & { reset?(id: string): void; markReady?(id: string): void };
    for (const filmId of this.filmIds()) {
      if (debugParams.reset) filmsEx.reset?.(filmId);
      if (debugParams.movieReady) filmsEx.markReady?.(filmId);
      this.explorer.setMovieProgress(filmId, this.films.get(filmId));
    }
    this.films.subscribe((id, progress) => this.explorer.setMovieProgress(id, progress));
    // No model preload — a real product only loads after the user picks something.
    if (debugParams.openId) {
      this.space = openExplorer(this.space);
    }
    if (debugParams.objectId) {
      await this.spawnDebugObject(debugParams.objectId);
    }
  }

  async startAudio(): Promise<void> {
    await this.audio.start();
  }

  async prepareCamera(): Promise<void> {
    const result = await this.sceneCapture.ensureStarted();
    if (result && !result.ok) {
      console.warn('[scene-echoes] headset camera', result.reason, result.detail);
    }
  }

  enableDesktopPreview(camera: Camera, canvas: HTMLCanvasElement): void {
    this.desktop = true;
    this.scene.background = new Color('#d9e4dc');
    this.renderer?.setClearAlpha(1);
    camera.position.set(0, 1.45, 2.0);
    camera.lookAt(-0.15, 1.1, -0.15);
    const floor = new Mesh(
      new PlaneGeometry(8, 8),
      new MeshStandardMaterial({ color: 0xb7c4b0, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    const grid = new GridHelper(8, 16, 0x88aa99, 0xaacbbb);
    this.scene.add(floor, grid);
    upsertSurface(this.surfaces, {
      id: 'desktop-floor',
      origin: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      horizontal: true,
      source: 'default',
    });
    this.surfaces.usedDefault = true;
    this.desktopControls = new OrbitControls(camera, canvas);
    this.desktopControls.target.set(-0.15, 1.1, -0.15);
    this.desktopControls.enableDamping = true;
    canvas.addEventListener('pointerdown', (event) => {
      this.beginDesktopHold(event, camera);
    });
    canvas.addEventListener('pointermove', (event) => {
      this.moveDesktopHold(event);
    });
    canvas.addEventListener('pointerup', (event) => {
      this.endDesktopHold(event, camera);
    });
    canvas.addEventListener('pointercancel', () => {
      this.clearDesktopHold();
    });
  }

  update(dt: number, input: FrameInput): void {
    if (input.paused) {
      this.audio.pause();
      return;
    }
    this.audio.resume();
    this.time += dt;
    this.frames += 1;
    this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.fps = this.frames / this.fpsT;
      this.frames = 0;
      this.fpsT = 0;
    }
    for (const plane of input.planes) upsertSurface(this.surfaces, plane);
    const chestY = input.head.position.y - config.chestOffset;
    const touching = this.anyTouch();
    const filmPlaying = this.space.movieOpen && !this.screen.paused;
    const leftNear = fingertipNearSurface(input.left?.indexTip ?? null, this.surfaces.surfaces);
    const rightNear = fingertipNearSurface(input.right?.indexTip ?? null, this.surfaces.surfaces);
    const slideL = updateHandRuntime(
      this.hands.left,
      input.left,
      dt,
      chestY,
      touching,
      !this.space.explorerOpen,
      filmPlaying,
      Boolean(leftNear),
    );
    const slideR = updateHandRuntime(
      this.hands.right,
      input.right,
      dt,
      chestY,
      touching,
      !this.space.explorerOpen,
      filmPlaying,
      Boolean(rightNear),
    );
    this.hands.slide = slideL ?? slideR;
    this.hands.anyPinch = this.hands.left.pinched || this.hands.right.pinched;
    const lowest = [input.left?.wrist?.y, input.right?.wrist?.y].filter((n): n is number => n !== undefined);
    maybeDefaultFloor(
      this.surfaces,
      dt,
      lowest.length ? Math.min(...lowest) : null,
      debugParams.surfacesDefault,
    );
    this.tryPalmCalibrate();
    const poseOpen = isBookOpenPose(
      this.hands.left.palm,
      this.hands.right.palm,
      tableHeight(this.surfaces.surfaces, config.bookTableAboveFloor),
      chestY,
      config.bookPalmMin,
      config.bookPalmMax,
    );
    updateBookDetector(this.book, poseOpen, dt, config.bookOpenMemorySeconds);

    if (this.hands.slide === 'left') this.openLibrary(input);
    if (this.hands.slide === 'right') this.closeLibrary();

    this.updateHints(dt, input);
    this.updateExplorer(dt, input);
    this.updateConversion(dt, input);
    this.updateGrab(dt, input);
    this.updatePlacedObjects(dt, input);
    this.updateBookHold(input);
    this.updateMovie(dt, input);
    this.updateDesktopHold();
    this.desktopControls?.update();
    this.audio.setListener(
      input.head.position.x,
      input.head.position.y,
      input.head.position.z,
      0,
      0,
      -1,
    );
    renderDebugPanel(this.debug, {
      space: this.space.space,
      hands: this.hands,
      surfaces: this.surfaces,
      fps: this.fps,
      filmTime: this.space.movieOpen ? this.screen.currentTime() : null,
      nextMoment: this.nextMomentLabel(),
      movie: this.activeFilm()?.status ?? 'idle',
    });
  }

  private openLibrary(input: FrameInput): void {
    this.space = openExplorer(this.space);
    const forward = forwardFrom(input.head.quaternion);
    this.explorer.setOpen(true, {
      x: input.head.position.x,
      y: input.head.position.y,
      z: input.head.position.z,
    }, forward);
    if (this.space.movieOpen) this.screen.pauseForExplorer(true);
    if (debugParams.openId) {
      void this.openPhotoCard(debugParams.openId, input);
    }
  }

  private closeLibrary(): void {
    this.space = closeExplorer(this.space);
    this.explorer.setOpen(false, { x: 0, y: 0, z: 0 }, { x: 0, z: -1 });
    if (this.space.movieOpen) this.screen.pauseForExplorer(false);
  }

  private updateHints(dt: number, input: FrameInput): void {
    const idle = !this.hands.anyPinch && !this.space.explorerOpen && this.placedObjects.length === 0;
    this.idle = idle ? this.idle + dt : 0;
    if (!this.hintPlayed.slide && this.idle > config.hintIdleSeconds) {
      this.hintPlayed.slide = true;
      playGhostSlide(this.ghost, 0);
      this.ghost.userData.anim = { kind: 'slide', t: 0 };
    }
    const anim = this.ghost.userData.anim as
      | { kind: string; t: number; target?: { x: number; y: number; z: number } }
      | undefined;
    if (anim) {
      anim.t += dt / config.ghostHintSeconds;
      if (anim.kind === 'slide') playGhostSlide(this.ghost, anim.t);
      if (anim.kind === 'pinch') {
        const target =
          anim.target ??
          (this.explorer.openPhoto
            ? {
                x: this.explorer.openPhoto.position.x,
                y: this.explorer.openPhoto.position.y,
                z: this.explorer.openPhoto.position.z,
              }
            : null);
        if (target) playGhostPinchHold(this.ghost, anim.t, target);
      }
      if (anim.t >= 1) {
        if (anim.kind === 'pinch') this.hintPlayed.pinch = true;
        this.ghost.visible = false;
        this.ghost.userData.anim = undefined;
      }
    }
    void input;
  }

  private uiPick(hand: {
    rayOrigin: { x: number; y: number; z: number } | null;
    rayDirection: { x: number; y: number; z: number } | null;
  }): { object: Object3D; point: Vector3 } | null {
    if (!hand.rayOrigin || !hand.rayDirection) return null;
    this.uiOrigin.set(hand.rayOrigin.x, hand.rayOrigin.y, hand.rayOrigin.z);
    this.uiDir.set(hand.rayDirection.x, hand.rayDirection.y, hand.rayDirection.z).normalize();
    this.uiRaycaster.set(this.uiOrigin, this.uiDir);
    this.uiRaycaster.far = 4;
    const hits = this.uiRaycaster.intersectObjects(
      [this.explorer.iconGroup, this.explorer.group, this.explorer.photoGroup],
      true,
    );
    const hit = hits.find((entry) => entry.object.visible);
    return hit ? { object: hit.object, point: hit.point } : null;
  }

  private uiKind(object: Object3D | null): {
    kind: 'icon' | 'close' | 'folder' | 'card';
    folder?: FinderSection;
    cardId?: string;
  } | null {
    let current: Object3D | null = object;
    while (current) {
      const data = current.userData as {
        appIcon?: boolean;
        close?: boolean;
        folder?: FinderSection;
        cardId?: string;
      };
      if (data.appIcon) return { kind: 'icon' };
      if (data.close) return { kind: 'close' };
      if (data.folder) return { kind: 'folder', folder: data.folder };
      if (data.cardId) return { kind: 'card', cardId: data.cardId };
      current = current.parent;
    }
    return null;
  }

  private updateExplorer(dt: number, input: FrameInput): void {
    // View-locked top-right dock (world pose follows head each frame).
    this.explorer.placeDockHud(
      {
        x: input.head.position.x,
        y: input.head.position.y,
        z: input.head.position.z,
      },
      input.head.quaternion,
    );
    let hover: string | null = null;
    const tips = [
      this.hands.left.indexTip,
      this.hands.right.indexTip,
      this.hands.left.pinchPosition,
      this.hands.right.pinchPosition,
    ];
    const pressing =
      this.hands.left.justPinched ||
      this.hands.right.justPinched ||
      pokeSurface(this.hands.left, 0.01, dt) ||
      pokeSurface(this.hands.right, 0.01, dt);

    // Invisible hand target-ray for Finder only (no white line). Point at a
    // card/icon and pinch to open — fingertip poke still works as a fallback.
    // Skip UI clicks while dragging Finder itself.
    for (const hand of [this.hands.left, this.hands.right]) {
      if (this.grab?.kind === 'explorer') break;
      const pinch = hand.pinchPosition;
      if (
        this.space.explorerOpen &&
        !this.space.photoOpen &&
        pinch &&
        this.explorer.hitMoveHandle(pinch, 0.16)
      ) {
        continue;
      }
      const target = this.uiKind(this.uiPick(hand)?.object ?? null);
      if (target?.kind === 'card' && target.cardId) hover = target.cardId;
      if (!hand.justPinched || !target) continue;
      if (target.kind === 'icon' && !this.space.explorerOpen && !this.space.photoOpen) {
        this.openLibrary(input);
        return;
      }
      if (target.kind === 'close' && this.space.explorerOpen && !this.space.photoOpen) {
        this.closeLibrary();
        return;
      }
      if (target.kind === 'folder' && target.folder && this.space.explorerOpen && !this.space.photoOpen) {
        this.explorer.setFolder(target.folder);
        return;
      }
      if (target.kind === 'card' && target.cardId && this.space.explorerOpen && !this.space.photoOpen) {
        const card = this.explorer.cards.find((item) => item.id === target.cardId);
        if (card) {
          void this.selectCard(card.id, card.type, input);
          return;
        }
      }
    }

    if (!this.space.explorerOpen && !this.space.photoOpen) {
      for (const tip of tips) {
        if (tip && this.explorer.hitIcon(tip, 0.14) && pressing) {
          this.openLibrary(input);
          return;
        }
      }
    }
    if (!this.space.explorerOpen || this.space.photoOpen) {
      this.explorer.hover(hover);
      return;
    }
    for (const tip of tips) {
      if (!tip) continue;
      if (this.explorer.hitClose(tip, 0.08) && pressing) {
        this.closeLibrary();
        return;
      }
      const folder = this.explorer.hitFolder(tip, 0.09);
      if (folder && pressing) {
        this.explorer.setFolder(folder);
        return;
      }
      const hit = this.explorer.hitTest(tip, 0.14);
      if (hit) {
        hover = hit.id;
        if (pressing) {
          void this.selectCard(hit.id, hit.type, input);
          return;
        }
      }
    }
    this.explorer.hover(hover);
    for (const filmId of this.filmIds()) {
      const movie = this.films.get(filmId);
      if (movie.status === 'processing') this.explorer.processingVisual(filmId, movie.progress);
    }
    if (
      debugParams.handsLess &&
      !this.desktop &&
      this.space.explorerOpen &&
      !this.space.photoOpen &&
      this.idle > config.handlessDelaySeconds
    ) {
      const photo = this.entries.find((e) => e.type === 'photo');
      if (photo) void this.selectCard(photo.id, 'photo', input);
    }
  }

  private async selectCard(id: string, type: ExplorerEntry['type'], input: FrameInput): Promise<void> {
    if (type === 'photo') {
      await this.openPhotoCard(id, input);
      return;
    }
    this.activeFilmId = id;
    const state = this.films.get(id);
    if (state.status === 'idle' || state.status === 'failed') {
      await this.films.start(id);
      return;
    }
    if (state.status === 'processing') return;
    await this.openMovie(input);
  }

  private async openPhotoCard(id: string, input: FrameInput): Promise<void> {
    this.space = openPhoto(this.space);
    const forward = forwardFrom(input.head.quaternion);
    await this.explorer.openPhotoPrint(id, {
      x: input.head.position.x,
      y: input.head.position.y,
      z: input.head.position.z,
    }, forward);
    // Guidance label on the photo teaches index long-press; no blue ghost overlay.
    this.hintPlayed.pinch = true;
    this.ghost.visible = false;
    this.ghost.userData.anim = undefined;
  }

  private updateConversion(dt: number, input: FrameInput): void {
    if (this.pendingConverted) {
      this.conversionElapsed += dt;
      const progress = Math.min(1, this.conversionElapsed / Math.max(0.05, config.popOutSeconds));
      this.conversion.update(progress);
      if (progress >= 1) {
        const { object, model } = this.pendingConverted;
        this.pendingConverted = null;
        const finished = this.conversion.finish() ?? model;
        const spawn = this.spawnPoint(input);
        this.clearHandFeedback();
        // Place (jelly shader patch) on the next frame so the reveal can finish cleanly.
        void this.finishConversionPlace(object, finished, spawn);
      }
      return;
    }
    if (this.converting) {
      this.clearHandFeedback();
      // Stay in the soft "waiting" band — never the old blue build wire phase.
      this.conversion.update(0.06 + (Math.sin(this.time * 2.2) * 0.5 + 0.5) * 0.1);
      return;
    }
    if (this.space.photoOpen && this.explorer.openPhoto) {
      const photo = this.explorer.openPhoto;
      const objectId = (photo.userData.objectId as string | undefined) ?? null;
      const object =
        (objectId ? this.objects.find((item) => item.id === objectId) : null) ??
        this.objects.find((item) => item.scene === 'object3d');
      // Broad distance hit (Finder-icon style) — thin plane tests failed on Quest.
      let holding = false;
      let holdTip: { x: number; y: number; z: number } | null = null;
      let holdUv: { x: number; y: number } | null = null;
      const hands =
        this.photoHold.hand === 'right'
          ? [this.hands.right, this.hands.left]
          : [this.hands.left, this.hands.right];
      for (const hand of hands) {
        if (!object) break;
        if (this.photoHold.hand && this.photoHold.hand !== hand.handedness) continue;
        const tip = hand.indexTip ?? hand.pinchPosition;
        if (!tip) continue;
        const uv = this.explorer.hitOpenPhoto(tip, 0.2);
        if (!uv) continue;
        holding = true;
        holdTip = tip;
        holdUv = uv;
        if (this.photoHold.hand !== hand.handedness || !this.photoHold.origin) {
          this.photoHold = {
            hand: hand.handedness,
            elapsed: 0,
            origin: { x: tip.x, y: tip.y, z: tip.z },
            uv,
            contacted: false,
            lastTick: 0,
            lost: 0,
          };
        }
        this.photoHold.lost = 0;
        this.photoHold.uv = uv;
        this.photoHold.origin = { x: tip.x, y: tip.y, z: tip.z };
        this.photoHold.elapsed += dt;
        break;
      }

      if (!holding && this.photoHold.contacted && this.photoHold.uv && this.photoHold.origin) {
        this.photoHold.lost += dt;
        if (this.photoHold.lost < 0.35) {
          holding = true;
          holdTip = this.photoHold.origin;
          holdUv = this.photoHold.uv;
        }
      }

      if (!holding || !holdTip || !holdUv || !object) {
        if (this.photoHold.contacted) {
          this.audio.play('clickUp', this.photoHold.origin ?? undefined);
        }
        this.photoHold = emptyPhotoHold();
        this.holdProgressRing.visible = false;
        this.explorer.setPhotoTouchFeedback(null, 0, false);
      } else {
        const progress = Math.min(1, this.photoHold.elapsed / config.longPressSeconds);
        if (!this.photoHold.contacted) {
          this.photoHold.contacted = true;
          this.audio.play('click', holdTip);
        }
        if (progress > 0.12 && progress < 1) {
          const bucket = Math.floor(progress * 5);
          if (bucket !== this.photoHold.lastTick) {
            this.photoHold.lastTick = bucket;
            this.audio.play('tick', holdTip);
          }
        }
        this.explorer.setPhotoTouchFeedback(holdUv, progress, true);
        if (progress >= 1) {
          const tip = holdTip;
          const uv = holdUv;
          this.photoHold = emptyPhotoHold();
          this.holdProgressRing.visible = false;
          this.explorer.setPhotoTouchFeedback(null, 0, false);
          this.audio.play('click', tip);
          void this.beginConversion(object.id, new Vector3(tip.x, tip.y, tip.z), false, uv);
          return;
        }
        if (progress > 0.05) {
          this.holdProgressRing.visible = true;
          this.holdProgressRing.position.set(holdTip.x, holdTip.y, holdTip.z);
          this.holdProgressRing.scale.setScalar(0.55 + progress * 0.7);
          (this.holdProgressRing.material as MeshBasicMaterial).opacity = 0.55 + progress * 0.4;
          this.holdProgressRing.lookAt(input.head.position);
        } else {
          this.holdProgressRing.visible = false;
        }
      }
      if (debugParams.handsLess && !this.desktop && this.idle > config.handlessDelaySeconds && object) {
        void this.beginConversion(object.id, photo.position.clone(), false, { x: 0.5, y: 0.4 });
      }
      return;
    }
    this.photoHold = emptyPhotoHold();
    this.holdProgressRing.visible = false;
    this.updateSceneHold(input);
  }

  private updateSceneHold(input: FrameInput): void {
    if (this.space.explorerOpen || this.space.movieOpen || this.space.photoOpen) return;
    for (const hand of [this.hands.left, this.hands.right]) {
      if (!hand.longPress.fired) continue;
      const tip = hand.pinchPosition ?? hand.indexTip;
      if (tip && this.explorer.hitIcon(tip, 0.12)) continue;
      const origin = tip
        ? new Vector3(tip.x, tip.y, tip.z)
        : input.head.position.clone().add(new Vector3(0, -0.15, -0.45));
      hand.longPress.fired = false;
      void this.beginSceneCapture(origin);
      return;
    }
  }

  private spawnPoint(input: FrameInput): Vector3 {
    const placed = spawnInFront(
      {
        x: input.head.position.x,
        y: input.head.position.y,
        z: input.head.position.z,
      },
      forwardFrom(input.head.quaternion),
      this.surfaces.surfaces,
      config.spawnDistance,
      config.chestOffset,
    );
    return new Vector3(placed.point.x, placed.point.y, placed.point.z);
  }

  private async beginSceneCapture(origin: Vector3): Promise<void> {
    if (this.converting || this.sceneCaptureBusy) return;
    this.sceneCaptureBusy = true;
    this.converting = true;
    this.space.space = 'converting';
    this.conversion.start(origin, true);
    this.audio.play('whoosh', origin);
    try {
      const still = await this.sceneCapture.captureStill();
      if (!still.ok) {
        throw new Error(`${still.reason}: ${still.detail}`);
      }
      console.info('[scene-echoes] scene still', still.label);
      await this.beginConversion(`scene-${Date.now()}`, origin, true, {
        x: 0.5,
        y: 0.5,
        image: still.dataUrl,
        allowFallback: false,
      });
    } catch (error) {
      console.warn('[scene-echoes] scene capture failed', error);
      this.conversion.finish();
      this.converting = false;
      this.space.space = this.space.explorerOpen ? 'explorer' : 'clean';
      this.audio.play('thud', origin);
    } finally {
      this.sceneCaptureBusy = false;
    }
  }

  private async beginConversion(
    id: string,
    origin: Vector3,
    column: boolean,
    point?: ConversionPoint,
  ): Promise<void> {
    if (this.pendingConverted) return;
    const already = this.converting;
    this.converting = true;
    this.space.space = 'converting';
    this.clearHandFeedback();
    if (!already) {
      this.conversion.start(origin, column);
      this.audio.play('whoosh', origin);
    }
    try {
      // Let one frame paint the conversion FX before any GLB work.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const handle = await this.modelSource.request(id, point);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const model = handle.root as Group;
      this.conversion.attachModel(model);
      this.conversionElapsed = 0;
      this.pendingConverted = { object: handle.object, model, origin };
    } catch (error) {
      console.warn('[scene-echoes] conversion failed', error);
      this.conversion.finish();
      this.converting = false;
      this.pendingConverted = null;
      this.space.space = this.space.photoOpen ? 'photo' : this.space.explorerOpen ? 'explorer' : 'clean';
      this.audio.play('thud', origin);
    }
  }

  private clearHandFeedback(): void {
    this.holdProgressRing.visible = false;
    this.explorer?.setPhotoTouchFeedback(null, 0, false);
    this.ghost.visible = false;
    this.ghost.userData.anim = undefined;
  }

  private async finishConversionPlace(
    object: ManifestObject,
    model: Group,
    spawn: Vector3,
  ): Promise<void> {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    this.placeConverted(object, model, spawn);
    this.audio.play('chime', spawn);
    this.converting = false;
    if (this.space.photoOpen) {
      this.explorer.closePhoto();
      this.space = closePhoto(this.space);
    }
  }

  private placeConverted(object: ManifestObject, model: Group, origin: Vector3): void {
    const capped =
      object.realSize > config.maxSpawnRealSize
        ? { ...object, realSize: config.maxSpawnRealSize }
        : object;
    const item = makePlacedObject(capped, model);
    if (object.realSize > config.maxSpawnRealSize && object.realSize > 0) {
      const factor = config.maxSpawnRealSize / object.realSize;
      item.scale = factor;
      item.root.scale.setScalar(factor);
    }
    item.root.position.copy(origin);
    item.falling = false;
    const limited = applyObjectLimit(this.placedObjects, item, config.maxObjects);
    if (limited.removed) this.placed.remove(limited.removed.root);
    this.placedObjects = limited.objects;
    this.placed.add(item.root);
    this.carrying = null;
    this.grab = null;
  }

  private updateGrab(dt: number, input: FrameInput): void {
    this.landingRing.visible = false;
    if (this.updateTwoHandResize()) {
      void dt;
      return;
    }

    const activeHand = this.grab
      ? this.grab.hand === 'left'
        ? this.hands.left
        : this.hands.right
      : this.hands.left.pinched
        ? this.hands.left
        : this.hands.right.pinched
          ? this.hands.right
          : null;

    // Sticky hold: keep the same hand until that pinch clearly opens.
    if (this.grab && (!activeHand?.pinched || !activeHand.pinchPosition)) {
      this.releaseGrab();
      return;
    }

    if (!this.grab) {
      if (!activeHand?.pinched || !activeHand.pinchPosition) return;
      const p = activeHand.pinchPosition;
      if (this.space.explorerOpen && !this.space.photoOpen) {
        const ui = this.uiKind(this.uiPick(activeHand)?.object ?? null);
        const onInteractive = ui?.kind === 'card' || ui?.kind === 'close' || ui?.kind === 'folder';
        if (!onInteractive && this.explorer.hitMoveHandle(p, 0.2)) {
          this.grabOffset.set(
            this.explorer.group.position.x - p.x,
            this.explorer.group.position.y - p.y,
            this.explorer.group.position.z - p.z,
          );
          this.grab = { kind: 'explorer', id: 'finder', hand: activeHand.handedness };
          return;
        }
      }
      const grabbed = this.placedObjects.find((item) => this.canGrabObject(item, p));
      if (grabbed) {
        grabbed.falling = false;
        this.grabOffset.set(
          grabbed.root.position.x - p.x,
          grabbed.root.position.y - p.y,
          grabbed.root.position.z - p.z,
        );
        this.grab = { kind: 'object3d', id: grabbed.id, hand: activeHand.handedness };
        this.carrying = grabbed.root;
        this.grabYaw = {
          object: grabbed.root.rotation.y,
          hand: handHorizontalYaw(activeHand, p, grabbed.root.position),
        };
        this.audio.play('whoosh', grabbed.root.position);
      } else {
        const movieObj = this.movie.objects.find((o) => o.root.position.distanceTo(p as never) < 0.4);
        if (movieObj) {
          movieObj.grabbed = true;
          this.grabOffset.set(
            movieObj.root.position.x - p.x,
            movieObj.root.position.y - p.y,
            movieObj.root.position.z - p.z,
          );
          this.grab = { kind: 'movie', id: movieObj.id, hand: activeHand.handedness };
        } else if (
          this.screen.group.visible &&
          this.screen.group.position.distanceTo(p as never) < 0.6
        ) {
          this.grabOffset.set(0, 0, 0);
          this.grab = { kind: 'screen', id: 'screen', hand: activeHand.handedness };
        }
      }
    }

    if (!this.grab || !activeHand?.pinchPosition) return;
    const pinch = activeHand.pinchPosition;
    if (this.grab.kind === 'explorer') {
      this.explorer.moveTo(
        {
          x: pinch.x + this.grabOffset.x,
          y: pinch.y + this.grabOffset.y,
          z: pinch.z + this.grabOffset.z,
        },
        {
          x: input.head.position.x,
          y: input.head.position.y,
          z: input.head.position.z,
        },
      );
      return;
    }
    const target = this.grabTarget();
    if (target && this.grab.kind !== 'screen') {
      target.position.set(
        pinch.x + this.grabOffset.x,
        pinch.y + this.grabOffset.y,
        pinch.z + this.grabOffset.z,
      );
      if (this.grab.kind === 'object3d') {
        const handYaw = handHorizontalYaw(activeHand, pinch, target.position);
        target.rotation.y = this.grabYaw.object + (handYaw - this.grabYaw.hand);
        target.rotation.x = 0;
        target.rotation.z = 0;
      }
    }
    if (this.grab.kind === 'screen') {
      this.screen.group.position.set(pinch.x, pinch.y, pinch.z);
    }
    void dt;
  }

  /**
   * Two-hand resize: both hands must be pinched near the object.
   * Spread apart to grow, bring together to shrink. Open either hand to stop.
   * Ignores small jitters so casual touch does not reshape the model.
   */
  private updateTwoHandResize(): boolean {
    const leftPinch = this.hands.left.pinched ? this.hands.left.pinchPosition : null;
    const rightPinch = this.hands.right.pinched ? this.hands.right.pinchPosition : null;
    if (!leftPinch || !rightPinch) {
      this.endTwoHandResize();
      return false;
    }
    const item = this.placedObjects.find(
      (f) => this.canGrabObject(f, leftPinch) && this.canGrabObject(f, rightPinch),
    );
    if (!item) {
      this.endTwoHandResize();
      return false;
    }
    const distance = Math.hypot(
      leftPinch.x - rightPinch.x,
      leftPinch.y - rightPinch.y,
      leftPinch.z - rightPinch.z,
    );
    // Hands must be clearly apart before resize arms — avoids accidental squish.
    if (distance < 0.18) {
      if (this.twoHandScale === null) return false;
      this.endTwoHandResize();
      return false;
    }
    const handsYaw = Math.atan2(rightPinch.x - leftPinch.x, rightPinch.z - leftPinch.z);
    if (this.twoHandScale === null || this.twoHandScaleBase === null) {
      this.twoHandScale = distance;
      this.twoHandScaleBase = item.scale;
      this.twoHandYaw = { object: item.root.rotation.y, hands: handsYaw };
      item.falling = false;
      setObjectContacts(item, []);
      return true;
    }
    // Spin left/right from the two-hand line; never tilt up/down.
    item.root.rotation.y = this.twoHandYaw.object + (handsYaw - this.twoHandYaw.hands);
    item.root.rotation.x = 0;
    item.root.rotation.z = 0;
    const ratio = distance / this.twoHandScale;
    // Deadzone: ignore tiny hand wobble so the shape stays stable.
    if (Math.abs(ratio - 1) < 0.08) return true;
    const damped = 1 + (ratio - 1) * 0.55;
    resizeObject(item, this.twoHandScaleBase * damped);
    setObjectContacts(item, []);
    return true;
  }

  private endTwoHandResize(): void {
    if (this.twoHandScale === null) return;
    this.twoHandScale = null;
    this.twoHandScaleBase = null;
    this.twoHandYaw = { object: 0, hands: 0 };
  }

  private releaseGrab(): void {
    if (this.grab?.kind === 'object3d') {
      const item = this.placedObjects.find((f) => f.id === this.grab?.id);
      if (item) {
        const above = nearestHorizontal(this.surfaces.surfaces, item.root.position);
        const floorY = above ? above.origin.y : item.root.position.y;
        if (item.root.position.y > floorY + 0.05) dropObject(item);
        this.audio.play('thud', item.root.position);
      }
    }
    if (this.grab?.kind === 'movie') {
      const movieObj = this.movie.objects.find((o) => o.id === this.grab?.id);
      if (movieObj) movieObj.grabbed = false;
    }
    this.grab = null;
    this.carrying = null;
    this.landingRing.visible = false;
    this.twoHandScale = null;
    this.twoHandScaleBase = null;
    this.grabYaw = { object: 0, hand: 0 };
    this.twoHandYaw = { object: 0, hands: 0 };
    this.grabOffset.set(0, 0, 0);
  }

  private canGrabObject(
    item: PlacedObject,
    point: { x: number; y: number; z: number },
  ): boolean {
    if (isOnObject(item, point)) return true;
    const reach = Math.max(0.45, item.object.realSize * 0.7 + config.grabReachPad);
    return item.root.position.distanceTo(point as never) < reach;
  }

  private grabTarget(): Group | null {
    if (!this.grab) return null;
    if (this.grab.kind === 'object3d') return this.placedObjects.find((f) => f.id === this.grab?.id)?.root ?? null;
    if (this.grab.kind === 'movie') return this.movie.objects.find((o) => o.id === this.grab?.id)?.root ?? null;
    return null;
  }

  private updatePlacedObjects(dt: number, input: FrameInput): void {
    for (const item of this.placedObjects) {
      if (this.grab?.kind === 'object3d' && this.grab.id === item.id) continue;
      if (this.twoHandScale !== null) {
        setObjectContacts(item, []);
        updatePlacedObject(item, dt, this.surfaces.surfaces, false, false, this.time, false);
        continue;
      }
      const contacts = [];
      let seatPress = this.seatPressed === item;
      const holdPoint = this.seatPressed === item ? this.desktopHold?.point : null;
      if (holdPoint) {
        contacts.push({ x: holdPoint.x, y: holdPoint.y, z: holdPoint.z, strength: 1, time: this.time });
      }
      for (const hand of [this.hands.left, this.hands.right]) {
        // While either hand is pinched to grab/scale, do not squash the mesh.
        if (hand.pinched) continue;
        const tip = hand.indexTip ?? hand.palm;
        if (!tip) continue;
        if (isOnObject(item, tip)) {
          contacts.push({ x: tip.x, y: tip.y, z: tip.z, strength: 1, time: this.time });
        }
      }
      setObjectContacts(item, contacts);
      const palmPress = [this.hands.left, this.hands.right].some(
        (h) => h.open && h.palm && h.palm.y > item.root.position.y && item.root.position.distanceTo(h.palm as never) < 0.45,
      );
      const poke = pokeSurface(this.hands.left, contacts.length ? 0.01 : null, dt);
      const wasUp = item.squash.displacement > 0.92;
      updatePlacedObject(item, dt, this.surfaces.surfaces, palmPress, poke, this.time, seatPress);
      if (wasUp && seatPress && item.object.scene === 'object3d') {
        pressSeat(item, contacts[0]);
        this.audio.play('boing', item.root.position);
      }
    }
    void input;
  }

  private updateBookHold(input: FrameInput): void {
    if (this.space.explorerOpen || this.space.movieOpen || this.space.photoOpen || this.converting) return;
    const floorY = floorHeight(this.surfaces.surfaces);
    for (const hand of [this.hands.left, this.hands.right]) {
      if (!hand.surfaceHold.fired || !hand.indexTip) continue;
      const near = fingertipNearSurface(hand.indexTip, this.surfaces.surfaces);
      if (!near || !isElevatedSurface(near.surface, floorY, config.bookTableAboveFloor)) continue;
      hand.surfaceHold.fired = false;
      void this.beginSceneCapture(new Vector3(hand.indexTip.x, hand.indexTip.y, hand.indexTip.z));
      return;
    }
    void input;
  }

  private async openMovie(input: FrameInput): Promise<void> {
    this.space = openMovie(this.space);
    this.explorer.setOpen(false, { x: 0, y: 0, z: 0 }, { x: 0, z: -1 });
    const forward = forwardFrom(input.head.quaternion);
    this.screen.place(input.head.position, forward);
    await this.screen.play(debugParams.startTime ?? 0);
  }

  private updateMovie(dt: number, input: FrameInput): void {
    if (!this.space.movieOpen) return;
    this.screen.update(dt);
    const poke =
      pokeSurface(this.hands.left, distanceToScreen(this.hands.left.indexTip, this.screen), dt) ||
      pokeSurface(this.hands.right, distanceToScreen(this.hands.right.indexTip, this.screen), dt);
    if (poke) this.screen.togglePause();
    if (this.screen.paused && this.explorer.visible) return;
    const forward = forwardFrom(input.head.quaternion);
    const right = { x: forward.z, z: -forward.x };
    const floor = this.surfaces.surfaces.find((s) => s.horizontal);
    const floorY = floor?.origin.y ?? 0;
    if (!this.screen.paused) {
      void this.movie.tick(
        this.screen.currentTime(),
        this.timeline.moments,
        input.head.position,
        forward,
        right,
        this.surfaces.surfaces,
        (_id, pos) => this.audio.play('shimmer', pos),
      );
    }
    this.movie.update(dt, this.time, input.head.position, forward, right, this.surfaces.surfaces, floorY);
    const tip = this.hands.left.indexTip ?? this.hands.right.indexTip;
    if (tip) {
      const hit = this.movie.touch(new Vector3(tip.x, tip.y, tip.z));
      if (hit) this.audio.play(hit.reaction.name ?? 'glow', hit.root.position);
    }
    this.audio.setRain(this.movie.rain.points.visible, this.screen.group.position);
  }

  private tryPalmCalibrate(): void {
    for (const hand of [this.hands.left, this.hands.right]) {
      if (!hand.open || !hand.palm) continue;
      if (this.surfaces.surfaces.some((s) => s.source === 'plane')) continue;
      if (handSpeed(hand) < 0.15) {
        upsertSurface(this.surfaces, palmCalibrate(hand.palm, hand.palmNormal));
      }
    }
  }

  private anyTouch(): boolean {
    return this.placedObjects.length + this.movie.objects.length > 0 && this.hands.anyPinch;
  }

  private nextMomentLabel(): string | null {
    const t = this.space.movieOpen ? this.screen.currentTime() : -1;
    return this.timeline.moments.find((m) => m.time > t)?.id ?? null;
  }

  private async spawnDebugObject(id: string): Promise<void> {
    const object = this.objects.find((item) => item.id === id);
    if (!object) return;
    const model = await loadModel(object);
    this.placeConverted(object, model, new Vector3(0, 0, -0.8));
    this.grab = null;
    this.carrying = null;
  }

  private beginDesktopHold(event: PointerEvent, camera: Camera): void {
    const hit = this.pickDesktop(event, camera);
    this.desktopHold = {
      x: event.clientX,
      y: event.clientY,
      started: performance.now(),
      kind: hit.kind,
      point: hit.point,
      uv: hit.uv,
      cardId: hit.cardId,
      cardType: hit.cardType,
      folder: hit.folder,
      fired: false,
    };
    if ((hit.kind === 'photo' || hit.kind === 'seat') && this.desktopControls) {
      this.desktopControls.enabled = false;
    }
    if (hit.kind === 'seat' && hit.seatItem) {
      this.seatPressed = hit.seatItem;
      pressSeat(hit.seatItem, hit.point ?? undefined);
      this.audio.play('boing', hit.seatItem.root.position);
    }
  }

  private moveDesktopHold(event: PointerEvent): void {
    const hold = this.desktopHold;
    if (!hold || hold.fired) return;
    const moved = Math.hypot(event.clientX - hold.x, event.clientY - hold.y);
    if (moved <= 12) return;
    if (hold.kind === 'photo') this.clearDesktopHold();
    else if (hold.kind === 'seat') {
      this.seatPressed = null;
      hold.kind = 'other';
      if (this.desktopControls) this.desktopControls.enabled = true;
    } else hold.kind = 'other';
  }

  private endDesktopHold(event: PointerEvent, camera: Camera): void {
    const hold = this.desktopHold;
    this.clearDesktopHold();
    if (!hold || hold.fired) return;
    const moved = Math.hypot(event.clientX - hold.x, event.clientY - hold.y);
    if (moved > 8) return;
    if (hold.kind === 'icon') {
      this.openLibrary(this.desktopFrame(camera));
      return;
    }
    if (hold.kind === 'close') {
      this.closeLibrary();
      return;
    }
    if (hold.kind === 'folder' && hold.folder) {
      this.explorer.setFolder(hold.folder);
      return;
    }
    if (hold.kind === 'card' && hold.cardId && hold.cardType) {
      void this.selectCard(hold.cardId, hold.cardType, this.desktopFrame(camera));
      return;
    }
    if (this.space.movieOpen) {
      const hit = this.pickDesktop(event, camera);
      if (hit.kind === 'other' && hit.onScreen) this.screen.togglePause();
    }
  }

  private updateDesktopHold(): void {
    const hold = this.desktopHold;
    if (!this.desktop || !hold || hold.fired) return;
    if ((performance.now() - hold.started) / 1000 < config.longPressSeconds) return;
    if (hold.kind === 'photo') {
      if (!hold.point || !hold.uv) return;
      hold.fired = true;
      const object = this.objects.find((item) => item.scene === 'object3d');
      if (object) void this.beginConversion(object.id, hold.point.clone(), false, hold.uv);
      if (this.desktopControls) this.desktopControls.enabled = true;
      return;
    }
    if (
      hold.kind === 'other' &&
      !this.space.explorerOpen &&
      !this.space.photoOpen &&
      !this.space.movieOpen
    ) {
      hold.fired = true;
      void this.beginSceneCapture(hold.point?.clone() ?? new Vector3(0, 1, -0.5));
      if (this.desktopControls) this.desktopControls.enabled = true;
    }
  }

  private clearDesktopHold(): void {
    this.desktopHold = null;
    this.seatPressed = null;
    if (this.desktopControls) this.desktopControls.enabled = true;
  }

  private pickDesktop(
    event: PointerEvent,
    camera: Camera,
  ): {
    kind: 'photo' | 'card' | 'icon' | 'close' | 'seat' | 'folder' | 'other';
    point: Vector3 | null;
    uv: { x: number; y: number } | null;
    cardId?: string;
    cardType?: ExplorerEntry['type'];
    seatItem?: PlacedObject;
    folder?: FinderSection;
    onScreen: boolean;
  } {
    const empty = { kind: 'other' as const, point: null, uv: null, onScreen: false };
    const canvas = this.renderer?.domElement;
    if (!canvas) return empty;
    const rect = canvas.getBoundingClientRect();
    this.desktopPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.desktopPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.desktopRay.setFromCamera(this.desktopPointer, camera);
    const targets = [
      this.explorer.iconGroup,
      this.explorer.group,
      this.explorer.photoGroup,
      this.placed,
      this.screen.group,
    ];
    const hits = this.desktopRay.intersectObjects(targets, true);
    const point = hits[0]?.point.clone() ?? null;
    if (this.space.photoOpen && this.explorer.openPhoto) {
      this.explorer.openPhoto.updateWorldMatrix(true, true);
      const photoHit = hits.find((hit) => hit.object.userData.photoPrint) ?? hits[0];
      const photoPoint = photoHit?.point.clone() ?? point;
      if (photoPoint) {
        const uv = worldToPhotoUv(photoPoint, this.explorer.openPhoto, 0.04);
        if (uv) return { kind: 'photo', point: photoPoint, uv, onScreen: false };
      }
    }
    const iconHit = hits.find((hit) => hit.object.userData.appIcon);
    if (iconHit && !this.space.explorerOpen && !this.space.photoOpen) {
      return { kind: 'icon', point, uv: null, onScreen: false };
    }
    if (this.space.explorerOpen && point) {
      if (hits.some((hit) => hit.object.userData.close)) {
        return { kind: 'close', point, uv: null, onScreen: false };
      }
      const folderHit = hits.find((hit) => typeof hit.object.userData.folder === 'string');
      if (folderHit) {
        return {
          kind: 'folder',
          point,
          uv: null,
          folder: folderHit.object.userData.folder as FinderSection,
          onScreen: false,
        };
      }
      const cardHit = hits.find((hit) => typeof hit.object.userData.cardId === 'string');
      const cardId = cardHit?.object.userData.cardId as string | undefined;
      const card = cardId ? this.explorer.cards.find((item) => item.id === cardId) : this.explorer.hitTest(point, 0.12);
      if (card) {
        return { kind: 'card', point, uv: null, cardId: card.id, cardType: card.type, onScreen: false };
      }
    }
    if (point && hits[0] && !this.space.photoOpen) {
      const item = placedObjectAt(hits[0].object, this.placedObjects);
      if (item?.object.scene === 'object3d') {
        return { kind: 'seat', point, uv: null, seatItem: item, onScreen: false };
      }
    }
    const onScreen = Boolean(
      hits[0] && this.screen.group.visible && (hits[0].object === this.screen.mesh || this.screen.group.getObjectById(hits[0].object.id)),
    );
    return { kind: 'other', point, uv: null, onScreen };
  }

  private desktopFrame(camera: Camera): FrameInput {
    return {
      left: null,
      right: null,
      planes: this.surfaces.surfaces,
      head: {
        position: camera.position.clone(),
        quaternion: {
          x: camera.quaternion.x,
          y: camera.quaternion.y,
          z: camera.quaternion.z,
          w: camera.quaternion.w,
        },
      },
      paused: false,
    };
  }

  private async applyLiveFilm(result: LiveFilmResult): Promise<void> {
    for (const object of result.objects) {
      const bytes = result.glbs[object.id];
      if (!bytes) continue;
      cacheModelTemplate(object.id, await loadGlbBytes(bytes));
    }
    this.movie.replaceCatalog(result.objects);
    this.timeline = { moments: parseTimelineMoments(result.timeline) };
    this.movie.reset();
  }

  private filmIds(): string[] {
    return this.entries.filter((entry) => entry.type === 'video').map((entry) => entry.id);
  }

  private activeFilm() {
    const id = this.activeFilmId ?? this.filmIds()[0];
    return id ? this.films.get(id) : null;
  }

  private async preloadFilm(filmId: string, report: (progress: number) => void): Promise<void> {
    await this.screen.preload(filmId);
    report(1);
  }
}

function placedObjectAt(
  object: { parent?: unknown } | null,
  items: PlacedObject[],
): PlacedObject | null {
  let current: { parent?: unknown } | null = object;
  while (current) {
    const match = items.find((item) => item.root === current || item.visual === current);
    if (match) return match;
    current = (current.parent as { parent?: unknown } | null) ?? null;
  }
  return null;
}

function forwardFrom(q: { x: number; y: number; z: number; w: number }): { x: number; z: number } {
  // Horizontal view direction (camera local -Z), without the old abs(z) clamp that
  // made HUD/panels slide sideways when turning.
  const x = 2 * (q.x * q.z + q.w * q.y);
  const z = -(1 - 2 * (q.x * q.x + q.y * q.y));
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len };
}

/** Horizontal-only facing from the hand — used to yaw objects without pitching. */
function handHorizontalYaw(
  hand: { rayDirection: { x: number; y: number; z: number } | null },
  pinch: { x: number; y: number; z: number },
  objectPos: { x: number; y: number; z: number },
): number {
  const dir = hand.rayDirection;
  if (dir && Math.hypot(dir.x, dir.z) > 0.001) {
    return Math.atan2(dir.x, dir.z);
  }
  return Math.atan2(pinch.x - objectPos.x, pinch.z - objectPos.z);
}

function emptyPhotoHold(): {
  hand: 'left' | 'right' | null;
  elapsed: number;
  origin: { x: number; y: number; z: number } | null;
  uv: { x: number; y: number } | null;
  contacted: boolean;
  lastTick: number;
  lost: number;
} {
  return { hand: null, elapsed: 0, origin: null, uv: null, contacted: false, lastTick: 0, lost: 0 };
}

function worldToPhotoUv(
  point: { x: number; y: number; z: number },
  photo: Mesh,
  edgePad = 0,
): { x: number; y: number } | null {
  const local = photo.worldToLocal(new Vector3(point.x, point.y, point.z));
  const size = photo.userData.photoSize as { width: number; height: number } | undefined;
  const w = size?.width ?? config.openPhotoWidth;
  const h = size?.height ?? config.openPhotoWidth * 0.75;
  if (local.z > 0.45 || local.z < -0.2) return null;
  const u = local.x / w + 0.5;
  const v = 0.5 - local.y / h;
  const pad = edgePad;
  if (u < -pad || u > 1 + pad || v < -pad || v > 1 + pad) return null;
  return { x: Math.min(1, Math.max(0, u)), y: Math.min(1, Math.max(0, v)) };
}

function distanceToScreen(tip: { x: number; y: number; z: number } | null, screen: VideoScreen): number | null {
  if (!tip) return null;
  return screen.group.position.distanceTo(tip as never);
}
