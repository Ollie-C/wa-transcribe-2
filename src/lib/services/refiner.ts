import { LOCAL_API_BASE_URL, REFINEMENT_CHUNK_SIZE } from '$lib/config';
import { normalizeRequestError, readErrorDetail } from '$lib/services/api';
import type { CorrectionRule, ModelProgressUpdate, RefinementResult } from '$lib/types';
import { splitTextIntoChunks } from '$lib/utils/chunking';
import { normalizeForMatch } from '$lib/utils/text';

interface RefineCallbacks {
  onProgress?: (update: ModelProgressUpdate) => void;
}

const SYSTEM_PROMPT =
  'You are a transcript editor. Make only bounded edits to the provided transcript. Preserve meaning, structure, and wording as much as possible. Prefer the smallest possible change that satisfies the instructions. Never replace the text with a different quote, different example, or unrelated sentence. Do not summarize. Do not add new facts. Output only the corrected transcript.';

function buildContext(rules: CorrectionRule[]): string {
  return rules.length
    ? rules
        .map((rule) =>
          rule.mode === 'instruction'
            ? `- Instruction: ${rule.correct}`
            : `- Heard: ${rule.heard} -> Correct: ${rule.correct}`
        )
        .join('\n')
    : '- No explicit corrections provided.';
}

function collectNormalizedWords(value: string): Set<string> {
  return new Set(normalizeForMatch(value).split(' ').filter(Boolean));
}

export function isOverlyDivergentRefinement(source: string, candidate: string): boolean {
  const sourceWords = collectNormalizedWords(source);
  const candidateWords = collectNormalizedWords(candidate);

  if (sourceWords.size === 0 || candidateWords.size === 0) {
    return false;
  }

  let overlap = 0;
  for (const word of candidateWords) {
    if (sourceWords.has(word)) {
      overlap += 1;
    }
  }

  const ratio = overlap / candidateWords.size;
  return ratio < 0.35;
}

export async function refineTranscript(
  text: string,
  contextRules: CorrectionRule[],
  signal?: AbortSignal,
  callbacks: RefineCallbacks = {}
): Promise<RefinementResult> {
  const chunks = splitTextIntoChunks(text, { maxChars: REFINEMENT_CHUNK_SIZE });
  const refinedChunks: string[] = [];

  for (const [index, chunk] of chunks.entries()) {
    callbacks.onProgress?.({
      progress: chunks.length ? index / chunks.length : null,
      message: `Refining chunk ${index + 1} of ${chunks.length}`
    });

    let response: Response;
    try {
      response = await fetch(`${LOCAL_API_BASE_URL}/api/refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: chunk,
          instructions: SYSTEM_PROMPT,
          context: buildContext(contextRules)
        }),
        signal
      });
    } catch (error) {
      throw new Error(normalizeRequestError(error, 'Refinement could not reach the local backend.'));
    }

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(detail || `Refinement failed (${response.status}).`);
    }

    const json = (await response.json()) as {
      text?: string;
    };

    const content = json.text?.trim();
    if (!content) {
      throw new Error('Refinement returned an empty transcript.');
    }

    if (isOverlyDivergentRefinement(chunk, content)) {
      throw new Error('Refinement changed the transcript too aggressively. Try a more specific instruction.');
    }

    refinedChunks.push(content);
  }

  callbacks.onProgress?.({ progress: 1, message: 'Refinement complete' });

  return {
    text: refinedChunks.join('\n\n'),
    chunksUsed: chunks.length
  };
}
