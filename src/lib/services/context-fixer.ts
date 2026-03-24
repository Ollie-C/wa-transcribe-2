import Fuse from 'fuse.js';

import { FUZZY_THRESHOLD, MAX_FUZZY_SUGGESTIONS_PER_RULE } from '$lib/config';
import type { CorrectionRule, CorrectionSuggestion, ReplacementSummary } from '$lib/types';
import { countWords, escapeRegExp, normalizeForMatch, normalizeWhitespace } from '$lib/utils/text';

interface CandidatePhrase {
  value: string;
  normalized: string;
}

export interface CorrectionResult {
  text: string;
  replacements: ReplacementSummary[];
  suggestions: CorrectionSuggestion[];
}

const FILLER_WORDS = ['um', 'uh', 'erm', 'ah', 'like', 'you know', 'i mean'];

function dedupeImmediateSentenceRepetition(text: string): string {
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) ?? [text];
  const result: string[] = [];
  let previous = '';

  for (const sentence of sentences) {
    const normalized = normalizeForMatch(sentence);
    if (normalized && normalized === previous) {
      continue;
    }

    previous = normalized;
    result.push(sentence);
  }

  return result.join('').trim();
}

function dedupeImmediateWordRepetition(text: string): string {
  return text.replace(/\b([A-Za-z']+)(\s+\1\b)+/gi, '$1');
}

function removeFillerWords(text: string): string {
  let nextText = text;

  for (const filler of FILLER_WORDS) {
    const expression = new RegExp(`\\b${escapeRegExp(filler)}\\b[, ]*`, 'gi');
    nextText = nextText.replace(expression, '');
  }

  return nextText.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();
}

function applyInstruction(text: string, instruction: string): string {
  const normalized = normalizeForMatch(instruction);
  let nextText = text;

  if (/(remove|fix|clean).*(repetition|repeat|duplicate)/.test(normalized)) {
    nextText = dedupeImmediateSentenceRepetition(nextText);
    nextText = dedupeImmediateWordRepetition(nextText);
  }

  if (/(remove|strip).*(filler)/.test(normalized)) {
    nextText = removeFillerWords(nextText);
  }

  return nextText;
}

export function parseInstructionText(input: string): CorrectionRule[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const fuzzyMatch = line.match(/^(.+?)\s*~>\s*(.+)$/);
      if (fuzzyMatch) {
        return {
          id: `instruction-${index}`,
          heard: fuzzyMatch[1].trim(),
          correct: fuzzyMatch[2].trim(),
          mode: 'fuzzy' as const,
          createdAt: new Date().toISOString(),
          lastAppliedAt: null,
          lastReplacementCount: 0
        };
      }

      const exactMatch = line.match(/^(.+?)\s*->\s*(.+)$/);
      if (exactMatch) {
        return {
          id: `instruction-${index}`,
          heard: exactMatch[1].trim(),
          correct: exactMatch[2].trim(),
          mode: 'exact' as const,
          createdAt: new Date().toISOString(),
          lastAppliedAt: null,
          lastReplacementCount: 0
        };
      }

      return {
        id: `instruction-${index}`,
        heard: '',
        correct: line,
        mode: 'instruction' as const,
        createdAt: new Date().toISOString(),
        lastAppliedAt: null,
        lastReplacementCount: 0
      };
    });
}

function uniqueCandidates(text: string, wordsPerPhrase: number): CandidatePhrase[] {
  const wordMatches = Array.from(text.matchAll(/\b[\p{L}\p{N}'-]+\b/gu)).map((match) => match[0]);
  if (!wordMatches.length) {
    return [];
  }

  const seen = new Set<string>();
  const candidates: CandidatePhrase[] = [];

  for (let index = 0; index <= wordMatches.length - wordsPerPhrase; index += 1) {
    const value = wordMatches.slice(index, index + wordsPerPhrase).join(' ');
    const normalized = normalizeForMatch(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    candidates.push({ value, normalized });
  }

  return candidates;
}

function replaceExact(text: string, rule: CorrectionRule): { nextText: string; count: number } {
  const heard = normalizeWhitespace(rule.heard);
  if (!heard) {
    return { nextText: text, count: 0 };
  }

  const expression = new RegExp(`\\b${escapeRegExp(heard)}\\b`, 'giu');
  let count = 0;

  const nextText = text.replace(expression, () => {
    count += 1;
    return rule.correct.trim();
  });

  return { nextText, count };
}

export function applyCorrections(text: string, rules: CorrectionRule[]): CorrectionResult {
  let nextText = text;
  const replacements: ReplacementSummary[] = [];
  const suggestions: CorrectionSuggestion[] = [];

  for (const rule of rules) {
    if (rule.mode === 'instruction') {
      const updated = applyInstruction(nextText, rule.correct);
      replacements.push({
        ruleId: rule.id,
        from: rule.correct,
        to: rule.correct,
        count: updated === nextText ? 0 : 1
      });
      nextText = updated;
      continue;
    }

    if (!normalizeWhitespace(rule.heard) || !normalizeWhitespace(rule.correct)) {
      continue;
    }

    if (rule.mode === 'exact') {
      const result = replaceExact(nextText, rule);
      nextText = result.nextText;
      replacements.push({
        ruleId: rule.id,
        from: rule.heard,
        to: rule.correct,
        count: result.count
      });
      continue;
    }

    const heardWordCount = Math.max(countWords(rule.heard), 1);
    const candidates = uniqueCandidates(nextText, heardWordCount);
    const heard = normalizeForMatch(rule.heard);
    const correct = normalizeForMatch(rule.correct);

    const fuse = new Fuse(candidates, {
      includeScore: true,
      shouldSort: true,
      ignoreLocation: true,
      threshold: FUZZY_THRESHOLD,
      keys: ['normalized']
    });

    const results = fuse
      .search(heard)
      .filter((result) => result.item.normalized !== heard && result.item.normalized !== correct)
      .slice(0, MAX_FUZZY_SUGGESTIONS_PER_RULE);

    for (const result of results) {
      suggestions.push({
        id: `${rule.id}:${result.item.normalized}`,
        ruleId: rule.id,
        candidate: result.item.value,
        replacement: rule.correct.trim(),
        score: result.score ?? 0,
        accepted: false
      });
    }

    replacements.push({
      ruleId: rule.id,
      from: rule.heard,
      to: rule.correct,
      count: 0
    });
  }

  return { text: nextText, replacements, suggestions };
}

export function applyAcceptedSuggestions(text: string, suggestions: CorrectionSuggestion[]): { text: string; replacements: ReplacementSummary[] } {
  let nextText = text;
  const replacements: ReplacementSummary[] = [];

  for (const suggestion of suggestions.filter((item) => item.accepted)) {
    const expression = new RegExp(`\\b${escapeRegExp(normalizeWhitespace(suggestion.candidate))}\\b`, 'giu');
    let count = 0;

    nextText = nextText.replace(expression, () => {
      count += 1;
      return suggestion.replacement;
    });

    replacements.push({
      ruleId: suggestion.ruleId,
      from: suggestion.candidate,
      to: suggestion.replacement,
      count
    });
  }

  return { text: nextText, replacements };
}
