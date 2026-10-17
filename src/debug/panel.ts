import { debugParams } from './params.js';
import { modelWarnings } from '../assets/loaders.js';
import type { AppSpace } from '../core/space.js';
import type { HandsFrame } from '../core/hands.js';
import type { SurfaceFinderState } from '../core/surfaces.js';

export function mountDebugPanel(): HTMLDivElement | null {
  if (!debugParams.debug || typeof document === 'undefined') return null;
  const el = document.createElement('div');
  el.id = 'debug-panel';
  el.style.cssText =
    'position:fixed;left:12px;bottom:12px;z-index:20;font:12px/1.4 ui-monospace,monospace;color:#e8fff0;background:rgba(10,16,14,0.72);padding:10px 12px;border-radius:10px;max-width:320px;pointer-events:none;';
  document.body.appendChild(el);
  return el;
}

export function renderDebugPanel(
  el: HTMLDivElement | null,
  info: {
    space: AppSpace;
    hands: HandsFrame;
    surfaces: SurfaceFinderState;
    fps: number;
    filmTime: number | null;
    nextMoment: string | null;
    movie: string;
  },
): void {
  if (!el) return;
  el.textContent = [
    `space ${info.space}`,
    `fps ${info.fps.toFixed(0)}`,
    `hands L:${info.hands.left.tracked ? 'ok' : 'lost'} pinch=${info.hands.left.pinched}  R:${info.hands.right.tracked ? 'ok' : 'lost'} pinch=${info.hands.right.pinched}`,
    `surfaces ${info.surfaces.surfaces.map((s) => `${s.id}:${s.source}`).join(', ') || 'none'}`,
    `movie ${info.movie}`,
    `film ${info.filmTime?.toFixed(1) ?? '-'} next ${info.nextMoment ?? '-'}`,
    ...modelWarnings.slice(-4),
  ].join('\n');
}
