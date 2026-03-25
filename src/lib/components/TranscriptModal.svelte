<script lang="ts">
  import { tick } from 'svelte';

  let {
    open,
    title,
    body,
    onClose,
    onCopy
  }: {
    open: boolean;
    title: string;
    body: string;
    onClose: () => void;
    onCopy: () => void;
  } = $props();

  let closeButton = $state<HTMLButtonElement | null>(null);
  let previousFocusedElement: HTMLElement | null = null;

  $effect(() => {
    if (!open) {
      return;
    }

    previousFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    void tick().then(() => {
      closeButton?.focus();
    });

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      previousFocusedElement?.focus();
      previousFocusedElement = null;
    };
  });
</script>

{#if open}
  <button class="fixed inset-0 z-50 bg-[color:var(--surface-overlay)]" type="button" aria-label="Close transcript modal" onclick={onClose}></button>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transcript-modal-title"
      class="max-h-[82vh] w-full max-w-3xl overflow-hidden rounded-[1.25rem] border border-[color:var(--line)] bg-[color:var(--panel)] shadow-[var(--shadow)]"
    >
      <div class="flex items-center justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
        <h2 id="transcript-modal-title" class="text-sm font-semibold text-[color:var(--text)]">{title}</h2>
        <div class="flex items-center gap-4">
          <button class="app-text-button text-sm" type="button" onclick={onCopy} aria-label="Copy text">
            Copy
          </button>
          <button bind:this={closeButton} class="app-text-button text-sm" type="button" onclick={onClose} aria-label="Close transcript">
            Close
          </button>
        </div>
      </div>

      <div class="max-h-[calc(82vh-3.75rem)] overflow-auto p-4">
        <pre class="whitespace-pre-wrap text-sm leading-7 text-[color:var(--text)]">{body}</pre>
      </div>
    </div>
  </div>
{/if}
