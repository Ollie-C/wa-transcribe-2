import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TRANSLATION_CHUNK_SIZE } from '$lib/config';
import { translateTranscript } from '$lib/services/translator';
import { splitTextIntoChunks } from '$lib/utils/chunking';

vi.mock('$lib/utils/chunking', () => ({
  splitTextIntoChunks: vi.fn()
}));

describe('translator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(splitTextIntoChunks).mockReturnValue(['hello world']);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ text: 'こんにちは世界' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
  });

  it('uses the translation chunk size limit', async () => {
    await translateTranscript('hello world');

    expect(splitTextIntoChunks).toHaveBeenCalledWith('hello world', { maxChars: TRANSLATION_CHUNK_SIZE });
  });
});
