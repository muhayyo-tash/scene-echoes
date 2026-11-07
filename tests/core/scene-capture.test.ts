import { describe, expect, it } from 'vitest';
import { pickHeadsetCamera } from '../../src/core/scene-capture.js';

describe('headset camera pick', () => {
  it('prefers a back/passthrough camera over the avatar camera', () => {
    const chosen = pickHeadsetCamera([
      { deviceId: 'a', label: 'camera 2 0, facing front' },
      { deviceId: 'b', label: 'camera 2 1, facing back' },
      { deviceId: 'c', label: 'Virtual camera' },
    ]);
    expect(chosen?.deviceId).toBe('b');
  });
});
