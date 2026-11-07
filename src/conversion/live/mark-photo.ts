function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export async function markPhotoBlob(
  blob: Blob,
  uv: { x: number; y: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0);
  const x = uv.x * canvas.width;
  const y = uv.y * canvas.height;
  const r = Math.max(12, Math.min(canvas.width, canvas.height) * 0.045);
  ctx.lineWidth = Math.max(4, r * 0.28);
  ctx.strokeStyle = '#ffffff';
  circle(ctx, x, y, r);
  ctx.stroke();
  ctx.strokeStyle = '#ff2a2a';
  ctx.lineWidth = Math.max(3, r * 0.2);
  circle(ctx, x, y, r);
  ctx.stroke();
  ctx.fillStyle = '#ff2a2a';
  circle(ctx, x, y, r * 0.22);
  ctx.fill();
  bitmap.close();
  return new Promise((resolve) => {
    canvas.toBlob((marked) => resolve(marked ?? blob), 'image/jpeg', 0.88);
  });
}

export function dataUrlToBlob(value: string): Blob {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: match[1] });
  }
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: 'image/jpeg' });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
