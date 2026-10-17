export type ConversionPhase = 'idle' | 'select' | 'lift' | 'build' | 'settle' | 'done';

export interface ConversionPhaseInfo {
  phase: ConversionPhase;
  local: number;
}

export function conversionPhase(progress: number): ConversionPhaseInfo {
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0) return { phase: 'idle', local: 0 };
  if (p < 0.2) return { phase: 'select', local: p / 0.2 };
  if (p < 0.4) return { phase: 'lift', local: (p - 0.2) / 0.2 };
  if (p < 0.9) return { phase: 'build', local: (p - 0.4) / 0.5 };
  if (p < 1) return { phase: 'settle', local: (p - 0.9) / 0.1 };
  return { phase: 'done', local: 1 };
}

export function progressFromElapsed(elapsed: number, duration: number): number {
  if (duration <= 0) return 1;
  return Math.min(1, Math.max(0, elapsed / duration));
}
