import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({
  browser: true
}));

import { SESSION_STORAGE_KEY, STORAGE_SCHEMA_VERSION, TRANSCRIPT_HISTORY_STORAGE_KEY, UPLOAD_HISTORY_STORAGE_KEY } from '$lib/config';
import { createBrowserStorageAdapter } from '$lib/services/storage';

describe('browser storage adapter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads legacy session payloads and assigns the current schema version', () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        step: 'transcript',
        audioSource: null,
        rawTranscript: 'Legacy raw',
        instructionText: '',
        correctedTranscript: '',
        refinedTranscript: '',
        refinedSourceText: '',
        translation: '',
        correctionRules: [],
        pendingSuggestions: [],
        refinementDiff: [],
        exportTarget: 'raw',
        timestamps: {
          transcribedAt: null,
          correctedAt: null,
          refinedAt: null,
          translatedAt: null
        }
      })
    );

    const storage = createBrowserStorageAdapter();
    const session = storage.loadSession();

    expect(session?.rawTranscript).toBe('Legacy raw');
    expect(session?.version).toBe(STORAGE_SCHEMA_VERSION);
  });

  it('writes versioned envelopes for session and history state', () => {
    const storage = createBrowserStorageAdapter();

    storage.saveSession({
      hydrated: true,
      step: 'transcript',
      currentSessionId: null,
      audioSource: null,
      rawTranscript: 'Raw transcript',
      instructionText: '',
      correctedTranscript: '',
      refinedTranscript: '',
      refinedSourceText: '',
      translation: '',
      correctionRules: [],
      pendingSuggestions: [],
      refinementDiff: [],
      exportTarget: 'raw',
      uploadHistory: [],
      transcriptHistory: [],
      modelStatus: {
        whisper: { status: 'idle', progress: null, message: '', device: 'unknown', profile: 'FastAPI / faster-whisper' },
        marian: { status: 'idle', progress: null, message: '', device: 'unknown', profile: 'API / Llama 3.1' }
      },
      processing: {
        transcription: { status: 'idle', message: '', error: null, progress: null },
        correction: { status: 'idle', message: '', error: null, progress: null },
        refinement: { status: 'idle', message: '', error: null, progress: null },
        translation: { status: 'idle', message: '', error: null, progress: null }
      },
      timestamps: {
        transcribedAt: null,
        correctedAt: null,
        refinedAt: null,
        translatedAt: null
      }
    });
    storage.saveUploadHistory([]);
    storage.saveTranscriptHistory([]);

    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}').version).toBe(STORAGE_SCHEMA_VERSION);
    expect(JSON.parse(localStorage.getItem(UPLOAD_HISTORY_STORAGE_KEY) ?? '{}').version).toBe(STORAGE_SCHEMA_VERSION);
    expect(JSON.parse(localStorage.getItem(TRANSCRIPT_HISTORY_STORAGE_KEY) ?? '{}').version).toBe(STORAGE_SCHEMA_VERSION);
  });
});
