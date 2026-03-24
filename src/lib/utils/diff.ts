import { diffWordsWithSpace } from 'diff';

import type { DiffSegment } from '$lib/types';

export function buildDiff(before: string, after: string): DiffSegment[] {
  if (before === after) {
    return before ? [{ type: 'equal', text: before }] : [];
  }

  const parts = diffWordsWithSpace(before, after);
  const segments: DiffSegment[] = [];

  for (const part of parts) {
    const type = part.added ? 'insert' : part.removed ? 'delete' : 'equal';
    const previous = segments.at(-1);

    if (previous?.type === type) {
      previous.text += part.value;
      continue;
    }

    segments.push({ type, text: part.value });
  }

  return segments;
}
