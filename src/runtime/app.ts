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
import { farPlacePoint } from '../core/placement.js';
import { applyObjectLimit } from '../core/object-limit.js';
import { createFallbackLights } from '../core/lighting.js';
import { createGhostHand, playGhostPinchHold, playGhostSlide } from '../core/ghost-hand.js';
import { PointerRay } from '../core/pointer-ray.js';
import { SceneCapture } from '../core/scene-capture.js';
import { FileExplorer } from '../library/explorer.js';
import type { FinderSection } from '../assets/drawn.js';
import { createModelSource, createFilmProcessing, type LiveFilmResult } from '../conversion/source.js';
import { ConversionAnimation } from '../conversion/animation.js';
import type { ConversionPoint, FilmProcessing, ModelSource } from '../conversion/types.js';
import {
  dropFurniture,
  isOnFurniture,
  makeFurniture,
  pressSeat,
  resizeFurniture,
  setFurnitureContacts,
  updateFurniture,
  type PlacedFurniture,
} from '../scenes/furniture.js';
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
  furniture: PlacedFurniture[] = [];
  movie = new MovieScene([]);
  screen = new VideoScreen();
  conversion = new ConversionAnimation();
  ghost = createGhostHand();
  placed = new Group();
  book: BookDetector = createBookDetector();
  leftRay = new PointerRay();
  rightRay = new PointerRay();
  landingRing = new Mesh(
    new RingGeometry(0.08, 0.09, 32),
    new MeshBasicMaterial({ color: new Color('#dff6e8'), transparent: true, opacity: 0.4 }),
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
    | { kind: 'furniture' | 'movie' | 'screen'; id: string; hand: 'left' | 'right' }
    | null = null;
  twoHandScale: number | null = null;
  hintPlayed = { slide: false, pinch: false };
  time = 0;
  fps = 0;
  frames = 0;
  fpsT = 0;
  private storage: Storage | null;
  private carrying: Group | null = null;
  private desktopControls: OrbitControls | null = null;
  private desktopRay = new Raycaster();
  private pointerRaycaster = new Raycaster();
  private pointerOrigin = new Vector3();
  private pointerDir = new Vector3();
  private desktopPointer = new Vector2();
  private seatPressed: PlacedFurniture | null = null;
  private desktopHold: {
    x: number;
    y: number;
    started: number;
    kind: 'photo' | 'card' | 'icon' | 'close' | 'seat' | 'folder' | 'other';
    point: Vector3 | null;
    uv: { x: number; y: number } | null;
    cardId?: string;
    cardType?: ExplorerEntry['type'];
    seatItem?: PlacedFurniture;
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
    this.scene.add(
      this.placed,
      this.conversion.group,
      this.ghost,
      this.landingRing,
      this.screen.group,
      this.leftRay.group,
      this.rightRay.group,
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
    this.leftRay.group.visible = false;
    this.rightRay.group.visible = false;
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
    this.explorer.placeDock(
      { x: 0, y: 1.05, z: 0.4 },
      { x: 0, z: -1 },
    );
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
    this.updatePointerRays(input);
    this.updateExplorer(dt, input);
    this.updateConversion(dt, input);
    this.updateGrab(dt, input);
    this.updateFurniture(dt, input);
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
      y: input.head.position.y - config.chestOffset,
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
    const idle = !this.hands.anyPinch && !this.space.explorerOpen && this.furniture.length === 0;
    this.idle = idle ? this.idle + dt : 0;
    if (!this.hintPlayed.slide && this.idle > config.hintIdleSeconds) {
      this.hintPlayed.slide = true;
      playGhostSlide(this.ghost, 0);
      this.ghost.userData.anim = { kind: 'slide', t: 0 };
    }
    const anim = this.ghost.userData.anim as { kind: string; t: number } | undefined;
    if (anim) {
      anim.t += dt / config.ghostHintSeconds;
      if (anim.kind === 'slide') playGhostSlide(this.ghost, anim.t);
      if (anim.t >= 1) {
        this.ghost.visible = false;
        this.ghost.userData.anim = undefined;
      }
    }
    void input;
  }

  private updatePointerRays(input: FrameInput): void {
    if (this.desktop) {
      this.leftRay.group.visible = false;
      this.rightRay.group.visible = false;
      return;
    }
    this.leftRay.update(
      this.hands.left.rayOrigin,
      this.hands.left.rayDirection,
      this.pointerPick(this.hands.left)?.point ?? null,
    );
    this.rightRay.update(
      this.hands.right.rayOrigin,
      this.hands.right.rayDirection,
      this.pointerPick(this.hands.right)?.point ?? null,
    );
    void input;
  }

  private pointerPick(hand: { rayOrigin: { x: number; y: number; z: number } | null; rayDirection: { x: number; y: number; z: number } | null }): {
    object: Object3D;
    point: Vector3;
  } | null {
    if (!hand.rayOrigin || !hand.rayDirection) return null;
    this.pointerOrigin.set(hand.rayOrigin.x, hand.rayOrigin.y, hand.rayOrigin.z);
    this.pointerDir.set(hand.rayDirection.x, hand.rayDirection.y, hand.rayDirection.z).normalize();
    this.pointerRaycaster.set(this.pointerOrigin, this.pointerDir);
    this.pointerRaycaster.far = 4;
    const hits = this.pointerRaycaster.intersectObjects(
      [this.explorer.iconGroup, this.explorer.group, this.explorer.photoGroup],
      true,
    );
    const hit = hits.find((entry) => entry.object.visible);
    return hit ? { object: hit.object, point: hit.point } : null;
  }

  private pointerKind(object: Object3D | null): {
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
    if (!this.desktop) {
      this.explorer.placeDock(
        {
          x: input.head.position.x,
          y: input.head.position.y - config.chestOffset,
          z: input.head.position.z,
        },
        forwardFrom(input.head.quaternion),
      );
    }
    let hover: string | null = null;
    for (const hand of [this.hands.left, this.hands.right]) {
      const target = this.pointerKind(this.pointerPick(hand)?.object ?? null);
      if (target?.kind === 'card' && target.cardId) hover = target.cardId;
      if (!hand.justPinched || !target) continue;
      if (target.kind === 'icon' && !this.space.explorerOpen && !this.space.photoOpen) {
        this.openLibrary(input);
        return;
      }
      if (target.kind === 'close' && this.space.explorerOpen) {
        this.closeLibrary();
        return;
      }
      if (target.kind === 'folder' && target.folder && this.space.explorerOpen) {
        this.explorer.setFolder(target.folder);
        return;
      }
      if (target.kind === 'card' && target.cardId && this.space.explorerOpen) {
        const card = this.explorer.cards.find((item) => item.id === target.cardId);
        if (card) void this.selectCard(card.id, card.type, input);
        return;
      }
    }
    const tips = [this.hands.left.indexTip, this.hands.right.indexTip, this.hands.left.pinchPosition, this.hands.right.pinchPosition];
    const pressing =
      this.hands.left.justPinched ||
      this.hands.right.justPinched ||
      pokeSurface(this.hands.left, 0.01, dt) ||
      pokeSurface(this.hands.right, 0.01, dt);
    if (!this.space.explorerOpen && !this.space.photoOpen) {
      for (const tip of tips) {
        if (tip && this.explorer.hitIcon(tip, 0.1) && pressing) {
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
      if (this.explorer.hitClose(tip, 0.06) && pressing) {
        this.closeLibrary();
        return;
      }
      const folder = this.explorer.hitFolder(tip, 0.07);
      if (folder && pressing) {
        this.explorer.setFolder(folder);
        return;
      }
      const hit = this.explorer.hitTest(tip, 0.08);
      if (hit) {
        hover = hit.id;
        if (pressing) {
          void this.selectCard(hit.id, hit.type, input);
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
      y: input.head.position.y - config.chestOffset,
      z: input.head.position.z,
    }, forward);
    if (!this.hintPlayed.pinch) {
      this.hintPlayed.pinch = true;
      const photo = this.explorer.openPhoto;
      if (photo) playGhostPinchHold(this.ghost, 0, photo.position);
      this.ghost.userData.anim = { kind: 'pinch', t: 0 };
    }
  }

  private updateConversion(dt: number, input: FrameInput): void {
    if (this.pendingConverted) {
      this.conversionElapsed += dt;
      const progress = Math.min(1, this.conversionElapsed / Math.max(0.05, config.popOutSeconds));
      this.conversion.update(progress);
      if (progress >= 1) {
        const { object, model, origin } = this.pendingConverted;
        const finished = this.conversion.finish() ?? model;
        this.placeConverted(object, finished, origin);
        this.audio.play('chime', origin);
        this.converting = false;
        this.pendingConverted = null;
        if (this.space.photoOpen) {
          this.explorer.closePhoto();
          this.space = closePhoto(this.space);
        }
      }
      return;
    }
    if (this.converting) {
      this.conversion.update(0.18 + (Math.sin(this.time * 2.4) * 0.5 + 0.5) * 0.25);
      return;
    }
    if (this.space.photoOpen && this.explorer.openPhoto) {
      const object = this.objects.find((item) => item.scene === 'furniture');
      const photo = this.explorer.openPhoto;
      for (const hand of [this.hands.left, this.hands.right]) {
        if (!hand.longPress.fired || !hand.pinchPosition || !object || !photo) continue;
        const uv = worldToPhotoUv(hand.pinchPosition, photo);
        if (uv) {
          void this.beginConversion(
            object.id,
            new Vector3(hand.pinchPosition.x, hand.pinchPosition.y, hand.pinchPosition.z),
            false,
            uv,
          );
        }
      }
      if (debugParams.handsLess && !this.desktop && this.idle > config.handlessDelaySeconds && object) {
        void this.beginConversion(object.id, photo.position.clone(), false, { x: 0.5, y: 0.4 });
      }
      return;
    }
    this.updateSceneHold(input);
  }

  private updateSceneHold(input: FrameInput): void {
    if (this.space.explorerOpen || this.space.movieOpen || this.space.photoOpen) return;
    for (const hand of [this.hands.left, this.hands.right]) {
      if (!hand.longPress.fired) continue;
      if (this.pointerKind(this.pointerPick(hand)?.object ?? null)) continue;
      const origin = hand.pinchPosition
        ? new Vector3(hand.pinchPosition.x, hand.pinchPosition.y, hand.pinchPosition.z)
        : input.head.position.clone().add(new Vector3(0, -0.15, -0.45));
      hand.longPress.fired = false;
      void this.beginSceneCapture(origin);
      return;
    }
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
    if (!already) {
      this.conversion.start(origin, column);
      this.audio.play('whoosh', origin);
    }
    try {
      const handle = await this.modelSource.request(id, point);
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

  private placeConverted(object: ManifestObject, model: Group, origin: Vector3): void {
    const item = makeFurniture(object, model);
    item.root.position.copy(origin);
    const limited = applyObjectLimit(this.furniture, item, config.maxObjects);
    if (limited.removed) this.placed.remove(limited.removed.root);
    this.furniture = limited.objects;
    this.placed.add(item.root);
    this.carrying = item.root;
    this.grab = { kind: 'furniture', id: item.id, hand: this.hands.left.pinched ? 'left' : 'right' };
  }

  private updateGrab(dt: number, input: FrameInput): void {
    const pinchHand = this.hands.left.pinched ? this.hands.left : this.hands.right.pinched ? this.hands.right : null;
    if (!pinchHand?.pinchPosition) {
      if (this.grab?.kind === 'furniture') {
        const item = this.furniture.find((f) => f.id === this.grab?.id);
        if (item && handSpeed(pinchHand ?? this.hands.left) > config.flickSpeed) {
          this.placed.remove(item.root);
          this.furniture = this.furniture.filter((f) => f !== item);
          this.audio.play('whoosh', item.root.position);
        } else if (item) {
          const above = nearestHorizontal(this.surfaces.surfaces, item.root.position);
          const floorY = above ? above.origin.y : item.root.position.y;
          if (item.root.position.y > floorY + 0.05) dropFurniture(item);
          this.audio.play('thud', item.root.position);
        }
      }
      this.grab = null;
      this.carrying = null;
      this.landingRing.visible = false;
      return;
    }
    if (!this.grab) {
      const p = pinchHand.pinchPosition;
      const furniture = this.furniture.find((f) => f.root.position.distanceTo(p as never) < 0.35);
      if (furniture) this.grab = { kind: 'furniture', id: furniture.id, hand: pinchHand.handedness };
      const movieObj = this.movie.objects.find((o) => o.root.position.distanceTo(p as never) < 0.25);
      if (movieObj) {
        movieObj.grabbed = true;
        this.grab = { kind: 'movie', id: movieObj.id, hand: pinchHand.handedness };
      }
      if (this.screen.group.visible && this.screen.group.position.distanceTo(p as never) < 0.6) {
        this.grab = { kind: 'screen', id: 'screen', hand: pinchHand.handedness };
      }
    }
    if (this.grab) {
      const target = this.grabTarget();
      if (target && this.grab.kind !== 'screen') {
        const place = farPlacePoint(input.head.position, pinchHand.pinchPosition, this.surfaces.surfaces);
        target.position.set(place.point.x, place.point.y, place.point.z);
        this.landingRing.visible = Boolean(place.surface);
        if (place.surface) this.landingRing.position.set(place.point.x, place.point.y + 0.002, place.point.z);
      }
      if (this.grab.kind === 'screen') {
        this.screen.group.position.lerp(new Vector3(pinchHand.pinchPosition.x, pinchHand.pinchPosition.y, pinchHand.pinchPosition.z), 0.4);
      }
      if (this.grab.kind === 'furniture' && this.hands.left.pinched && this.hands.right.pinched) {
        const d = this.hands.left.pinchPosition && this.hands.right.pinchPosition
          ? Math.hypot(
              this.hands.left.pinchPosition.x - this.hands.right.pinchPosition.x,
              this.hands.left.pinchPosition.y - this.hands.right.pinchPosition.y,
              this.hands.left.pinchPosition.z - this.hands.right.pinchPosition.z,
            )
          : 0;
        if (this.twoHandScale === null) this.twoHandScale = d;
        else {
          const item = this.furniture.find((f) => f.id === this.grab?.id);
          if (item && this.twoHandScale > 0) resizeFurniture(item, item.scale * (d / this.twoHandScale));
          this.twoHandScale = d;
        }
      } else {
        this.twoHandScale = null;
      }
    }
    void dt;
  }

  private grabTarget(): Group | null {
    if (!this.grab) return null;
    if (this.grab.kind === 'furniture') return this.furniture.find((f) => f.id === this.grab?.id)?.root ?? null;
    if (this.grab.kind === 'movie') return this.movie.objects.find((o) => o.id === this.grab?.id)?.root ?? null;
    return null;
  }

  private updateFurniture(dt: number, input: FrameInput): void {
    for (const item of this.furniture) {
      const contacts = [];
      let seatPress = this.seatPressed === item;
      const holdPoint = this.seatPressed === item ? this.desktopHold?.point : null;
      if (holdPoint) {
        contacts.push({ x: holdPoint.x, y: holdPoint.y, z: holdPoint.z, strength: 1, time: this.time });
      }
      for (const hand of [this.hands.left, this.hands.right]) {
        const tip = hand.indexTip ?? hand.palm;
        if (!tip) continue;
        if (isOnFurniture(item, tip)) {
          contacts.push({ x: tip.x, y: tip.y, z: tip.z, strength: 1, time: this.time });
          if (hand.pinched) seatPress = true;
        }
      }
      setFurnitureContacts(item, contacts);
      const palmPress = [this.hands.left, this.hands.right].some(
        (h) => h.open && h.palm && h.palm.y > item.root.position.y && item.root.position.distanceTo(h.palm as never) < 0.45,
      );
      const poke = pokeSurface(this.hands.left, contacts.length ? 0.01 : null, dt);
      const wasUp = item.squash.displacement > 0.92;
      updateFurniture(item, dt, this.surfaces.surfaces, palmPress, poke, this.time, seatPress);
      if (wasUp && seatPress && item.object.scene === 'furniture') {
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
    return this.furniture.length + this.movie.objects.length > 0 && this.hands.anyPinch;
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
      const object = this.objects.find((item) => item.scene === 'furniture');
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
    seatItem?: PlacedFurniture;
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
    if (this.space.photoOpen && this.explorer.openPhoto && point) {
      const uv = worldToPhotoUv(point, this.explorer.openPhoto);
      if (uv) return { kind: 'photo', point, uv, onScreen: false };
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
      const item = furnitureAt(hits[0].object, this.furniture);
      if (item?.object.scene === 'furniture') {
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

function furnitureAt(
  object: { parent?: unknown } | null,
  items: PlacedFurniture[],
): PlacedFurniture | null {
  let current: { parent?: unknown } | null = object;
  while (current) {
    const match = items.find((item) => item.root === current || item.visual === current);
    if (match) return match;
    current = (current.parent as { parent?: unknown } | null) ?? null;
  }
  return null;
}

function forwardFrom(q: { x: number; y: number; z: number; w: number }): { x: number; z: number } {
  const x = 2 * (q.x * q.z + q.w * q.y);
  const z = 1 - 2 * (q.y * q.y + q.z * q.z);
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: -Math.abs(z) / len || -1 };
}

function worldToPhotoUv(
  point: { x: number; y: number; z: number },
  photo: Mesh,
): { x: number; y: number } | null {
  const local = photo.worldToLocal(new Vector3(point.x, point.y, point.z));
  const size = photo.userData.photoSize as { width: number; height: number } | undefined;
  const w = size?.width ?? config.openPhotoWidth;
  const h = size?.height ?? config.openPhotoWidth * 0.75;
  const u = local.x / w + 0.5;
  const v = 0.5 - local.y / h;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { x: u, y: v };
}

function distanceToScreen(tip: { x: number; y: number; z: number } | null, screen: VideoScreen): number | null {
  if (!tip) return null;
  return screen.group.position.distanceTo(tip as never);
}
