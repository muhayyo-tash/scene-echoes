import { BackSide, Color, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { AtmosphereCue } from '../assets/types.js';

/** Soft passthrough wash so the film palette bleeds into the room. */
export class FilmAtmosphere {
  readonly mesh: Mesh;
  private readonly target = new Color('#c8c2b4');
  private readonly current = new Color('#c8c2b4');
  private strength = 0;
  private active = false;
  private cues: AtmosphereCue[] = [];

  constructor() {
    const mat = new MeshBasicMaterial({
      color: this.current,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: BackSide,
      toneMapped: false,
    });
    this.mesh = new Mesh(new SphereGeometry(2.6, 24, 16), mat);
    this.mesh.visible = false;
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'film-atmosphere';
  }

  setCues(cues: AtmosphereCue[]): void {
    this.cues = [...cues].sort((a, b) => a.time - b.time);
  }

  setPlaying(on: boolean): void {
    this.active = on;
    this.mesh.visible = on;
    if (!on) this.strength = 0;
  }

  update(dt: number, filmTime: number, head: { x: number; y: number; z: number }): void {
    this.mesh.position.set(head.x, head.y, head.z);
    const cue = activeAtmosphere(this.cues, filmTime);
    // Soft default cool wash when the timeline has no theme cues yet.
    if (cue) this.target.set(cue.color);
    else if (this.active) this.target.set('#7f9bb5');
    this.current.lerp(this.target, Math.min(1, dt * 1.1));
    const mat = this.mesh.material as MeshBasicMaterial;
    mat.color.copy(this.current);
    // Soft room wash — readable palette bleed, passthrough still clear.
    const goal = this.active ? (cue ? 0.08 : 0.055) : 0;
    this.strength += (goal - this.strength) * Math.min(1, dt * 2.2);
    mat.opacity = this.strength;
    mat.visible = this.strength > 0.002;
  }
}

export function activeAtmosphere(cues: AtmosphereCue[], time: number): AtmosphereCue | null {
  let best: AtmosphereCue | null = null;
  for (const cue of cues) {
    if (cue.time <= time) best = cue;
    else break;
  }
  return best;
}

export function parseAtmosphereColor(raw: string): string | null {
  const text = String(raw ?? '').trim();
  const hex = text.match(/#([0-9a-fA-F]{6})\b/);
  if (hex) return `#${hex[1].toLowerCase()}`;
  const named: Record<string, string> = {
    warm: '#d2a679',
    gold: '#c9a25c',
    golden: '#c9a25c',
    sunset: '#d4896a',
    cool: '#7f9bb5',
    cold: '#7f9bb5',
    blue: '#6f8fad',
    green: '#7d9a72',
    forest: '#6d8a64',
    grey: '#8b8e93',
    gray: '#8b8e93',
    overcast: '#8b8e93',
    night: '#3f4758',
    dark: '#3f4758',
    soft: '#c8c2b4',
    neutral: '#c8c2b4',
    pink: '#c495a4',
    purple: '#8f7aa8',
    orange: '#d4925a',
    teal: '#5f9e9a',
  };
  const key = text.toLowerCase().replace(/[^a-z]/g, ' ').trim().split(/\s+/)[0] ?? '';
  return named[key] ?? null;
}
