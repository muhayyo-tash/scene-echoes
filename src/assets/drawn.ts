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
  ctx.font = dark ? '22px -apple-system, BlinkMacSystemFont, sans-serif' : '28px sans-serif';
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

export type FinderSection = 'favorites' | 'pictures' | 'movies';

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
    favorites: 'Favorites',
    pictures: 'Pictures',
    movies: 'Movies',
  };
  ctx.fillStyle = '#1d1d1f';
  ctx.font = `600 ${Math.max(14, Math.floor(h * 0.035))}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(titles[selected], w * 0.5, lightsY);

  const sideW = Math.floor(w * 0.22);
  const sideTop = 8 + titleH + 10;
  ctx.fillStyle = '#f4f4f7';
  ctx.fillRect(8, sideTop, sideW, h - 16 - sideTop + 8);
  ctx.fillStyle = '#e2e2e8';
  ctx.fillRect(8 + sideW, sideTop, 1, h - 16 - sideTop + 8);

  const rows: FinderSection[] = ['favorites', 'pictures', 'movies'];
  const rowH = 32;
  ctx.textAlign = 'left';
  ctx.font = `${Math.max(13, Math.floor(h * 0.032))}px -apple-system, BlinkMacSystemFont, sans-serif`;
  rows.forEach((id, index) => {
    const y = sideTop + 16 + index * (rowH + 8);
    if (id === selected) {
      roundRect(ctx, 16, y, sideW - 16, rowH, 6);
      ctx.fillStyle = '#d9e4f5';
      ctx.fill();
    }
    ctx.fillStyle = '#1d1d1f';
    ctx.fillText(titles[id], 28, y + rowH * 0.55);
  });

  ctx.fillStyle = '#8e8e93';
  ctx.font = `${Math.max(12, Math.floor(h * 0.028))}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillText(itemCount === 1 ? '1 item' : `${itemCount} items`, 24, h - 28);
}

export function drawFinderAppIcon(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, w * 0.06, h * 0.06, w * 0.88, h * 0.88, w * 0.22);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7ec8ff');
  g.addColorStop(1, '#2f6bdc');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.46, w * 0.28, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a4fa8';
  ctx.beginPath();
  ctx.ellipse(w * 0.4, h * 0.42, w * 0.045, h * 0.06, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.6, h * 0.42, w * 0.045, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.strokeStyle = '#1a4fa8';
  ctx.lineWidth = Math.max(3, w * 0.03);
  ctx.arc(w * 0.5, h * 0.5, w * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}
