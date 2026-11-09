import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshBasicMaterial,
  PlaneGeometry,
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
  /** True after the dock icon is placed once in world space (does not follow the head). */
  dockPlaced = false;
  folder: FinderSection = 'pictures';
  private panel!: Mesh;
  private closeHit!: Mesh;
  private moveHit!: Mesh;
  private sidebarHits: Mesh[] = [];
  private hoverId: string | null = null;
  private layouts: CardLayout[] = [];
  private readonly world = new Vector3();

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
      const fileName = layout.type === 'video' ? `${layout.id}.mp4` : `${layout.id}.jpg`;
      const label = new Mesh(
        new PlaneGeometry(0.16, 0.032),
        new MeshBasicMaterial({ map: new CanvasTexture(makeLabelCanvas(fileName, true)), transparent: true }),
      );
      label.position.set(layout.x, layout.y - layout.height * 0.72, 0.013);
      this.group.add(glow, mesh, label);
      const card: ExplorerCard = { id: layout.id, type: layout.type, mesh, layout, glow, label };
      this.cards.push(card);
    }
    this.applyFolder();
  }

  placeDock(chest: { x: number; y: number; z: number }, forward: { x: number; z: number }): void {
    this.iconGroup.visible = !this.photoGroup.visible;
    // Stay put in the room — do not reattach to the headset every frame.
    if (this.dockPlaced) return;
    const rightX = -forward.z;
    const rightZ = forward.x;
    this.iconGroup.position.set(
      chest.x + forward.x * 0.5 + rightX * -0.34,
      chest.y + 0.08,
      chest.z + forward.z * 0.5 + rightZ * -0.34,
    );
    this.iconGroup.lookAt(chest.x, chest.y + 0.08, chest.z);
    this.dockPlaced = true;
  }

  setOpen(open: boolean, chest: { x: number; y: number; z: number }, forward: { x: number; z: number }): void {
    this.visible = open;
    this.group.visible = open && !this.photoGroup.visible;
    if (!open) {
      this.userPlaced = false;
      return;
    }
    if (this.userPlaced) return;
    this.group.position.set(
      chest.x + forward.x * config.explorerDistance,
      chest.y + 0.04,
      chest.z + forward.z * config.explorerDistance,
    );
    this.group.lookAt(chest.x, chest.y, chest.z);
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

  hitMoveHandle(point: { x: number; y: number; z: number }, radius = 0.12): boolean {
    if (!this.visible || !this.group.visible) return false;
    if (this.hitClose(point, 0.07) || this.hitFolder(point, 0.08) || this.hitTest(point, 0.1)) {
      return false;
    }
    this.moveHit.updateWorldMatrix(true, true);
    this.moveHit.getWorldPosition(this.world);
    if (this.world.distanceTo(point as never) < radius) return true;
    this.panel.updateWorldMatrix(true, true);
    this.panel.getWorldPosition(this.world);
    return this.world.distanceTo(point as never) < Math.max(radius, FINDER_WIDTH * 0.42);
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
    chest: { x: number; y: number; z: number },
    forward: { x: number; z: number },
  ): Promise<Mesh> {
    this.photoGroup.clear();
    const object = this.objects.find((item) => item.id === id);
    const texture = await this.photoTexture(object);
    const image = texture.image as { width?: number; height?: number } | undefined;
    const aspect = image?.width && image.height ? image.height / image.width : 4 / 3;
    const width = config.openPhotoWidth;
    const height = width * aspect;
    const framePad = 0.012;
    const mesh = new Mesh(
      new PlaneGeometry(width, height),
      new MeshPhysicalMaterial({ map: texture, roughness: 0.4 }),
    );
    mesh.userData.photoSize = { width, height };
    // Raise toward eye height so the print sits centered, not low at the chest.
    const centerY = chest.y + 0.16;
    mesh.position.set(
      chest.x + forward.x * 0.45,
      centerY,
      chest.z + forward.z * 0.45,
    );
    mesh.lookAt(chest.x, centerY, chest.z);
    mesh.rotateX((-config.openPhotoTiltDegrees * Math.PI) / 180);
    const frame = new Mesh(
      new PlaneGeometry(width + framePad * 2, height + framePad * 2),
      new MeshBasicMaterial({ color: 0xffffff }),
    );
    frame.position.copy(mesh.position);
    frame.quaternion.copy(mesh.quaternion);
    frame.translateZ(-0.0015);
    const shadow = new Mesh(
      new PlaneGeometry(width + framePad * 2.4, height + framePad * 2.4),
      new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    shadow.position.copy(mesh.position);
    shadow.position.y -= 0.012;
    shadow.quaternion.copy(mesh.quaternion);
    shadow.translateZ(-0.003);
    this.photoGroup.add(shadow, frame, mesh);
    this.photoGroup.visible = true;
    this.group.visible = false;
    this.iconGroup.visible = false;
    this.openPhoto = mesh;
    this.dimOthers(id, true);
    return mesh;
  }

  closePhoto(): void {
    this.photoGroup.visible = false;
    this.openPhoto = null;
    this.dimOthers(null, false);
    this.group.visible = this.visible;
    this.iconGroup.visible = true;
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
      new PlaneGeometry(FINDER_WIDTH * 0.72, FINDER_HEIGHT * 0.12),
      new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }),
    );
    this.moveHit.position.set(0.02, FINDER_HEIGHT * 0.42, 0.01);
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
    const mesh = new Mesh(
      new PlaneGeometry(DOCK_SIZE, DOCK_SIZE),
      new MeshBasicMaterial({ map: texture, transparent: true }),
    );
    mesh.userData.appIcon = true;
    const hit = new Mesh(
      new PlaneGeometry(DOCK_SIZE * 1.35, DOCK_SIZE * 1.55),
      new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }),
    );
    hit.position.z = -0.002;
    hit.userData.appIcon = true;
    const caption = new Mesh(
      new PlaneGeometry(0.16, 0.03),
      new MeshBasicMaterial({ map: new CanvasTexture(makeLabelCanvas('Finder', true)), transparent: true }),
    );
    caption.position.y = -DOCK_SIZE * 0.72;
    caption.userData.appIcon = true;
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
