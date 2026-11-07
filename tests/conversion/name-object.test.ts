import { describe, expect, it } from 'vitest';
import { parseObjectName } from '../../src/conversion/name-object.js';

describe('parseObjectName', () => {
  it('keeps a short noun', () => {
    expect(parseObjectName('sofa')).toBe('sofa');
  });

  it('strips extra sentence wrapping', () => {
    expect(parseObjectName('The object is a sofa.')).toBe('sofa');
  });

  it('drops parts after two words and punctuation', () => {
    expect(parseObjectName('"orange sofa!"')).toBe('orange sofa');
  });

  it('returns empty for blank text', () => {
    expect(parseObjectName('   ')).toBe('');
  });
});
