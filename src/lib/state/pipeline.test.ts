import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({
  browser: true
}));

import { PipelineController } from '$lib/state/pipeline.svelte';
import type { StorageAdapter } from '$lib/services/storage';
import type { CorrectionRule, PersistedSession, PipelineState } from '$lib/types';
import { STORAGE_SCHEMA_VERSION } from '$lib/config';

function buildStorage(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  return {
    loadSession: () => null,
    saveSession: vi.fn(),
    clearSession: vi.fn(),
    loadUploadHistory: () => [],
    saveUploadHistory: vi.fn(),
    loadTranscriptHistory: () => [],
    saveTranscriptHistory: vi.fn(),
    saveAudioBlob: vi.fn().mockResolvedValue(undefined),
    loadAudioBlob: vi.fn().mockResolvedValue(null),
    deleteAudioBlob: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function buildInitialSession(): PersistedSession {
  return {
    version: STORAGE_SCHEMA_VERSION,
    step: 'refinement',
    audioSource: null,
    rawTranscript: 'Persisted raw',
    instructionText: 'remove repetition',
    correctedTranscript: 'Persisted corrected',
    refinedTranscript: 'Persisted refined',
    refinedSourceText: 'Persisted corrected',
    translation: 'Persisted translation',
    correctionRules: [],
    pendingSuggestions: [],
    refinementDiff: [],
    exportTarget: 'translation',
    timestamps: {
      transcribedAt: '2026-03-24T00:00:00.000Z',
      correctedAt: '2026-03-24T00:01:00.000Z',
      refinedAt: '2026-03-24T00:02:00.000Z',
      translatedAt: '2026-03-24T00:03:00.000Z'
    }
  };
}

function buildRule(): CorrectionRule {
  return {
    id: 'rule-1',
    heard: 'Kommy',
    correct: 'Gomi',
    mode: 'exact',
    createdAt: '2026-03-24T00:00:00.000Z',
    lastAppliedAt: null,
    lastReplacementCount: 0
  };
}

describe('PipelineController', () => {
  it('hydrates persisted text session state', () => {
    const saveSession = vi.fn();
    const controller = new PipelineController({
      storage: buildStorage({
        loadSession: () => buildInitialSession(),
        saveSession
      }),
      transcribeAudio: vi.fn(),
      applyCorrections: vi.fn(),
      applyAcceptedSuggestions: vi.fn(),
      refineTranscript: vi.fn(),
      translateTranscript: vi.fn(),
      buildDiff: vi.fn()
    });

    controller.hydrate();

    expect(controller.state.hydrated).toBe(true);
    expect(controller.state.rawTranscript).toBe('Persisted raw');
    expect(saveSession).toHaveBeenCalled();
  });

  it('runs the workflow and resets downstream outputs when source text changes', async () => {
    const transcribeAudio = vi.fn().mockResolvedValue({
      text: 'Raw transcript',
      chunks: []
    });
    const applyCorrections = vi.fn().mockReturnValue({
      text: 'Corrected transcript',
      replacements: [{ ruleId: 'rule-1', from: 'Kommy', to: 'Gomi', count: 1 }],
      suggestions: []
    });
    const refineTranscript = vi.fn().mockResolvedValue({
      text: 'Refined transcript',
      chunksUsed: 1
    });
    const translateTranscript = vi.fn().mockResolvedValue({
      text: '日本語訳',
      chunksUsed: 1
    });
    const controller = new PipelineController({
      storage: buildStorage(),
      transcribeAudio,
      applyCorrections,
      applyAcceptedSuggestions: vi.fn(),
      refineTranscript,
      translateTranscript,
      buildDiff: vi.fn().mockReturnValue([{ type: 'insert', text: 'Refined transcript' }])
    });

    controller.hydrate();
    controller.setAudioFile(
      new Blob(['audio']),
      {
        name: 'voice-note.webm',
        origin: 'recording',
        mimeType: 'audio/webm',
        size: 100
      }
    );

    await controller.transcribe();
    controller.setInstructionText('Kommy -> Gomi');
    await controller.applyCorrections();
    await controller.refine();
    await controller.translate();

    expect(transcribeAudio).toHaveBeenCalled();
    expect(applyCorrections).toHaveBeenCalledWith('Raw transcript', expect.any(Array));
    expect(applyCorrections.mock.calls[0]?.[1]?.[0]?.heard).toBe('Kommy');
    expect(refineTranscript).toHaveBeenCalled();
    expect(translateTranscript).toHaveBeenCalledWith('Refined transcript', expect.any(AbortSignal), expect.any(Object));
    expect(controller.state.translation).toBe('日本語訳');
    expect(controller.state.exportTarget).toBe('translation');

    controller.updateRawTranscript('Manually changed raw transcript');

    expect(controller.state.correctedTranscript).toBe('');
    expect(controller.state.refinedTranscript).toBe('');
    expect(controller.state.translation).toBe('');
    expect(controller.state.exportTarget).toBe('raw');
  });

  it('clears downstream outputs when instructions change', () => {
    const controller = new PipelineController({
      storage: buildStorage(),
      transcribeAudio: vi.fn(),
      applyCorrections: vi.fn(),
      applyAcceptedSuggestions: vi.fn(),
      refineTranscript: vi.fn(),
      translateTranscript: vi.fn(),
      buildDiff: vi.fn()
    });

    controller.hydrate();
    controller.state.rawTranscript = 'Raw transcript';
    controller.state.correctedTranscript = 'Corrected transcript';
    controller.state.refinedTranscript = 'Refined transcript';
    controller.state.translation = '日本語訳';

    controller.setInstructionText('remove repetition');

    expect(controller.state.correctionRules).toHaveLength(1);
    expect(controller.state.correctedTranscript).toBe('');
    expect(controller.state.refinedTranscript).toBe('');
    expect(controller.state.translation).toBe('');
  });

  it('restores a saved upload from storage', async () => {
    const controller = new PipelineController({
      storage: buildStorage({
        loadUploadHistory: () => [
          {
            id: 'audio-1',
            name: 'saved-note.webm',
            origin: 'upload',
            mimeType: 'audio/webm',
            size: 128,
            lastModified: 123,
            addedAt: '2026-03-24T00:00:00.000Z'
          }
        ],
        loadAudioBlob: vi.fn().mockResolvedValue(new Blob(['saved-audio'], { type: 'audio/webm' }))
      }),
      transcribeAudio: vi.fn(),
      applyCorrections: vi.fn(),
      applyAcceptedSuggestions: vi.fn(),
      refineTranscript: vi.fn(),
      translateTranscript: vi.fn(),
      buildDiff: vi.fn()
    });

    controller.hydrate();
    await controller.restoreUpload('audio-1');

    expect(controller.state.audioSource?.name).toBe('saved-note.webm');
    expect(controller.state.processing.transcription.message).toContain('Ready to transcribe');
  });
});
