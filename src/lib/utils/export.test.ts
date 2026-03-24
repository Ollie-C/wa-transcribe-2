import { describe, expect, it } from 'vitest';

import { buildMarkdownExport, getExportContent, resolveDefaultExportTarget } from '$lib/utils/export';
import type { PipelineState } from '$lib/types';

const baseState: Pick<
  PipelineState,
  'audioSource' | 'rawTranscript' | 'correctedTranscript' | 'refinedTranscript' | 'translation' | 'timestamps'
> = {
  audioSource: {
    name: 'voice-note.webm',
    origin: 'recording',
    mimeType: 'audio/webm',
    size: 100
  },
  rawTranscript: 'Raw output',
  correctedTranscript: 'Corrected output',
  refinedTranscript: '',
  translation: '',
  timestamps: {
    transcribedAt: '2026-03-24T00:00:00.000Z',
    correctedAt: '2026-03-24T00:00:00.000Z',
    refinedAt: null,
    translatedAt: null
  }
};

describe('export helpers', () => {
  it('picks the highest completed export target', () => {
    expect(resolveDefaultExportTarget({ refinedTranscript: '', translation: '' })).toBe('raw');
    expect(resolveDefaultExportTarget({ refinedTranscript: 'Refined', translation: '' })).toBe('refined');
    expect(resolveDefaultExportTarget({ refinedTranscript: 'Refined', translation: 'Japanese' })).toBe('translation');
  });

  it('returns the requested export content', () => {
    expect(
      getExportContent(
        {
          rawTranscript: 'Raw',
          refinedTranscript: 'Refined',
          translation: 'Japanese'
        },
        'refined'
      )
    ).toBe('Refined');
  });

  it('builds a markdown bundle across available stages', () => {
    const result = buildMarkdownExport({
      ...baseState,
      refinedTranscript: 'Refined output',
      translation: 'Japanese output'
    });

    expect(result).toContain('# WA Transcribe 2 Export');
    expect(result).toContain('## Raw Transcript');
    expect(result).toContain('## Refined Transcript');
    expect(result).toContain('## Japanese Translation');
  });
});
