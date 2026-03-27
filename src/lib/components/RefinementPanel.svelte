<script lang="ts">
  import type { CorrectionSuggestion, DiffSegment, StageState } from '$lib/types';
  import DiffView from '$lib/components/DiffView.svelte';

  let {
    instructionText,
    currentText,
    correctedText,
    refinedText,
    suggestions,
    diffSegments,
    correctionState,
    refinementState,
    canRefine = true,
    refinementUnavailableMessage = '',
    onInstructionInput,
    onApplyCorrections,
    onToggleSuggestion,
    onApplySuggestions,
    onRefine,
    onCancelRefinement,
    onRefinedInput
  }: {
    instructionText: string;
    currentText: string;
    correctedText: string;
    refinedText: string;
    suggestions: CorrectionSuggestion[];
    diffSegments: DiffSegment[];
    correctionState: StageState;
    refinementState: StageState;
    canRefine?: boolean;
    refinementUnavailableMessage?: string;
    onInstructionInput: (value: string) => void;
    onApplyCorrections: () => void;
    onToggleSuggestion: (id: string) => void;
    onApplySuggestions: () => void;
    onRefine: () => void;
    onCancelRefinement: () => void;
    onRefinedInput: (value: string) => void;
  } = $props();

  const acceptedSuggestionsCount = $derived(suggestions.filter((item) => item.accepted).length);
</script>

<div class="space-y-4">
  <section class="rounded-[1rem] p-4">
    <div class="mb-3 flex items-center justify-between gap-3">
      <p class="text-sm font-semibold text-[color:var(--text)]">Instructions</p>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <button
          class="app-text-button"
          type="button"
          disabled={!currentText.trim() || correctionState.status === 'running'}
          onclick={onApplyCorrections}
        >
          Apply
        </button>
        <button
          class="app-text-button"
          type="button"
          disabled={!currentText.trim() || refinementState.status === 'running' || !canRefine}
          onclick={onRefine}
        >
          {refinementState.status === 'running' ? 'Refining…' : 'Refine'}
        </button>
        {#if refinementState.status === 'running'}
          <button class="app-text-button text-[color:var(--danger)] hover:text-[color:var(--danger)]" type="button" onclick={onCancelRefinement}>
            Cancel
          </button>
        {/if}
      </div>
    </div>

    <textarea
      class="min-h-[8rem] w-full rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-3 text-sm leading-6 text-[color:var(--text)] outline-none transition focus:border-[color:var(--page-accent)]"
      aria-label="Refinement instructions"
      placeholder={"One instruction per line\nremove repetition\nKommy -> Gomi\nKomi ~> Gomi"}
      value={instructionText}
      oninput={(event) => onInstructionInput((event.currentTarget as HTMLTextAreaElement).value)}
    ></textarea>

    {#if suggestions.length > 0}
      <div class="mt-3 space-y-2 rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3">
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Review fuzzy matches</p>
          <button
            class="app-text-button text-xs"
            type="button"
            disabled={acceptedSuggestionsCount === 0}
            onclick={onApplySuggestions}
          >
            Apply {acceptedSuggestionsCount}
          </button>
        </div>

        {#each suggestions as suggestion}
          <label class="flex items-center justify-between gap-3 rounded-[0.75rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-2">
            <div class="min-w-0">
              <p class="truncate text-sm text-[color:var(--text)]">{suggestion.candidate} -> {suggestion.replacement}</p>
              <p class="text-[11px] text-[color:var(--muted)]">{Math.round((1 - suggestion.score) * 100)}% match</p>
            </div>
            <input
              class="size-4 accent-[color:var(--page-accent)]"
              type="checkbox"
              checked={suggestion.accepted}
              onchange={() => onToggleSuggestion(suggestion.id)}
            />
          </label>
        {/each}
      </div>
    {/if}
  </section>

  <section class="rounded-[1rem] p-4">
    <div class="mb-2 flex items-center justify-between gap-3">
      <p class="text-sm font-semibold text-[color:var(--text)]">Refined text</p>
      {#if correctedText || currentText}
        <p class="text-xs text-[color:var(--muted)]">Source: {correctedText ? 'cleaned' : 'transcript'}</p>
      {/if}
    </div>
    <textarea
      class="min-h-[14rem] w-full rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-3 text-sm leading-6 text-[color:var(--text)] outline-none transition focus:border-[color:var(--page-accent)]"
      aria-label="Refined text"
      placeholder="Refined English text appears here after local cleanup or Llama refinement."
      value={refinedText}
      oninput={(event) => onRefinedInput((event.currentTarget as HTMLTextAreaElement).value)}
    ></textarea>
  </section>

  {#if diffSegments.length > 0}
    <DiffView segments={diffSegments} />
  {/if}
</div>
