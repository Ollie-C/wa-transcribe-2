<script lang="ts">
  import type { ExportTarget, TranscriptHistoryItem } from '$lib/types';

  let {
    currentTitle,
    currentTarget,
    currentHasRefined,
    currentHasTranslation,
    previousItems,
    expanded,
    onToggleExpanded,
    onOpenTarget,
    onExportTxt,
    onExportMarkdown,
    onClear,
    onOpenHistory
  }: {
    currentTitle: string;
    currentTarget: ExportTarget;
    currentHasRefined: boolean;
    currentHasTranslation: boolean;
    previousItems: TranscriptHistoryItem[];
    expanded: boolean;
    onToggleExpanded: () => void;
    onOpenTarget: (target: ExportTarget) => void;
    onExportTxt: () => void;
    onExportMarkdown: () => void;
    onClear: () => void;
    onOpenHistory: (item: TranscriptHistoryItem, target: ExportTarget) => void;
  } = $props();

  function availableTarget(item: TranscriptHistoryItem): ExportTarget {
    if (item.translation.trim()) {
      return 'translation';
    }

    if (item.refinedTranscript.trim()) {
      return 'refined';
    }

    return 'raw';
  }
</script>

<div class="rounded-[1.1rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-3 shadow-[var(--shadow)] backdrop-blur">
  <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div class="min-w-0">
      <button class="truncate text-left text-sm font-semibold text-[color:var(--text)] transition hover:text-[color:var(--page-accent-soft)]" type="button" onclick={() => onOpenTarget(currentTarget)}>
        {currentTitle}
      </button>
      <div class="mt-1 flex flex-wrap items-center gap-2">
        <button class="app-pill" type="button" onclick={() => onOpenTarget('raw')}>Transcript</button>
        {#if currentHasRefined}
          <button class="app-pill" type="button" onclick={() => onOpenTarget('refined')}>Refined</button>
        {/if}
        {#if currentHasTranslation}
          <button class="app-pill" type="button" onclick={() => onOpenTarget('translation')}>Translated</button>
        {/if}
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <button class="app-text-button" type="button" onclick={onExportTxt}>Export txt</button>
      <button class="app-text-button" type="button" onclick={onExportMarkdown}>Export md</button>
      <button class="app-text-button text-[color:var(--danger)] hover:text-[color:var(--danger)]" type="button" onclick={onClear}>Clear</button>
      <button class="app-text-button" type="button" onclick={onToggleExpanded}>
        {expanded ? 'Hide previous' : `Previous (${previousItems.length})`}
      </button>
    </div>
  </div>

  {#if expanded && previousItems.length > 0}
    <div class="mt-3 grid gap-2 border-t border-[color:var(--line)] pt-3">
      {#each previousItems as item}
        <div class="flex flex-col gap-2 rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--surface-soft)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <button class="truncate text-left text-sm font-medium text-[color:var(--text)] transition hover:text-[color:var(--page-accent-soft)]" type="button" onclick={() => onOpenHistory(item, availableTarget(item))}>
              {item.title}
            </button>
            <p class="text-[11px] text-[color:var(--muted)]">{new Date(item.updatedAt).toLocaleString()}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="app-pill" type="button" onclick={() => onOpenHistory(item, 'raw')}>Transcript</button>
            {#if item.refinedTranscript.trim()}
              <button class="app-pill" type="button" onclick={() => onOpenHistory(item, 'refined')}>Refined</button>
            {/if}
            {#if item.translation.trim()}
              <button class="app-pill" type="button" onclick={() => onOpenHistory(item, 'translation')}>Translated</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
