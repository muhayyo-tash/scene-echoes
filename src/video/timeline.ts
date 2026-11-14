import type { AtmosphereCue, TimelineMoment } from '../assets/types.js';
import { config } from '../config.js';
import { parseAtmosphereColor } from './film-atmosphere.js';

export type MomentStage = 'idle' | 'outline' | 'appear' | 'behave' | 'leave';

export interface ScheduledMoment {
  moment: TimelineMoment;
  stage: MomentStage;
}

export function scheduleMoments(
  moments: TimelineMoment[],
  time: number,
  activeIds: Set<string>,
  lead = config.momentLeadSeconds,
  lifetime = config.objectLifetimeSeconds,
): ScheduledMoment[] {
  return moments.map((moment) => ({
    moment,
    stage: stageForMoment(moment, time, activeIds.has(moment.id), lead, lifetime),
  }));
}

export function stageForMoment(
  moment: TimelineMoment,
  time: number,
  alreadyActive: boolean,
  lead: number,
  defaultLifetime: number,
): MomentStage {
  const life = moment.lifetime ?? defaultLifetime;
  const start = moment.time;
  const leaveAt = start + life;
  if (time < start - lead) return 'idle';
  if (time < start) return 'outline';
  if (time < start + 0.05 && !alreadyActive) return 'appear';
  if (time < leaveAt) return alreadyActive ? 'behave' : 'appear';
  return 'leave';
}

export function momentsToClearOnSeek(
  moments: TimelineMoment[],
  fromTime: number,
  toTime: number,
): TimelineMoment[] {
  if (toTime >= fromTime) {
    return moments.filter((moment) => moment.time > fromTime && moment.time <= toTime);
  }
  return moments.filter((moment) => moment.time > toTime);
}

export function parseTimelineMoments(data: unknown): TimelineMoment[] {
  const moments = (data as { moments?: TimelineMoment[] })?.moments;
  return Array.isArray(moments) ? moments : [];
}

export function parseTimelineAtmosphere(data: unknown): AtmosphereCue[] {
  const rows = (data as { atmosphere?: AtmosphereCue[] })?.atmosphere;
  if (!Array.isArray(rows)) return [];
  const cues: AtmosphereCue[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const time = Number((row as AtmosphereCue).time);
    const color = parseAtmosphereColor(String((row as AtmosphereCue).color ?? ''));
    if (!Number.isFinite(time) || !color) continue;
    cues.push({
      id: String((row as AtmosphereCue).id ?? `atmo-${time}`),
      time,
      color,
      label: (row as AtmosphereCue).label ? String((row as AtmosphereCue).label) : undefined,
    });
  }
  return cues.sort((a, b) => a.time - b.time);
}
