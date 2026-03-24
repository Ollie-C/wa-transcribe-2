<script lang="ts">
  import type { ModelState } from '$lib/types';

  let {
    label,
    state,
    onUnload
  }: {
    label: string;
    state: ModelState;
    onUnload?: () => void;
  } = $props();

  const statusTone = $derived.by(() => {
    if (state.status === 'ready') {
      return 'text-[color:var(--success)]';
    }

    if (state.status === 'error') {
      return 'text-[color:var(--danger)]';
    }

    if (state.status === 'loading') {
      return 'text-[color:var(--warning)]';
    }

    return 'text-[color:var(--muted)]';
  });
</script>

<article class="rounded-[1.5rem] border border-[color:var(--line)] bg-white/60 p-4">
  <div class="mb-2 flex items-center justify-between gap-4">
    <div>
      <h3 class="font-semibold text-[color:var(--text)]">{label}</h3>
      <p class="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">{state.device} · {state.profile}</p>
    </div>
    <div class="flex items-center gap-3">
      {#if onUnload}
        <button
          class="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-white/80"
          type="button"
          onclick={onUnload}
        >
          Unload
        </button>
      {/if}
      <p class={['text-sm font-medium capitalize', statusTone]}>{state.status}</p>
    </div>
  </div>

  <p class="mb-3 text-sm leading-6 text-[color:var(--muted)]">{state.message}</p>

  <div class="h-2 overflow-hidden rounded-full bg-[color:var(--line)]">
    <div
      class="h-full rounded-full bg-[color:var(--page-accent)] transition-all duration-300"
      style={`width: ${Math.max(0, (state.progress ?? 0) * 100)}%`}
    ></div>
  </div>
</article>
