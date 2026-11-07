/** Seconds between sampled film frames. Not a frame-count step. */
export const FILM_SAMPLE_SECONDS = 6;

/** Hard cap on SAM 3D reconstructs per film. */
export const FILM_MAX_RECONSTRUCTS = 4;

export function sampleTimes(durationSeconds: number, step = FILM_SAMPLE_SECONDS): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const times: number[] = [];
  for (let t = step; t < durationSeconds; t += step) times.push(Number(t.toFixed(2)));
  if (times.length === 0 && durationSeconds > 0) times.push(Math.min(step, durationSeconds / 2));
  return times;
}

export function shouldKeepLabel(
  label: string,
  previous: Array<{ time: number; label: string }>,
  time: number,
  gapSeconds = FILM_SAMPLE_SECONDS,
): boolean {
  const last = [...previous].reverse().find((item) => item.label === label);
  if (!last) return true;
  return time - last.time >= gapSeconds;
}
