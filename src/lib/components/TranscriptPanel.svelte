<script lang="ts">
  import CassetteVisual from '$lib/components/CassetteVisual.svelte';
  import type { StageState } from '$lib/types';

  let {
    value,
    processing,
    hasAudio,
    canTranscribe,
    disabledReason = '',
    onTranscribe,
    onCancel
  }: {
    value: string;
    processing: StageState;
    hasAudio: boolean;
    canTranscribe: boolean;
    disabledReason?: string;
    onTranscribe: () => void;
    onCancel: () => void;
  } = $props();
</script>

<div class="space-y-4 md:flex md:h-full md:flex-col md:justify-center">
  <div class="relative flex justify-center pb-7">
    <CassetteVisual
      {hasAudio}
      isRecording={false}
      isTranscribing={processing.status === 'running'}
    />

    <button
      class="app-primary-button absolute bottom-10 left-1/2 -translate-x-1/2"
      type="button"
      disabled={!canTranscribe || processing.status === 'running'}
      onclick={onTranscribe}
    >
      {processing.status === 'running' ? 'Transcribing…' : 'Transcribe'}
    </button>
  </div>

  <div class="flex flex-col items-center gap-2 text-center">
    <div class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
      {#if processing.status === 'running'}
        <button class="app-text-button text-[color:var(--danger)] hover:text-[color:var(--danger)]" type="button" onclick={onCancel}>
          Cancel
        </button>
      {/if}
    </div>
    <p class="text-center text-xs text-[color:var(--muted)]">
      {#if !canTranscribe && disabledReason}
        {disabledReason}
      {:else if processing.message}
        {processing.message}
      {:else if value.trim()}
        Transcript ready to review and edit.
      {:else}
        Upload or record audio, then run a local transcription.
      {/if}
    </p>
  </div>

  {#if processing.error}
    <p class="text-sm text-[color:var(--danger)]">{processing.error}</p>
  {/if}
</div>
