import type { ExportTarget, PipelineState } from '$lib/types';

function buildHeader(label: string, text: string): string {
  return `## ${label}\n\n${text.trim()}`;
}

export function resolveDefaultExportTarget(state: Pick<PipelineState, 'translation' | 'refinedTranscript'>): ExportTarget {
  if (state.translation.trim()) {
    return 'translation';
  }

  if (state.refinedTranscript.trim()) {
    return 'refined';
  }

  return 'raw';
}

export function getExportContent(state: Pick<PipelineState, 'rawTranscript' | 'refinedTranscript' | 'translation'>, target: ExportTarget): string {
  if (target === 'translation') {
    return state.translation || '';
  }

  if (target === 'refined') {
    return state.refinedTranscript || '';
  }

  return state.rawTranscript || '';
}

export function buildMarkdownExport(state: Pick<PipelineState, 'audioSource' | 'rawTranscript' | 'correctedTranscript' | 'refinedTranscript' | 'translation' | 'timestamps'>): string {
  const sections: string[] = ['# WA Transcribe 2 Export'];

  if (state.audioSource) {
    sections.push(`- Source: ${state.audioSource.name}`);
  }

  if (state.timestamps.transcribedAt) {
    sections.push(`- Transcribed: ${state.timestamps.transcribedAt}`);
  }

  if (state.timestamps.refinedAt) {
    sections.push(`- Refined: ${state.timestamps.refinedAt}`);
  }

  if (state.timestamps.translatedAt) {
    sections.push(`- Translated: ${state.timestamps.translatedAt}`);
  }

  sections.push('');
  sections.push(buildHeader('Raw Transcript', state.rawTranscript || '_No raw transcript available._'));

  if (state.correctedTranscript.trim()) {
    sections.push(buildHeader('Corrected Transcript', state.correctedTranscript));
  }

  if (state.refinedTranscript.trim()) {
    sections.push(buildHeader('Refined Transcript', state.refinedTranscript));
  }

  if (state.translation.trim()) {
    sections.push(buildHeader('Japanese Translation', state.translation));
  }

  return sections.join('\n\n');
}

export function createFileStem(sourceName?: string | null): string {
  const base = (sourceName ?? 'transcript')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return base || 'transcript';
}
