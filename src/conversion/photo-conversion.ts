import type { ModelHandle } from './types.js';

export interface PhotoConversionRequest {
  objectId: string;
  imagePath?: string;
  /** Normalized press on the opened photo, center of the object the user wants. */
  uv: { x: number; y: number };
}

/**
 * Placeholder for the future 2D→3D API.
 * The hold UV (object center) will be posted with the photo. Until that
 * endpoint exists, this loads the already-converted bundled GLB.
 */
export async function requestPhotoConversion(
  request: PhotoConversionRequest,
  loadBundled: () => Promise<ModelHandle>,
): Promise<ModelHandle> {
  // TODO(api): POST { image, x: request.uv.x, y: request.uv.y } to CONVERSION_API_URL
  // and poll until the reconstructed GLB is ready.
  void request;
  return loadBundled();
}
