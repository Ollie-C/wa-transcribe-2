import { LOCAL_API_BASE_URL, TRANSLATION_CHUNK_SIZE } from '$lib/config';
import { normalizeRequestError, readErrorDetail } from '$lib/services/api';
import type { ModelProgressUpdate, TranslationResult } from '$lib/types';
import { splitTextIntoChunks } from '$lib/utils/chunking';

interface TranslatorCallbacks {
  onProgress?: (update: ModelProgressUpdate) => void;
}

const TRANSLATION_INSTRUCTIONS =
  'Translate the following English transcript into natural Japanese. Preserve meaning, names, formatting, and paragraph breaks. Do not summarize. Output only the Japanese translation.';

export async function translateTranscript(
  text: string,
  signal?: AbortSignal,
  callbacks: TranslatorCallbacks = {}
): Promise<TranslationResult> {
  const chunks = splitTextIntoChunks(text, { maxChars: TRANSLATION_CHUNK_SIZE });
  const translatedChunks: string[] = [];

  for (const [index, chunk] of chunks.entries()) {
    callbacks.onProgress?.({
      progress: chunks.length ? index / chunks.length : null,
      message: `Translating chunk ${index + 1} of ${chunks.length}`
    });

    let response: Response;
    try {
      response = await fetch(`${LOCAL_API_BASE_URL}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: chunk,
          instructions: TRANSLATION_INSTRUCTIONS
        }),
        signal
      });
    } catch (error) {
      throw new Error(normalizeRequestError(error, 'Translation could not reach the local backend.'));
    }

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(detail || `Translation failed (${response.status}).`);
    }

    const json = (await response.json()) as { text?: string };

    const content = json.text?.trim();
    if (!content) {
      throw new Error('Translation returned an empty response.');
    }

    translatedChunks.push(content);
  }

  callbacks.onProgress?.({ progress: 1, message: 'Translation complete' });

  return {
    text: translatedChunks.join('\n\n'),
    chunksUsed: chunks.length
  };
}

export async function releaseTranslator(): Promise<void> {
  return Promise.resolve();
}

export function getTranslatorRuntimeProfile(): string {
  return 'API / Llama 3.1';
}
