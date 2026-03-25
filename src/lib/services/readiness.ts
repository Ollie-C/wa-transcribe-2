import { LOCAL_API_BASE_URL } from '$lib/config';
import { normalizeRequestError, readErrorDetail } from '$lib/services/api';
import type { BackendReadinessResponse, SetupStatus } from '$lib/types';

export function summarizeReadiness(readiness: BackendReadinessResponse, checkedAt: string): SetupStatus {
  if (!readiness.ollama.ready) {
    return {
      state: 'ollama-offline',
      title: 'Start Ollama to unlock refinement and translation',
      message: readiness.ollama.detail,
      hint: 'Transcription can still run once Whisper is ready.',
      checkedAt,
      canTranscribe: readiness.whisper.ready,
      canUseLlm: false,
      readiness
    };
  }

  if (!readiness.llm_model.ready) {
    return {
      state: 'model-missing',
      title: 'Pull the local Llama model once before public use',
      message: readiness.llm_model.detail,
      hint: 'After the model is installed, retry this check and the app will be fully ready.',
      checkedAt,
      canTranscribe: readiness.whisper.ready,
      canUseLlm: false,
      readiness
    };
  }

  if (!readiness.whisper.ready) {
    return {
      state: 'whisper-unavailable',
      title: 'Fix Whisper before offering transcription',
      message: readiness.whisper.detail,
      hint: 'Check backend/.env and backend dependencies, then retry setup status.',
      checkedAt,
      canTranscribe: false,
      canUseLlm: true,
      readiness
    };
  }

  return {
    state: 'ready',
    title: 'Local setup is ready',
    message: 'This app runs locally: audio stays on this machine, and all stages are ready to use.',
    hint: 'Upload or record audio, then transcribe to get started.',
    checkedAt,
    canTranscribe: true,
    canUseLlm: true,
    readiness
  };
}

export function createCheckingSetupStatus(): SetupStatus {
  return {
    state: 'checking',
    title: 'Checking local setup',
    message: 'Verifying the backend, Ollama, and Whisper configuration.',
    hint: 'This may take a moment on the first run while local models warm up.',
    checkedAt: null,
    canTranscribe: false,
    canUseLlm: false,
    readiness: null
  };
}

export function createOfflineSetupStatus(error: unknown, checkedAt: string): SetupStatus {
  return {
    state: 'backend-offline',
    title: 'Start the local backend first',
    message: normalizeRequestError(error, 'The local backend is unavailable.'),
    hint: 'Run `pnpm dev:local`, then retry this setup check.',
    checkedAt,
    canTranscribe: false,
    canUseLlm: false,
    readiness: null
  };
}

export async function loadSetupStatus(signal?: AbortSignal): Promise<SetupStatus> {
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(`${LOCAL_API_BASE_URL}/health/readiness`, { signal });
    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(detail || `Setup check failed (${response.status}).`);
    }

    const readiness = (await response.json()) as BackendReadinessResponse;
    return summarizeReadiness(readiness, checkedAt);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    return createOfflineSetupStatus(error, checkedAt);
  }
}
