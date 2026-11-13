import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Texture,
  Vector3,
} from 'three';
import type { ExplorerEntry, ManifestObject } from '../assets/types.js';
import {
  canvasTextureSource,
  drawFinderAppIcon,
  drawFinderWindow,
  drawFilmPoster,
  drawSofaPhoto,
  makeGuidanceCanvas,
  makeLabelCanvas,
  type FinderSection,
} from '../assets/drawn.js';
import { loadTexture } from '../assets/loaders.js';
import { config } from '../config.js';
import { layoutExplorerCards, type CardLayout } from './layout.js';
import type { FilmProgress } from '../conversion/types.js';

export const FINDER_WIDTH = 0.52;
export const FINDER_HEIGHT = 0.34;
const DOCK_SIZE = 0.1;

export interface ExplorerCard {
  id: string;
  type: ExplorerEntry['type'];
  mesh: Mesh;
  layout: CardLayout;
  glow: Mesh;
  label?: Mesh;
}

export class FileExplorer {
  readonly group = new Group();
  readonly photoGroup = new Group();
  readonly iconGroup = new Group();
  cards: ExplorerCard[] = [];
  openPhoto: Mesh | null = null;
  visible = false;
  /** True after the user pinches and moves Finder; keeps that placement. */
  userPlaced = false;
  folder: FinderSection = 'pictures';
  private panel!: Mesh;
  private closeHit!: Mesh;
  private moveHit!: Mesh;
  private sidebarHits: Mesh[] = [];
  private hoverId: string | null = null;
  private layouts: CardLayout[] = [];
  private readonly world = new Vector3();
  private photoRestScale = 1;
  private photoGuideText = '';

  constructor(
    private readonly entries: ExplorerEntry[],
    private readonly objects: ManifestObject[],
  ) {
    this.group.name = 'file-explorer';
    this.group.visible = false;
    this.photoGroup.name = 'open-photo';
    this.photoGroup.visible = false;
    this.iconGroup.name = 'finder-app-icon';
    this.buildWindow();
    this.buildDockIcon();
  }

  async init(): Promise<void> {
    this.layouts = layoutExplorerCards(this.entries, FINDER_WIDTH);
    for (const layout of this.layouts) {
      const texture = await this.cardTexture(layout);
      const mesh = new Mesh(
        new PlaneGeometry(layout.width, layout.height),
        new MeshBasicMaterial({ map: texture }),
      );
      mesh.position.set(layout.x, layout.y, 0.012);
      mesh.userData.cardId = layout.id;
      // Larger invisible hit plate so Quest hand-rays land on the thumbnail
      // instead of the title-bar / empty chrome behind it.
      const cardHit = new Mesh(
        new PlaneGeometry(layout.width * 1.45, layout.height * 1.55),
        new MeshBasicMaterial({ visible: false, side: DoubleSide }),
      );
      cardHit.position.set(layout.x, layout.y, 0.014);
      cardHit.userData.cardId = layout.id;
      const glow = new Mesh(
        new PlaneGeometry(layout.width * 1.12, layout.height * 1.12),
        new MeshBasicMaterial({
          color: new Color('#0a84ff'),
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      glow.position.set(layout.x, layout.y, 0.008);
      glow.raycast = () => undefined;
      const fileName = layout.type === 'video' ? `${layout.id}.mp4` : `${layout.id}.jpg`;
      const label = new Mesh(
        new PlaneGeometry(0.16, 0.032),
        new MeshBasicMaterial({ map: new CanvasTexture(makeLabelCanvas(fileName, true)), transparent: true }),
      );
      label.position.set(layout.x, layout.y - layout.height * 0.72, 0.013);
      // Labels must not steal the hand-ray from the card mesh.
      label.raycast = () => undefined;
      this.group.add(glow, mesh, cardHit, label);
      const card: ExplorerCard = { id: layout.id, type: layout.type, mesh, layout, glow, label };
      this.cards.push(card);
    }
    this.applyFolder();
  }

  // View-space: +X right, +Y up, -Z forward. Keep inside Quest FOV.
  private readonly dockOffset = new Vector3(0.2, 0.1, -0.58);
  private readonly dockQuat = new Quaternion();
  private readonly dockPos = new Vector3();

  /**
   * View-locked dock: offset in head space each frame, then lookAt the eyes
   * (same facing as the previously-visible dock — do not rotateY(PI) or the
   * plane faces away and gets culled).
   */
  placeDockHud(
    head: { x: number; y: number; z: number },
    quat: { x: number; y: number; z: number; w: number },
  ): void {
    this.dockQuat.set(quat.x, quat.y, quat.z, quat.w);
    this.dockPos.copy(this.dockOffset).applyQuaternion(this.dockQuat);
    const x = head.x + this.dockPos.x;
    const y = head.y + this.dockPos.y;
    const z = head.z + this.dockPos.z;
    this.iconGroup.position.set(x, y, z);
    this.iconGroup.lookAt(head.x, head.y, head.z);
    this.iconGroup.visible = true;
  }

  setOpen(open: boolean, head: { x: number; y: number; z: number }, forward: { x: number; z: number }): void {
    this.visible = open;
    this.group.visible = open && !this.photoGroup.visible;
    if (!open) {
      this.userPlaced = false;
      return;
    }
    if (this.userPlaced) return;
    // Centered Quest-style panel in front of the user.
    const y = head.y - 0.04;
    this.group.position.set(
      head.x + forward.x * config.explorerDistance,
      y,
      head.z + forward.z * config.explorerDistance,
    );
    this.group.lookAt(head.x, y, head.z);
  }

  /** Pinch-drag the chrome title bar to reposition Finder. */
  moveTo(
    position: { x: number; y: number; z: number },
    lookAt: { x: number; y: number; z: number },
  ): void {
    this.userPlaced = true;
    this.group.position.set(position.x, position.y, position.z);
    this.group.lookAt(lookAt.x, lookAt.y, lookAt.z);
  }

  /**
   * Title-bar drag only (local AABB on the chrome strip). Cards / close /
   * sidebar always win so photo pinches are never treated as window moves.
   */
  hitMoveHandle(point: { x: number; y: number; z: number }, _radius = 0.02): boolean {
    if (!this.visible || !this.group.visible) return false;
    if (this.hitClose(point, 0.06) || this.hitFolder(point, 0.07) || this.hitTest(point, 0.1)) {
      return false;
    }
    this.moveHit.updateWorldMatrix(true, true);
    this.moveHit.worldToLocal(this.world.set(point.x, point.y, point.z));
    const hw = (FINDER_WIDTH * 0.92) * 0.5 + 0.01;
    const hh = (FINDER_HEIGHT * 0.18) * 0.5 + 0.01;
    return Math.abs(this.world.x) <= hw && Math.abs(this.world.y) <= hh && Math.abs(this.world.z) <= 0.04;
  }

  hover(id: string | null): void {
    this.hoverId = id;
    for (const card of this.cards) {
      const on = card.id === id;
      card.mesh.position.z = on ? 0.018 : 0.012;
      (card.glow.material as MeshBasicMaterial).opacity = on ? 0.28 : 0;
    }
  }

  setMovieProgress(filmId: string, progress: FilmProgress): void {
    const card = this.cards.find((item) => item.id === filmId && item.type === 'video');
    if (!card?.label) return;
    const base = `${card.id}.mp4`;
    const word =
      progress.status === 'ready'
        ? `${base}  Ready`
        : progress.status === 'failed'
          ? `${base}  Failed`
          : progress.status === 'processing'
            ? `${base}  Processing`
            : base;
    const map = new CanvasTexture(makeLabelCanvas(word, true));
    (card.label.material as MeshBasicMaterial).map?.dispose();
    (card.label.material as MeshBasicMaterial).map = map;
  }

  dimOthers(exceptId: string | null, dim: boolean): void {
    for (const card of this.cards) {
      const mat = card.mesh.material as MeshBasicMaterial;
      mat.opacity = dim && card.id !== exceptId ? 0.35 : 1;
      mat.transparent = mat.opacity < 1;
    }
  }

  async openPhotoPrint(
    id: string,
    head: { x: number; y: number; z: number },
    forward: { x: number; z: number },
  ): Promise<Mesh> {
    this.photoGroup.clear();
    const object = this.objects.find((item) => item.id === id);
    const texture = await this.photoTexture(object);
    // Bake a thin white matte into the texture so we never stack a covering plane.
    const framed = framePhotoTexture(texture, 0.028);
    const image = framed.image as { width?: number; height?: number } | undefined;
    const aspect = image?.width && image.height ? image.height / image.width : 4 / 3;
    const width = config.openPhotoWidth;
    const height = width * aspect;
    const mesh = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ map: framed, toneMapped: false, side: DoubleSide }),
    );
    mesh.userData.photoSize = { width, height };
    mesh.userData.objectId = id;
    mesh.userData.photoPrint = true;
    // Same band as Finder panels so the Quest hand target-ray can aim reliably.
    const distance = 0.7;
    const centerY = head.y - 0.04;
    mesh.position.set(
      head.x + forward.x * distance,
      centerY,
      head.z + forward.z * distance,
    );
    mesh.lookAt(head.x, centerY, head.z);
    mesh.rotateX((-config.openPhotoTiltDegrees * Math.PI) / 180);
    // Slightly larger hit plate for aim — keep modest so casual pointing does not stick.
    const hitPlate = new Mesh(
      new PlaneGeometry(width * 1.12, height * 1.12),
      new MeshBasicMaterial({ visible: false, side: DoubleSide }),
    );
    hitPlate.position.copy(mesh.position);
    hitPlate.quaternion.copy(mesh.quaternion);
    hitPlate.translateZ(-0.001);
    hitPlate.userData.photoPrint = true;
    hitPlate.userData.objectId = id;
    const shadow = new Mesh(
      new PlaneGeometry(width * 1.05, height * 1.05),
      new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    shadow.position.copy(mesh.position);
    shadow.position.y -= 0.01;
    shadow.quaternion.copy(mesh.quaternion);
    // Must not steal hand-ray hits from the print (was blocking pinch-to-pop).
    shadow.raycast = () => undefined;
    const guide = new Mesh(
      new PlaneGeometry(0.42, 0.07),
      new MeshBasicMaterial({
        map: new CanvasTexture(
          makeGuidanceCanvas('Release · then point at the photo'),
        ),
        transparent: true,
        depthWrite: false,
      }),
    );
    guide.position.copy(mesh.position);
    guide.quaternion.copy(mesh.quaternion);
    guide.translateY(-(height * 0.5 + 0.06));
    guide.translateZ(0.002);
    guide.userData.photoGuide = true;
    guide.raycast = () => undefined;
    this.photoRestScale = 1;
    this.photoGuideText = 'Release · then point at the photo';
    this.photoGroup.userData.photoPrint = true;
    this.photoGroup.add(shadow, hitPlate, mesh, guide);
    this.photoGroup.visible = true;
    // Folder panel goes away while the photo is open.
    this.visible = false;
    this.group.visible = false;
    // Dock stays so Meta Echoes can be opened again later.
    this.iconGroup.visible = true;
    this.openPhoto = mesh;
    this.dimOthers(id, true);
    return mesh;
  }

  closePhoto(): void {
    this.photoGroup.visible = false;
    this.photoGroup.userData.photoPrint = false;
    this.photoGuideText = '';
    this.openPhoto = null;
    // Drop children so a stale print cannot keep covering the room.
    this.photoGroup.clear();
    this.dimOthers(null, false);
    // Keep the folder closed after the photo leaves — room stays clean.
    this.visible = false;
    this.group.visible = false;
    this.iconGroup.visible = true;
  }

  /**
   * Photo hit test. Default is a thick slab on the print only.
   * Pass `spherePad` for a looser near-center fallback (avoid for pop commits).
   */
  hitOpenPhoto(
    point: { x: number; y: number; z: number },
    pad = 0.12,
    spherePad = 0,
  ): { x: number; y: number } | null {
    const photo = this.openPhoto;
    if (!photo || !this.photoGroup.visible) return null;
    photo.updateWorldMatrix(true, true);
    photo.getWorldPosition(this.world);
    const size = photo.userData.photoSize as { width: number; height: number } | undefined;
    const w = size?.width ?? config.openPhotoWidth;
    const h = size?.height ?? config.openPhotoWidth * 0.75;
    const local = photo.worldToLocal(new Vector3(point.x, point.y, point.z));
    if (local.z <= 0.45 && local.z >= -0.25) {
      const u = local.x / w + 0.5;
      const v = 0.5 - local.y / h;
      if (u >= -pad && u <= 1 + pad && v >= -pad && v <= 1 + pad) {
        return { x: Math.min(1, Math.max(0, u)), y: Math.min(1, Math.max(0, v)) };
      }
    }
    if (spherePad > 0 && this.world.distanceTo(point as never) <= spherePad) {
      return { x: 0.5, y: 0.45 };
    }
    return null;
  }

  setPhotoGuide(text: string): void {
    if (text === this.photoGuideText) return;
    const guide = this.photoGroup.children.find((c) => (c as Mesh).userData?.photoGuide) as
      | Mesh
      | undefined;
    if (!guide) return;
    this.photoGuideText = text;
    const mat = guide.material as MeshBasicMaterial;
    const prev = mat.map;
    mat.map = new CanvasTexture(makeGuidanceCanvas(text));
    mat.needsUpdate = true;
    prev?.dispose();
  }

  hitIcon(point: { x: number; y: number; z: number }, radius = 0.08): boolean {
    if (!this.iconGroup.visible) return false;
    this.iconGroup.updateWorldMatrix(true, true);
    this.iconGroup.getWorldPosition(this.world);
    return this.world.distanceTo(point as never) < radius;
  }

  hitClose(point: { x: number; y: number; z: number }, radius = 0.05): boolean {
    if (!this.visible || !this.group.visible) return false;
    this.closeHit.updateWorldMatrix(true, true);
    this.closeHit.getWorldPosition(this.world);
    return this.world.distanceTo(point as never) < radius;
  }

  hitFolder(point: { x: number; y: number; z: number }, radius = 0.05): FinderSection | null {
    if (!this.visible || !this.group.visible) return null;
    this.group.updateWorldMatrix(true, true);
    let best: FinderSection | null = null;
    let bestD = radius;
    for (const mesh of this.sidebarHits) {
      mesh.getWorldPosition(this.world);
      const d = this.world.distanceTo(point as never);
      if (d < bestD) {
        best = mesh.userData.folder as FinderSection;
        bestD = d;
      }
    }
    return best;
  }

  setFolder(folder: FinderSection): void {
    if (this.folder === folder) return;
    this.folder = folder;
    this.paintWindow();
    this.applyFolder();
  }

  hitTest(point: { x: number; y: number; z: number }, radius = 0.12): ExplorerCard | null {
    if (!this.visible || !this.group.visible) return null;
    let best: ExplorerCard | null = null;
    let bestD = radius;
    this.group.updateWorldMatrix(true, true);
    for (const card of this.cards) {
      if (!card.mesh.visible) continue;
      card.mesh.getWorldPosition(this.world);
      const reach = Math.max(
        radius,
        Math.hypot(card.layout.width, card.layout.height) * 0.55,
      );
      const d = this.world.distanceTo(point as never);
      if (d < reach && d < bestD) {
        best = card;
        bestD = d;
      }
    }
    return best;
  }

  processingVisual(filmId: string, progress: number): void {
    this.setMovieProgress(filmId, { status: 'processing', progress });
  }

  private buildWindow(): void {
    this.panel = new Mesh(
      new PlaneGeometry(FINDER_WIDTH, FINDER_HEIGHT),
      new MeshBasicMaterial({ map: this.chromeTexture() }),
    );
    this.panel.userData.finderWindow = true;
    this.closeHit = new Mesh(
      new PlaneGeometry(0.028, 0.028),
      new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }),
    );
    this.closeHit.position.set(-FINDER_WIDTH * 0.44, FINDER_HEIGHT * 0.42, 0.01);
    this.closeHit.userData.close = true;
    this.moveHit = new Mesh(
      new PlaneGeometry(FINDER_WIDTH * 0.92, FINDER_HEIGHT * 0.18),
      new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }),
    );
    this.moveHit.position.set(0, FINDER_HEIGHT * 0.4, 0.016);
    this.moveHit.userData.finderMove = true;
    const folders: FinderSection[] = ['favorites', 'pictures', 'movies'];
    const sideX = -FINDER_WIDTH * 0.39;
    folders.forEach((id, index) => {
      const hit = new Mesh(
        new PlaneGeometry(FINDER_WIDTH * 0.18, 0.048),
        new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }),
      );
      hit.position.set(sideX, 0.174 - index * 0.034, 0.012);
      hit.userData.folder = id;
      this.sidebarHits.push(hit);
      this.group.add(hit);
    });
    this.group.add(this.panel, this.closeHit, this.moveHit);
  }

  private chromeTexture(): CanvasTexture {
    const count = this.visibleCount();
    return new CanvasTexture(
      canvasTextureSource((ctx, w, h) => drawFinderWindow(ctx, w, h, this.folder, count), 1024, 640),
    );
  }

  private paintWindow(): void {
    const map = this.chromeTexture();
    const mat = this.panel.material as MeshBasicMaterial;
    mat.map?.dispose();
    mat.map = map;
    mat.needsUpdate = true;
  }

  private visibleCount(): number {
    return this.cards.filter((card) => this.cardVisible(card)).length;
  }

  private cardVisible(card: ExplorerCard): boolean {
    if (this.folder === 'favorites') return true;
    if (this.folder === 'pictures') return card.type === 'photo';
    return card.type === 'video';
  }

  private applyFolder(): void {
    for (const card of this.cards) {
      const on = this.cardVisible(card);
      card.mesh.visible = on;
      card.glow.visible = on;
      if (card.label) card.label.visible = on;
    }
  }

  private buildDockIcon(): void {
    const texture = new CanvasTexture(canvasTextureSource(drawFinderAppIcon, 256, 256));
    const iconMat = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    const mesh = new Mesh(new PlaneGeometry(DOCK_SIZE, DOCK_SIZE), iconMat);
    mesh.userData.appIcon = true;
    mesh.renderOrder = 1000;
    const hit = new Mesh(
      new PlaneGeometry(DOCK_SIZE * 1.35, DOCK_SIZE * 1.55),
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    hit.position.z = -0.002;
    hit.userData.appIcon = true;
    hit.renderOrder = 1000;
    const caption = new Mesh(
      new PlaneGeometry(0.16, 0.03),
      new MeshBasicMaterial({
        map: new CanvasTexture(makeLabelCanvas('Meta Echoes', true)),
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    caption.position.y = -DOCK_SIZE * 0.72;
    caption.userData.appIcon = true;
    caption.renderOrder = 1000;
    this.iconGroup.add(hit, mesh, caption);
  }

  private async cardTexture(layout: CardLayout): Promise<Texture> {
    if (layout.type === 'photo') {
      const object = this.objects.find((item) => item.id === layout.id);
      return this.photoTexture(object);
    }
    try {
      return await loadTexture('assets/movie/poster.jpg');
    } catch {
      return new CanvasTexture(canvasTextureSource(drawFilmPoster, 640, 360));
    }
  }

  private async photoTexture(object: ManifestObject | undefined): Promise<Texture> {
    if (object?.photo) {
      try {
        return await loadTexture(object.photo);
      } catch {
        /* fall through */
      }
    }
    return new CanvasTexture(canvasTextureSource(drawSofaPhoto));
  }
}

/** Draw the source photo inset on a white canvas so the matte cannot cover the image. */
function framePhotoTexture(texture: Texture, borderRatio: number): CanvasTexture {
  const source = texture.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | { width: number; height: number }
    | undefined;
  const srcW = Math.max(1, Math.floor(source && 'width' in source ? Number(source.width) || 640 : 640));
  const srcH = Math.max(1, Math.floor(source && 'height' in source ? Number(source.height) || 480 : 480));
  const pad = Math.max(4, Math.round(Math.min(srcW, srcH) * borderRatio));
  const canvas = document.createElement('canvas');
  canvas.width = srcW + pad * 2;
  canvas.height = srcH + pad * 2;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (source && 'width' in source) {
      ctx.drawImage(source as CanvasImageSource, pad, pad, srcW, srcH);
    }
  }
  const framed = new CanvasTexture(canvas);
  framed.colorSpace = texture.colorSpace;
  framed.needsUpdate = true;
  return framed;
}
