<script lang="ts">
  import type { SetupStatus } from '$lib/types';

  let {
    status,
    retrying = false,
    onRetry
  }: {
    status: SetupStatus;
    retrying?: boolean;
    onRetry: () => void;
  } = $props();

  const stageItems = $derived.by(() => {
    if (!status.readiness) {
      return [
        {
          label: 'Transcription: Whisper',
          ready: status.canTranscribe,
          detail: status.message
        },
        {
          label: 'Refinement: Ollama',
          ready: status.canUseLlm,
          detail: status.message
        },
        {
          label: 'Translation: Ollama',
          ready: status.canUseLlm,
          detail: status.message
        }
      ];
    }

    return [
      {
        label: 'Transcription: Whisper',
        ready: status.readiness.whisper.ready,
        detail: status.readiness.whisper.detail
      },
      {
        label: 'Refinement: Ollama',
        ready: status.readiness.ollama.ready && status.readiness.llm_model.ready,
        detail: status.readiness.llm_model.ready ? status.readiness.ollama.detail : status.readiness.llm_model.detail
      },
      {
        label: 'Translation: Ollama',
        ready: status.readiness.ollama.ready && status.readiness.llm_model.ready,
        detail: status.readiness.llm_model.ready ? status.readiness.ollama.detail : status.readiness.llm_model.detail
      }
    ];
  });
</script>

<section
  class="rounded-[1rem] px-2 py-0"
  aria-live="polite"
>
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      {#each stageItems as item}
        <div class="flex items-center gap-2 text-[color:var(--text)]" title={item.detail}>
          <span
            class={[
              'inline-flex size-2.5 rounded-full',
              retrying || status.state === 'checking'
                ? 'bg-[color:var(--warning)]'
                : item.ready
                  ? 'bg-[color:var(--success)]'
                  : 'bg-[color:var(--danger)]'
            ]}
            aria-hidden="true"
          ></span>
          <span>{item.label}</span>
        </div>
      {/each}
    </div>

    <button class="app-text-button text-sm" type="button" disabled={retrying} onclick={onRetry}>
      {retrying || status.state === 'checking' ? 'Checking…' : 'Refresh'}
    </button>
  </div>
</section>
