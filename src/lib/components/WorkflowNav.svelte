<script lang="ts">
  import type { PipelineStep } from '$lib/types';

  const steps: Array<{ id: PipelineStep; label: string; summary: string }> = [
    { id: 'input', label: 'Input', summary: 'Upload or record audio' },
    { id: 'transcript', label: 'Transcript', summary: 'Generate and edit English text' },
    { id: 'refinement', label: 'Refinement', summary: 'Apply cleanup rules and local Llama refinement' },
    { id: 'translation', label: 'Translation', summary: 'Translate the approved English text to Japanese' }
  ];

  let {
    currentStep
  }: {
    currentStep: PipelineStep;
  } = $props();
</script>

<nav class="grid gap-3 md:grid-cols-4">
  {#each steps as step, index}
    <article
      class={[
        'rounded-[1.5rem] border p-4 transition',
        currentStep === step.id
          ? 'border-[color:var(--page-accent)] bg-[color:var(--panel-strong)] shadow-[0_12px_28px_rgba(20,48,66,0.14)]'
          : 'border-[color:var(--line)] bg-white/55'
      ]}
    >
      <div class="mb-3 flex items-center gap-3">
        <span
          class={[
            'grid size-9 place-items-center rounded-full text-sm font-semibold',
            currentStep === step.id ? 'bg-[color:var(--page-accent)] text-white' : 'bg-[color:var(--line)] text-[color:var(--page-accent)]'
          ]}
        >
          {index + 1}
        </span>
        <h2 class="text-base font-semibold text-[color:var(--text)]">{step.label}</h2>
      </div>

      <p class="text-sm leading-6 text-[color:var(--muted)]">{step.summary}</p>
    </article>
  {/each}
</nav>
