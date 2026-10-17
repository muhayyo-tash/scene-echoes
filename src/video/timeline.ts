import type { TimelineMoment } from '../assets/types.js';
import { config } from '../config.js';

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
