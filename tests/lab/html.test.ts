import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('animation lab page', () => {
  it('has a tab for every scene', () => {
    const html = readFileSync('lab.html', 'utf8');
    for (const tab of ['conversion', 'object3d', 'book', 'movie', 'hotspot']) {
      expect(html).toContain(`data-tab="${tab}"`);
    }
    expect(html).toContain('Hand feel, real surfaces and lighting are approximated here');
  });
});
