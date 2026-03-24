<script lang="ts">
  import type { DiffSegment } from '$lib/types';

  let {
    segments
  }: {
    segments: DiffSegment[];
  } = $props();
</script>

<div class="rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--surface-soft)] p-4">
  <p class="mb-3 text-sm font-semibold text-[color:var(--text)]">Diff</p>

  {#if segments.length === 0}
    <p class="text-xs leading-6 text-[color:var(--muted)]">Run refinement to compare changes.</p>
  {:else}
    <div class="text-sm leading-7 text-[color:var(--text)]">
      {#each segments as segment}
        <span
          class={[
            segment.type === 'insert' && 'rounded-md bg-emerald-100/80 px-1 text-emerald-900',
            segment.type === 'delete' && 'rounded-md bg-rose-100/80 px-1 text-rose-900 line-through',
            segment.type === 'equal' && ''
          ]}
        >
          {segment.text}
        </span>
      {/each}
    </div>
  {/if}
</div>
