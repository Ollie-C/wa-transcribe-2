import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createOfflineSetupStatus, loadSetupStatus, summarizeReadiness } from '$lib/services/readiness';

describe('setup readiness', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps a healthy backend into a ready setup status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'ready',
            api: { ready: true, status: 'ready', detail: 'API is reachable.' },
            ollama: { ready: true, status: 'ready', detail: 'Ollama is reachable.' },
            llm_model: { ready: true, status: 'ready', detail: 'Model is installed.' },
            whisper: { ready: true, status: 'ready', detail: 'Whisper is ready.' }
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      )
    );

    const result = await loadSetupStatus();

    expect(result.state).toBe('ready');
    expect(result.canTranscribe).toBe(true);
    expect(result.canUseLlm).toBe(true);
  });

  it('maps a missing Ollama model into a guided degraded state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'degraded',
            api: { ready: true, status: 'ready', detail: 'API is reachable.' },
            ollama: { ready: true, status: 'ready', detail: 'Ollama is reachable.' },
            llm_model: { ready: false, status: 'missing', detail: 'Run `ollama pull llama3.1:8b` and retry.' },
            whisper: { ready: true, status: 'ready', detail: 'Whisper is ready.' }
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      )
    );

    const result = await loadSetupStatus();

    expect(result.state).toBe('model-missing');
    expect(result.canTranscribe).toBe(true);
    expect(result.canUseLlm).toBe(false);
    expect(result.message).toContain('ollama pull');
  });

  it('maps an unreachable backend into a backend-offline state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const result = await loadSetupStatus();

    expect(result.state).toBe('backend-offline');
    expect(result.canTranscribe).toBe(false);
    expect(result.message).toContain('pnpm dev:local');
  });

  it('summarizes a whisper failure without blocking LLM features', () => {
    const result = summarizeReadiness(
      {
        status: 'degraded',
        api: { ready: true, status: 'ready', detail: 'API is reachable.' },
        ollama: { ready: true, status: 'ready', detail: 'Ollama is reachable.' },
        llm_model: { ready: true, status: 'ready', detail: 'Model is installed.' },
        whisper: { ready: false, status: 'unavailable', detail: 'Whisper could not load.' }
      },
      '2026-03-25T00:00:00.000Z'
    );

    expect(result.state).toBe('whisper-unavailable');
    expect(result.canTranscribe).toBe(false);
    expect(result.canUseLlm).toBe(true);
  });

  it('creates an actionable offline fallback state', () => {
    const result = createOfflineSetupStatus(new TypeError('Failed to fetch'), '2026-03-25T00:00:00.000Z');

    expect(result.title).toBe('Start the local backend first');
    expect(result.hint).toContain('pnpm dev:local');
  });
});
