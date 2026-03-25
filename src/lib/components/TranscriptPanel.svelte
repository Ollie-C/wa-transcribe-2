<script lang="ts">
  import type { StageState } from '$lib/types';

  let {
    value,
    processing,
    onInput,
    canTranscribe,
    disabledReason = '',
    onTranscribe,
    onCancel
  }: {
    value: string;
    processing: StageState;
    onInput: (value: string) => void;
    canTranscribe: boolean;
    disabledReason?: string;
    onTranscribe: () => void;
    onCancel: () => void;
  } = $props();
</script>

<div class="space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <button class="app-text-button" type="button" disabled={!canTranscribe || processing.status === 'running'} onclick={onTranscribe}>
        {processing.status === 'running' ? 'Transcribing…' : 'Transcribe'}
      </button>
      {#if processing.status === 'running'}
        <button class="app-text-button text-[color:var(--danger)] hover:text-[color:var(--danger)]" type="button" onclick={onCancel}>
          Cancel
        </button>
      {/if}
      <span class="text-xs text-[color:var(--muted)]">
        {#if !canTranscribe && disabledReason}
          {disabledReason}
        {:else if processing.message}
          {processing.message}
        {:else if value.trim()}
          Transcript ready to review and edit.
        {:else}
          Upload or record audio, then run a local transcription.
        {/if}
      </span>
    </div>
  </div>

  <textarea
    class="min-h-[18rem] w-full rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4 text-sm leading-6 text-[color:var(--text)] outline-none transition focus:border-[color:var(--page-accent)]"
    aria-label="Transcript"
    placeholder="Your English transcript appears here. You can also paste or edit text manually."
    value={value}
    oninput={(event) => onInput((event.currentTarget as HTMLTextAreaElement).value)}
  ></textarea>

  {#if processing.error}
    <p class="text-sm text-[color:var(--danger)]">{processing.error}</p>
  {/if}
</div>
