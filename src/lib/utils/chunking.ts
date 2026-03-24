import { normalizeWhitespace } from '$lib/utils/text';

interface ChunkOptions {
  maxChars: number;
}

function splitLongSentence(sentence: string, maxChars: number): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return [sentence];
  }

  const chunks: string[] = [];
  let buffer = '';

  for (const word of words) {
    const next = buffer ? `${buffer} ${word}` : word;
    if (next.length > maxChars && buffer) {
      chunks.push(buffer);
      buffer = word;
      continue;
    }

    buffer = next;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}

function splitParagraph(paragraph: string, maxChars: number): string[] {
  if (paragraph.length <= maxChars) {
    return [paragraph];
  }

  const sentences = paragraph.match(/[^.!?]+[.!?]?/g) ?? [paragraph];
  const chunks: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    const trimmed = normalizeWhitespace(sentence);
    if (!trimmed) {
      continue;
    }

    if (trimmed.length > maxChars) {
      if (buffer) {
        chunks.push(buffer);
        buffer = '';
      }

      chunks.push(...splitLongSentence(trimmed, maxChars));
      continue;
    }

    const next = buffer ? `${buffer} ${trimmed}` : trimmed;
    if (next.length > maxChars && buffer) {
      chunks.push(buffer);
      buffer = trimmed;
      continue;
    }

    buffer = next;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}

export function splitTextIntoChunks(text: string, { maxChars }: ChunkOptions): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const paragraphs = trimmed.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  if (!paragraphs.length) {
    return [];
  }

  const chunks: string[] = [];
  let buffer = '';

  for (const paragraph of paragraphs) {
    const pieces = splitParagraph(paragraph, maxChars);

    for (const piece of pieces) {
      const next = buffer ? `${buffer}\n\n${piece}` : piece;
      if (next.length > maxChars && buffer) {
        chunks.push(buffer);
        buffer = piece;
        continue;
      }

      buffer = next;
    }
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}
