<script lang="ts">
  import type { ExportTarget } from '$lib/types';

  let {
    target,
    onTargetChange,
    onCopy,
    onExportTxt,
    onExportMarkdown,
    onClear
  }: {
    target: ExportTarget;
    onTargetChange: (value: ExportTarget) => void;
    onCopy: () => void;
    onExportTxt: () => void;
    onExportMarkdown: () => void;
    onClear: () => void;
  } = $props();
</script>

<div class="sticky bottom-4 z-20 rounded-[2rem] border border-[color:var(--line-strong)] bg-[color:rgba(255,249,242,0.9)] p-4 shadow-[var(--shadow)] backdrop-blur">
  <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div class="flex flex-col gap-2 md:flex-row md:items-center">
      <label class="text-sm font-semibold text-[color:var(--text)]" for="export-target">Export target</label>
      <select
        id="export-target"
        class="rounded-full border border-[color:var(--line)] bg-white/85 px-4 py-2 text-sm text-[color:var(--text)] outline-none transition focus:border-[color:var(--page-accent)]"
        value={target}
        onchange={(event) => onTargetChange((event.currentTarget as HTMLSelectElement).value as ExportTarget)}
      >
        <option value="raw">Raw transcript</option>
        <option value="refined">Refined transcript</option>
        <option value="translation">Japanese translation</option>
      </select>
    </div>

    <div class="flex flex-wrap gap-3">
      <button class="rounded-full bg-[color:var(--page-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--page-accent-soft)]" type="button" onclick={onCopy}>
        Copy
      </button>
      <button class="rounded-full border border-[color:var(--page-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--page-accent)] transition hover:bg-[color:rgba(20,48,66,0.06)]" type="button" onclick={onExportTxt}>
        Export TXT
      </button>
      <button class="rounded-full border border-[color:var(--page-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--page-accent)] transition hover:bg-[color:rgba(20,48,66,0.06)]" type="button" onclick={onExportMarkdown}>
        Export MD
      </button>
      <button class="rounded-full border border-[color:var(--danger)] px-5 py-3 text-sm font-semibold text-[color:var(--danger)] transition hover:bg-[color:rgba(161,40,68,0.06)]" type="button" onclick={onClear}>
        Clear Session
      </button>
    </div>
  </div>
</div>
