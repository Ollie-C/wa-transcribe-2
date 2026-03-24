import { LOCAL_API_BASE_URL, TRANSCRIPTION_LANGUAGE } from '$lib/config';
import type { ModelProgressUpdate, TranscriptionResult } from '$lib/types';

interface TranscriberCallbacks {
  onModelProgress?: (update: ModelProgressUpdate) => void;
}

export async function transcribeAudio(
  file: Blob,
  signal?: AbortSignal,
  callbacks: TranscriberCallbacks = {}
): Promise<TranscriptionResult> {
  callbacks.onModelProgress?.({
    progress: 0,
    message: 'Uploading audio to local Whisper backend…'
  });

  const formData = new FormData();
  formData.append('file', file, file instanceof File ? file.name : 'recording.webm');
  formData.append('language', TRANSCRIPTION_LANGUAGE);

  const response = await fetch(`${LOCAL_API_BASE_URL}/api/transcribe`, {
    method: 'POST',
    body: formData,
    signal
  });

  callbacks.onModelProgress?.({
    progress: 0.8,
    message: 'Processing Whisper response…'
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Transcription failed (${response.status}): ${details || 'No error details returned.'}`);
  }

  const result = (await response.json()) as {
    text?: string;
    chunks?: Array<{ text?: string; timestamp?: [number, number] }>;
  };

  callbacks.onModelProgress?.({
    progress: 1,
    message: 'Local Whisper transcription complete.'
  });

  return {
    text: result.text?.trim() ?? '',
    chunks:
      result.chunks?.map((chunk) => ({
        text: chunk.text?.trim() ?? '',
        timestamp: chunk.timestamp
      })) ?? []
  };
}

export async function releaseTranscriber(): Promise<void> {
  return Promise.resolve();
}

export function getTranscriberRuntimeProfile(): string {
  return 'FastAPI / faster-whisper';
}
