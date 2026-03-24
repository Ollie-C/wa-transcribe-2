<script lang="ts">
  import type { StageState } from '$lib/types';

  let {
    sourceText,
    translation,
    processing,
    onTranslate,
    onCancel,
    onInput
  }: {
    sourceText: string;
    translation: string;
    processing: StageState;
    onTranslate: () => void;
    onCancel: () => void;
    onInput: (value: string) => void;
  } = $props();
</script>

<div class="space-y-4">
  <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
    <button class="app-text-button" type="button" disabled={!sourceText.trim() || processing.status === 'running'} onclick={onTranslate}>
      {processing.status === 'running' ? 'Translating…' : 'Translate'}
    </button>
    {#if processing.status === 'running'}
      <button class="app-text-button text-[color:var(--danger)] hover:text-[color:var(--danger)]" type="button" onclick={onCancel}>
        Cancel
      </button>
    {/if}
    <span class="text-xs text-[color:var(--muted)]">{processing.message || 'Ready'}</span>
  </div>

  <textarea
    class="min-h-[18rem] w-full rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4 text-sm leading-6 text-[color:var(--text)] outline-none transition focus:border-[color:var(--page-accent)]"
    placeholder="Japanese output appears here after translation."
    value={translation}
    oninput={(event) => onInput((event.currentTarget as HTMLTextAreaElement).value)}
  ></textarea>
</div>
