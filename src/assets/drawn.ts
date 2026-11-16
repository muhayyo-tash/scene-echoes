export function drawSofaPhoto(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#c8d6c3';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e8efe4';
  ctx.fillRect(0, 0, w, h * 0.55);
  ctx.fillStyle = '#b7c4b0';
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.fillStyle = '#6b8f71';
  const sx = w * 0.18;
  const sy = h * 0.42;
  const sw = w * 0.64;
  const sh = h * 0.38;
  ctx.fillRect(sx, sy + sh * 0.35, sw, sh * 0.45);
  ctx.fillRect(sx, sy, sw, sh * 0.28);
  ctx.fillRect(sx, sy + sh * 0.15, sw * 0.08, sh * 0.55);
  ctx.fillRect(sx + sw * 0.92, sy + sh * 0.15, sw * 0.08, sh * 0.55);
  ctx.fillStyle = '#8fb896';
  ctx.fillRect(sx + sw * 0.1, sy + sh * 0.32, sw * 0.8, sh * 0.16);
  ctx.fillStyle = '#d9c4a5';
  ctx.fillRect(w * 0.72, h * 0.28, w * 0.08, h * 0.28);
}

export function drawFilmPoster(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#1d1d1f';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#3a3a3c';
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.32);
  ctx.lineTo(w * 0.66, h * 0.5);
  ctx.lineTo(w * 0.42, h * 0.68);
  ctx.closePath();
  ctx.fill();
}

export function canvasTextureSource(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w = 640,
  h = 480,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, w, h);
  return canvas;
}

export function makeLabelCanvas(text: string, dark = false): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 64);
  if (!dark) {
    ctx.fillStyle = 'rgba(20, 28, 24, 0.45)';
    ctx.fillRect(16, 8, 224, 48);
  }
  ctx.fillStyle = dark ? '#1d1d1f' : '#f2fff6';
  // File names stay modest — sidebar folder labels are sized in drawFinderWindow.
  ctx.font = dark ? '28px -apple-system, BlinkMacSystemFont, sans-serif' : '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  return canvas;
}

export function makeGuidanceCanvas(text: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 768, 128);
  ctx.fillStyle = 'rgba(16, 20, 18, 0.72)';
  roundRect(ctx, 24, 24, 720, 80, 18);
  ctx.fill();
  ctx.fillStyle = '#f4f7f5';
  ctx.font = '32px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 384, 64);
  return canvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export type FinderSection = 'pictures' | 'movies';

/** Sidebar row metrics — keep draw + hit plates in lockstep. */
export const FINDER_SIDEBAR = {
  ratio: 0.28,
  rowH: 64,
  rowGap: 18,
  topPad: 28,
} as const;

export function drawFinderWindow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  selected: FinderSection = 'pictures',
  itemCount = 2,
): void {
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 8, 8, w - 16, h - 16, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const titleH = Math.floor(h * 0.1);
  ctx.save();
  roundRect(ctx, 8, 8, w - 16, titleH + 10, 18);
  ctx.clip();
  ctx.fillStyle = '#e8e8ed';
  ctx.fillRect(8, 8, w - 16, titleH + 10);
  ctx.restore();
  ctx.fillStyle = '#e8e8ed';
  ctx.fillRect(8, 8 + 18, w - 16, titleH - 8);

  const lightsY = 8 + titleH * 0.55;
  const colors = ['#ff5f57', '#febc2e', '#28c840'];
  colors.forEach((color, i) => {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(28 + i * 22, lightsY, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  const titles: Record<FinderSection, string> = {
    pictures: 'Pictures',
    movies: 'Movies',
  };
  const title = `Meta Echoes · ${titles[selected]}`;
  ctx.fillStyle = '#1d1d1f';
  ctx.font = `600 ${Math.max(28, Math.floor(h * 0.048))}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleWidth = ctx.measureText(title).width;
  const markR = Math.max(5, Math.floor(h * 0.012));
  const markGap = markR * 2.35;
  const markBlock = markR * 2 + markGap * 2;
  const clusterW = markBlock + 14 + titleWidth;
  const clusterLeft = w * 0.5 - clusterW / 2;
  drawEchoesMark(ctx, clusterLeft + markBlock / 2, lightsY, markR);
  ctx.fillStyle = '#1d1d1f';
  ctx.textAlign = 'left';
  ctx.fillText(title, clusterLeft + markBlock + 14, lightsY);

  const sideW = Math.floor(w * FINDER_SIDEBAR.ratio);
  const sideTop = 8 + titleH + 10;
  ctx.fillStyle = '#f4f4f7';
  ctx.fillRect(8, sideTop, sideW, h - 16 - sideTop + 8);
  ctx.fillStyle = '#e2e2e8';
  ctx.fillRect(8 + sideW, sideTop, 1, h - 16 - sideTop + 8);

  const rows: FinderSection[] = ['pictures', 'movies'];
  const { rowH, rowGap, topPad } = FINDER_SIDEBAR;
  ctx.textAlign = 'left';
  ctx.font = `700 ${Math.max(34, Math.floor(h * 0.058))}px -apple-system, BlinkMacSystemFont, sans-serif`;
  rows.forEach((id, index) => {
    const y = sideTop + topPad + index * (rowH + rowGap);
    if (id === selected) {
      roundRect(ctx, 14, y, sideW - 14, rowH, 10);
      ctx.fillStyle = '#d9e4f5';
      ctx.fill();
    }
    ctx.fillStyle = '#1d1d1f';
    ctx.fillText(titles[id], 26, y + rowH * 0.55);
  });

  ctx.fillStyle = '#8e8e93';
  ctx.font = `${Math.max(18, Math.floor(h * 0.032))}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillText(itemCount === 1 ? '1 item' : `${itemCount} items`, 24, h - 28);
}

/** Three-dot Meta Echoes mark (bright / shade halves) on the current fill. */
export function drawEchoesMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): void {
  const bright = '#fec006';
  const shade = '#dea806';
  const gap = radius * 2.35;
  for (let i = -1; i <= 1; i++) {
    const x = cx + i * gap;
    ctx.beginPath();
    ctx.arc(x, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = bright;
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, cy - radius - 1, radius + 1, radius * 2 + 2);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(x, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.restore();
  }
}

/** Dock / app icon: white tile + three yellow dots. */
export function drawFinderAppIcon(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, w * 0.06, h * 0.06, w * 0.88, h * 0.88, w * 0.22);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = Math.max(2, w * 0.012);
  ctx.stroke();
  drawEchoesMark(ctx, w * 0.5, h * 0.5, w * 0.105);
}
