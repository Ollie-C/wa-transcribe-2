import { describe, expect, it } from 'vitest';

import { splitTextIntoChunks } from '$lib/utils/chunking';

describe('splitTextIntoChunks', () => {
  it('keeps smaller paragraphs together when they fit inside the limit', () => {
    const input = 'First short paragraph.\n\nSecond short paragraph.';
    const result = splitTextIntoChunks(input, { maxChars: 120 });

    expect(result).toEqual(['First short paragraph.\n\nSecond short paragraph.']);
  });

  it('splits longer text into multiple chunks without losing content', () => {
    const input =
      'This is a longer paragraph designed to force chunking because it will exceed the configured maximum. '.repeat(4);

    const result = splitTextIntoChunks(input, { maxChars: 120 });

    expect(result.length).toBeGreaterThan(1);
    expect(result.join(' ').replace(/\s+/g, ' ').trim()).toContain('This is a longer paragraph designed');
  });
});
