import { describe, expect, it } from 'vitest';
import { momentsToClearOnSeek, stageForMoment } from '../../src/video/timeline.js';
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

  it('starts with an empty bundled timeline', () => {
    expect(bundledTimeline.moments).toEqual([]);
    expect(parseManifest(bundledManifest).manifest.objects.some((object) => object.scene === 'movie')).toBe(
      false,
    );
  });
});

describe('slots and behaviors', () => {
  it('assigns a free slot', () => {
    expect(assignSlot('right', ['right'])).toBe('left');
    expect(assignSlot(undefined, ['left', 'right', 'low-left', 'low-right'])).toBeNull();
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
