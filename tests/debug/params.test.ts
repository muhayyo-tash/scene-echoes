import { describe, expect, it } from 'vitest';
import { parseDebugParams } from '../../src/debug/params.js';

describe('debug params', () => {
  it('parses headset test flags', () => {
    const params = parseDebugParams('?debug=1&fast=1&movie=ready&object=duck&open=sofa&handsless=1&t=4&reset=1&surfaces=default');
    expect(params.debug).toBe(true);
    expect(params.fast).toBe(true);
    expect(params.movieReady).toBe(true);
    expect(params.objectId).toBe('duck');
    expect(params.openId).toBe('sofa');
    expect(params.handsLess).toBe(true);
    expect(params.startTime).toBe(4);
    expect(params.reset).toBe(true);
    expect(params.surfacesDefault).toBe(true);
  });
});
