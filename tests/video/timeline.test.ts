import { describe, expect, it } from 'vitest';
import { momentsToClearOnSeek, objectIdActiveAt, stageForMoment } from '../../src/video/timeline.js';
import { assignSlot } from '../../src/video/slots.js';
import { behaviorFromLabel, reactionFromBehavior } from '../../src/video/behaviors.js';
import { perchTarget } from '../../src/video/paths.js';
import { createReactionState, tryStartReaction, updateReaction } from '../../src/video/reactions.js';
import { validateTimeline } from '../../src/assets/validate.js';
import bundledManifest from '../../public/assets/manifest.json';
import bundledTimeline from '../../public/assets/movie/timeline.json';
import { parseManifest } from '../../src/assets/validate.js';

describe('timeline', () => {
  it('outlines before appear and leaves after lifetime', () => {
    const moment = { id: 'obj-1', time: 4, objectId: 'prop', rect: { x: 0, y: 0, width: 1, height: 1 } };
    expect(stageForMoment(moment, 3.0, false, 1, 30)).toBe('outline');
    expect(stageForMoment(moment, 4, false, 1, 30)).toBe('appear');
    expect(stageForMoment(moment, 10, true, 1, 30)).toBe('behave');
    expect(stageForMoment(moment, 40, true, 1, 30)).toBe('leave');
  });

  it('clears objects when seeking backwards', () => {
    const moments = [
      { id: 'a', time: 4, objectId: 'x', rect: { x: 0, y: 0, width: 0.1, height: 0.1 } },
      { id: 'b', time: 12, objectId: 'y', rect: { x: 0, y: 0, width: 0.1, height: 0.1 } },
    ];
    expect(momentsToClearOnSeek(moments, 20, 3).map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('keeps the same objectId covered across consecutive moments', () => {
    const moments = [
      { id: 'bridge-1', time: 1, objectId: 'london-bridge', lifetime: 6, rect: { x: 0, y: 0, width: 0.1, height: 0.1 } },
      { id: 'bridge-6', time: 6, objectId: 'london-bridge', lifetime: 6, rect: { x: 0, y: 0, width: 0.1, height: 0.1 } },
      { id: 'bus-12', time: 12, objectId: 'london-bus', lifetime: 6, rect: { x: 0, y: 0, width: 0.1, height: 0.1 } },
    ];
    expect(objectIdActiveAt(moments, 'london-bridge', 7)).toBe(true);
    expect(objectIdActiveAt(moments, 'london-bridge', 11.5)).toBe(true);
    expect(objectIdActiveAt(moments, 'london-bridge', 12)).toBe(false);
    expect(objectIdActiveAt(moments, 'london-bus', 12)).toBe(true);
  });

  it('warns when two moments are closer than 6 seconds', () => {
    const objects = [
      { id: 'bird', scene: 'movie' as const, label: 'bird', realSize: 0.3 },
      { id: 'dog', scene: 'movie' as const, label: 'dog', realSize: 0.4 },
    ];
    const issues = validateTimeline(
      {
        moments: [
          { id: 'a', time: 4, objectId: 'bird', rect: { x: 0, y: 0, width: 0.1, height: 0.1 } },
          { id: 'b', time: 6, objectId: 'dog', rect: { x: 0, y: 0, width: 0.1, height: 0.1 } },
        ],
      },
      objects,
      30,
    );
    expect(issues.some((issue) => issue.level === 'warning')).toBe(true);
  });

  it('errors when a moment model is missing from the manifest', () => {
    const issues = validateTimeline(
      { moments: [{ id: 'x', time: 1, objectId: 'nope', rect: { x: 0, y: 0, width: 0.1, height: 0.1 } }] },
      [],
      10,
    );
    expect(issues.some((issue) => issue.level === 'error')).toBe(true);
  });

  it('ships per-film timelines (no shared legacy moments)', () => {
    expect(bundledTimeline.films).toBeTruthy();
    expect(Array.isArray(bundledTimeline.films.mountains?.moments)).toBe(true);
    expect(Array.isArray(bundledTimeline.films.london?.moments)).toBe(true);
    expect(bundledTimeline.moments).toBeUndefined();
  });
});

describe('slots and behaviors', () => {
  it('assigns a free slot', () => {
    expect(assignSlot('right', ['right'])).toBe('left');
    expect(assignSlot(undefined, ['left', 'right', 'low-left', 'low-right'])).toBeNull();
  });

  it('places every movie prop on the user left at a shared reach', async () => {
    const { slotPosition } = await import('../../src/video/slots.js');
    const head = { x: 0, y: 1.4, z: 0 };
    const screen = { x: 0, y: 1.4, z: -1.55 };
    const forward = { x: 0, z: -1 };
    const right = { x: 1, z: 0 };
    const a = slotPosition('left', screen, forward, right, undefined, head);
    const b = slotPosition('right', screen, forward, right, undefined, head);
    expect(a.x).toBeLessThan(head.x);
    expect(b.x).toBe(a.x);
    expect(a.z).toBeCloseTo(-0.72, 1);
  });

  it('maps labels to behaviors and default reactions', () => {
    expect(behaviorFromLabel('bird')).toBe('fly');
    expect(behaviorFromLabel('unknown')).toBe('hover');
    expect(behaviorFromLabel('bird', 'hover')).toBe('hover');
    expect(reactionFromBehavior('fly')).toBe('dart');
  });

  it('selects a perch surface within range', () => {
    const target = perchTarget(
      [{ x: 0.2, y: 0.7, z: -0.3, horizontal: true }],
      { x: 0, y: 1, z: 0 },
      1.5,
    );
    expect(target?.y).toBe(0.7);
  });

  it('enforces reaction cooldown', () => {
    const state = createReactionState();
    expect(tryStartReaction(state, 'hop', 1)).toBe(true);
    expect(tryStartReaction(state, 'hop', 1)).toBe(false);
    updateReaction(state, 5);
    expect(tryStartReaction(state, 'spin', 1)).toBe(true);
  });
});
