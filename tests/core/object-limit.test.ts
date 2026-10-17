import { describe, expect, it } from 'vitest';
import { applyObjectLimit } from '../../src/core/object-limit.js';

describe('object limit', () => {
  it('removes the oldest when converting a fourth', () => {
    const first = applyObjectLimit([], { id: 'a' }, 3);
    const second = applyObjectLimit(first.objects, { id: 'b' }, 3);
    const third = applyObjectLimit(second.objects, { id: 'c' }, 3);
    const fourth = applyObjectLimit(third.objects, { id: 'd' }, 3);
    expect(fourth.removed?.id).toBe('a');
    expect(fourth.objects.map((o) => o.id)).toEqual(['b', 'c', 'd']);
  });
});
