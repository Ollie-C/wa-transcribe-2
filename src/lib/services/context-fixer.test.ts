import { describe, expect, it } from 'vitest';

import { applyAcceptedSuggestions, applyCorrections, parseInstructionText } from '$lib/services/context-fixer';
import type { CorrectionRule } from '$lib/types';

const exactRule: CorrectionRule = {
  id: 'rule-1',
  heard: 'Kommy',
  correct: 'Gomi',
  mode: 'exact',
  createdAt: '2026-03-24T00:00:00.000Z',
  lastAppliedAt: null,
  lastReplacementCount: 0
};

describe('context fixer', () => {
  it('applies exact correction pairs immediately', () => {
    const result = applyCorrections('Kommy joined Kommy on stage.', [exactRule]);

    expect(result.text).toBe('Gomi joined Gomi on stage.');
    expect(result.replacements[0]?.count).toBe(2);
  });

  it('returns fuzzy suggestions for near matches without auto-applying them', () => {
    const result = applyCorrections('Komi joined the meeting.', [
      {
        ...exactRule,
        id: 'rule-2',
        heard: 'Kommy',
        correct: 'Gomi',
        mode: 'fuzzy'
      }
    ]);

    expect(result.text).toBe('Komi joined the meeting.');
    expect(result.suggestions[0]?.candidate).toBe('Komi');
  });

  it('applies accepted fuzzy suggestions in a second pass', () => {
    const { suggestions } = applyCorrections('Komi joined the meeting.', [
      {
        ...exactRule,
        id: 'rule-3',
        heard: 'Kommy',
        correct: 'Gomi',
        mode: 'fuzzy'
      }
    ]);

    suggestions[0].accepted = true;
    const result = applyAcceptedSuggestions('Komi joined the meeting.', suggestions);

    expect(result.text).toBe('Gomi joined the meeting.');
    expect(result.replacements[0]?.count).toBe(1);
  });

  it('parses freeform instructions and applies repetition cleanup locally', () => {
    const rules = parseInstructionText('remove repetition\nKommy -> Gomi');
    const result = applyCorrections('Hello there. Hello there. Kommy joined.', rules);

    expect(result.text).toBe('Hello there. Gomi joined.');
  });
});
