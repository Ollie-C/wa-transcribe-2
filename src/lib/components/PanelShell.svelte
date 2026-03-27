<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    eyebrow,
    title,
    description,
    className = '',
    disabled = false,
    collapsed = false,
    collapsible = false,
    onToggle,
    children
  }: {
    eyebrow: string;
    title: string;
    description?: string;
    className?: string;
    disabled?: boolean;
    collapsed?: boolean;
    collapsible?: boolean;
    onToggle?: () => void;
    children?: Snippet;
  } = $props();
</script>

<section
  class={[
    'app-panel relative flex flex-col overflow-hidden rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-4 transition',
    disabled ? 'opacity-65' : 'opacity-100',
    className
  ]}
>
  <header class="flex items-baseline justify-between gap-3">
    <div class="min-w-0">
      <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">{eyebrow}</p>
      <h2 class="truncate text-xl font-extrabold text-[color:var(--text)] sm:text-2xl">{title}</h2>
    </div>
    {#if collapsible}
      <button class="app-text-button text-sm" type="button" onclick={onToggle}>
        {collapsed ? 'Open' : 'Close'}
      </button>
    {/if}
  </header>

  {#if description}
    <p class="mt-1 text-xs leading-5 text-[color:var(--muted)]">{description}</p>
  {/if}

  {#if !collapsed}
    <div class="mt-4 min-h-0 flex-1 space-y-4">
      {@render children?.()}
    </div>
  {/if}
</section>
