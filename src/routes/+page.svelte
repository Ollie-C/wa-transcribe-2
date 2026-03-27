<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Moon, Sun } from 'lucide-svelte';

  import AudioInput from '$lib/components/AudioInput.svelte';
  import DiffView from '$lib/components/DiffView.svelte';
  import PanelShell from '$lib/components/PanelShell.svelte';
  import SessionDrawer from '$lib/components/SessionDrawer.svelte';
  import SetupStatusCard from '$lib/components/SetupStatusCard.svelte';
  import TranscriptModal from '$lib/components/TranscriptModal.svelte';
  import TranscriptPanel from '$lib/components/TranscriptPanel.svelte';
  import { APP_TITLE } from '$lib/config';
  import { createCheckingSetupStatus, loadSetupStatus } from '$lib/services/readiness';
  import { pipeline } from '$lib/state/pipeline.svelte';
  import { theme } from '$lib/state/theme.svelte';
  import type { AudioSourceMetadata, ExportTarget, SetupStatus, TranscriptHistoryItem } from '$lib/types';
  import { buildMarkdownExport, createFileStem, getExportContent } from '$lib/utils/export';

  const controller = pipeline;
  const pipelineState = controller.state;
  const themeState = theme.settings;
  let copyMessage = $state('');
  let drawerExpanded = $state(false);
  let modalOpen = $state(false);
  let modalTitle = $state('');
  let modalBody = $state('');
  let modalTarget = $state<ExportTarget | null>(null);
  let activeWorkspaceTab = $state<'transcript' | 'refined' | 'translation'>('transcript');
  let activeTool = $state<'refine' | 'translate' | null>(null);
  let pendingResultsScroll = $state(false);
  let resultsSection = $state<HTMLElement | null>(null);
  let setupStatus = $state<SetupStatus>(createCheckingSetupStatus());
  let setupStatusLoading = $state(false);
  let setupStatusRequest: AbortController | null = null;

  const hasTranscript = $derived(Boolean(pipelineState.rawTranscript.trim()));
  const hasRefined = $derived(Boolean(pipelineState.refinedTranscript.trim()));
  const hasTranslation = $derived(Boolean(pipelineState.translation.trim()));
  const acceptedSuggestionsCount = $derived(pipelineState.pendingSuggestions.filter((item) => item.accepted).length);

  onMount(() => {
    controller.hydrate();
    theme.hydrate();

    void refreshSetupStatus();

    return () => {
      setupStatusRequest?.abort();
    };
  });

  $effect(() => {
    if (!hasTranscript) {
      activeWorkspaceTab = 'transcript';
      activeTool = null;
      return;
    }

    if (activeWorkspaceTab === 'refined' && !hasRefined && activeTool !== 'refine') {
      activeWorkspaceTab = 'transcript';
    }

    if (activeWorkspaceTab === 'translation' && !hasTranslation && activeTool !== 'translate') {
      activeWorkspaceTab = hasRefined ? 'refined' : 'transcript';
    }
  });

  $effect(() => {
    if (!pendingResultsScroll || pipelineState.processing.transcription.status !== 'success' || !hasTranscript) {
      return;
    }

    void tick().then(() => {
      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      pendingResultsScroll = false;
    });
  });

  function targetLabel(target: ExportTarget): string {
    return target === 'raw' ? 'transcript' : target === 'refined' ? 'refined text' : 'Japanese translation';
  }

  function downloadFile(filename: string, content: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function flashMessage(message: string): void {
    copyMessage = message;
    window.setTimeout(() => {
      copyMessage = '';
    }, 2400);
  }

  async function refreshSetupStatus(): Promise<void> {
    setupStatusRequest?.abort();
    const request = new AbortController();
    setupStatusRequest = request;
    setupStatusLoading = true;
    setupStatus = createCheckingSetupStatus();

    try {
      setupStatus = await loadSetupStatus(request.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setupStatus = {
        ...createCheckingSetupStatus(),
        state: 'backend-offline',
        title: 'Start the local backend first',
        message: error instanceof Error ? error.message : 'The local backend is unavailable.',
        hint: 'Run `pnpm dev:local`, then retry this setup check.',
        checkedAt: new Date().toISOString()
      };
    } finally {
      if (setupStatusRequest === request) {
        setupStatusLoading = false;
      }
    }
  }

  async function copyModal(): Promise<void> {
    if (!modalBody.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(modalBody);
      flashMessage(`Copied ${targetLabel(modalTarget ?? pipelineState.exportTarget)}.`);
    } catch {
      flashMessage('Copy failed. Try selecting the text manually.');
    }
  }

  function exportTxt(): void {
    const content = getExportContent(pipelineState, pipelineState.exportTarget).trim();
    if (!content) {
      flashMessage(`There is nothing to export from ${targetLabel(pipelineState.exportTarget)} yet.`);
      return;
    }

    downloadFile(`${createFileStem(pipelineState.audioSource?.name)}-${pipelineState.exportTarget}.txt`, content, 'text/plain;charset=utf-8');
    flashMessage(`Downloaded ${targetLabel(pipelineState.exportTarget)} as a .txt file.`);
  }

  function exportMarkdown(): void {
    const content = buildMarkdownExport(pipelineState);
    if (!content.trim()) {
      flashMessage('There is nothing to export yet.');
      return;
    }

    downloadFile(`${createFileStem(pipelineState.audioSource?.name)}-bundle.md`, content, 'text/markdown;charset=utf-8');
    flashMessage('Downloaded the full transcript bundle as Markdown.');
  }

  function selectAudio(file: File | Blob, metadata: AudioSourceMetadata): void {
    controller.setAudioFile(file, metadata);
    activeWorkspaceTab = 'transcript';
    activeTool = null;
    pendingResultsScroll = false;
  }

  function openRefineWorkspace(): void {
    activeTool = 'refine';
    activeWorkspaceTab = 'refined';
  }

  function openTranslateWorkspace(): void {
    activeTool = 'translate';
  }

  function openCurrentTarget(target: ExportTarget): void {
    const content = getExportContent(pipelineState, target).trim();
    if (!content) {
      return;
    }

    controller.setExportTarget(target);
    modalTitle = `${pipelineState.audioSource?.name ?? 'Current session'} · ${target === 'raw' ? 'Transcript' : target === 'refined' ? 'Refined' : 'Translated'}`;
    modalBody = content;
    modalTarget = target;
    modalOpen = true;
  }

  function openHistoryTarget(item: TranscriptHistoryItem, target: ExportTarget): void {
    const content =
      target === 'translation' ? item.translation : target === 'refined' ? item.refinedTranscript : item.rawTranscript;

    if (!content.trim()) {
      return;
    }

    modalTitle = `${item.title} · ${target === 'raw' ? 'Transcript' : target === 'refined' ? 'Refined' : 'Translated'}`;
    modalBody = content;
    modalTarget = target;
    modalOpen = true;
  }
</script>

<svelte:head>
  <title>{APP_TITLE}</title>
  <meta
    name="description"
    content="Local Whisper transcription, transcript cleanup, local Llama refinement, and English-to-Japanese translation in a compact SvelteKit workflow."
  />
</svelte:head>

<div class="grain min-h-screen">
  <div class="mx-auto max-w-[62rem] px-4 pb-32 pt-4 sm:px-6">
    <header class="mb-5 flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="max-w-2xl">
        <h1 class="text-2xl font-semibold tracking-tight text-[color:var(--text)]">{APP_TITLE}</h1>
      </div>
      <div class="flex max-w-[34rem] flex-col items-start gap-2 lg:items-end">
        <button class="app-icon-button" type="button" aria-label={themeState.mode === 'light' ? 'Enable dark mode' : 'Enable light mode'} onclick={() => theme.toggleMode()}>
          {#if themeState.mode === 'light'}
            <Moon aria-hidden="true" />
          {:else}
            <Sun aria-hidden="true" />
          {/if}
        </button>
      </div>
    </header>

    <div class="space-y-4">
      <SetupStatusCard status={setupStatus} retrying={setupStatusLoading} onRetry={refreshSetupStatus} />

      <div class="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:items-start">
        <PanelShell eyebrow="1" title="Upload" className="md:h-[31rem]" description="">
          <AudioInput
            audioSource={pipelineState.audioSource}
            recentUploads={pipelineState.uploadHistory}
            transcriptionState={pipelineState.processing.transcription}
            onSelectAudio={selectAudio}
            onReuseUpload={(id) => controller.restoreUpload(id)}
            onCancelTranscription={() => controller.cancelStage('transcription')}
          />
        </PanelShell>

        <PanelShell
          eyebrow="2"
          title="Transcribe"
          className="md:h-[31rem]"
          description=""
        >
          <TranscriptPanel
            value={pipelineState.rawTranscript}
            processing={pipelineState.processing.transcription}
            hasAudio={Boolean(pipelineState.audioSource)}
            canTranscribe={Boolean(pipelineState.audioSource) && setupStatus.canTranscribe}
            disabledReason={!setupStatus.canTranscribe ? setupStatus.message : ''}
            onTranscribe={() => {
              void controller.transcribe();
              activeTool = null;
              pendingResultsScroll = true;
            }}
            onCancel={() => controller.cancelStage('transcription')}
          />
        </PanelShell>
      </div>

      {#if hasTranscript}
        <section bind:this={resultsSection} class="app-panel relative overflow-hidden rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
          <div class="mb-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">3</p>
            <h2 class="text-xl font-extrabold text-[color:var(--text)] sm:text-2xl">Modify</h2>
          </div>

          <div class="mt-12 grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
            <div class="space-y-4">
              <div class="flex flex-wrap items-center gap-2 border-b border-[color:var(--line)] pb-3">
                <button
                  class={activeWorkspaceTab === 'transcript' ? 'app-primary-button !px-3 !py-1.5 !text-sm' : 'app-pill'}
                  type="button"
                  onclick={() => (activeWorkspaceTab = 'transcript')}
                >
                  Transcription
                </button>

                {#if hasRefined || activeTool === 'refine'}
                  <button
                    class={activeWorkspaceTab === 'refined' ? 'app-primary-button !px-3 !py-1.5 !text-sm' : 'app-pill'}
                    type="button"
                    onclick={() => (activeWorkspaceTab = 'refined')}
                  >
                    Refined
                  </button>
                {/if}

                {#if hasTranslation || activeTool === 'translate'}
                  <button
                    class={activeWorkspaceTab === 'translation' ? 'app-primary-button !px-3 !py-1.5 !text-sm' : 'app-pill'}
                    type="button"
                    onclick={() => (activeWorkspaceTab = 'translation')}
                  >
                    Translation
                  </button>
                {/if}
              </div>

              <textarea
                class="min-h-[18rem] w-full rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4 text-sm leading-6 text-[color:var(--text)] outline-none transition focus:border-[color:var(--page-accent)]"
                aria-label={
                  activeWorkspaceTab === 'translation'
                    ? 'Japanese translation'
                    : activeWorkspaceTab === 'refined'
                      ? 'Refined text'
                      : 'Transcript'
                }
                placeholder={
                  activeWorkspaceTab === 'translation'
                    ? 'Japanese output appears here after translation.'
                    : activeWorkspaceTab === 'refined'
                      ? 'Refined English text appears here after local cleanup or Llama refinement.'
                      : 'Your English transcript appears here.'
                }
                value={
                  activeWorkspaceTab === 'translation'
                    ? pipelineState.translation
                    : activeWorkspaceTab === 'refined'
                      ? pipelineState.refinedTranscript
                      : pipelineState.rawTranscript
                }
                oninput={(event) => {
                  const nextValue = (event.currentTarget as HTMLTextAreaElement).value;

                  if (activeWorkspaceTab === 'translation') {
                    controller.updateTranslation(nextValue);
                  } else if (activeWorkspaceTab === 'refined') {
                    controller.updateRefinedTranscript(nextValue);
                  } else {
                    controller.updateRawTranscript(nextValue);
                  }
                }}
              ></textarea>

              {#if activeTool === 'refine' || pipelineState.refinementDiff.length > 0}
                <DiffView segments={pipelineState.refinementDiff} />
              {/if}
            </div>

            <div class="space-y-3">
              <div class="grid gap-2">
                <button class="app-primary-button w-full" type="button" onclick={openRefineWorkspace}>
                  Refine
                </button>
                <button class="app-primary-button w-full" type="button" onclick={openTranslateWorkspace}>
                  Translate
                </button>
              </div>

              {#if activeTool === 'refine'}
                <section class="rounded-[1rem] p-4">
                  <p class="mb-3 text-sm font-semibold text-[color:var(--text)]">Refine options</p>

                  <div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
                    <button
                      class="app-text-button"
                      type="button"
                      disabled={!controller.getWorkingEnglishText().trim() || pipelineState.processing.correction.status === 'running'}
                      onclick={() => controller.applyCorrections()}
                    >
                      Apply rules
                    </button>

                    <button
                      class="app-text-button"
                      type="button"
                      disabled={!controller.getWorkingEnglishText().trim() || pipelineState.processing.refinement.status === 'running' || !setupStatus.canUseLlm}
                      onclick={() => controller.refine()}
                    >
                      {pipelineState.processing.refinement.status === 'running' ? 'Refining…' : 'Run refine'}
                    </button>

                    {#if pipelineState.processing.refinement.status === 'running'}
                      <button class="app-text-button text-[color:var(--danger)] hover:text-[color:var(--danger)]" type="button" onclick={() => controller.cancelStage('refinement')}>
                        Cancel
                      </button>
                    {/if}
                  </div>

                  <textarea
                    class="min-h-[9rem] w-full rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-3 text-sm leading-6 text-[color:var(--text)] outline-none transition focus:border-[color:var(--page-accent)]"
                    aria-label="Refinement instructions"
                    placeholder={"One instruction per line\nremove repetition\nKommy -> Gomi\nKomi ~> Gomi"}
                    value={pipelineState.instructionText}
                    oninput={(event) => controller.setInstructionText((event.currentTarget as HTMLTextAreaElement).value)}
                  ></textarea>


                  {#if pipelineState.pendingSuggestions.length > 0}
                    <div class="mt-3 space-y-2 rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3">
                      <div class="flex items-center justify-between gap-3">
                        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Review fuzzy matches</p>
                        <button
                          class="app-text-button text-xs"
                          type="button"
                          disabled={acceptedSuggestionsCount === 0}
                          onclick={() => controller.applyAcceptedSuggestions()}
                        >
                          Apply {acceptedSuggestionsCount}
                        </button>
                      </div>

                      {#each pipelineState.pendingSuggestions as suggestion}
                        <label class="flex items-center justify-between gap-3 rounded-[0.75rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-2">
                          <div class="min-w-0">
                            <p class="truncate text-sm text-[color:var(--text)]">{suggestion.candidate} -> {suggestion.replacement}</p>
                            <p class="text-[11px] text-[color:var(--muted)]">{Math.round((1 - suggestion.score) * 100)}% match</p>
                          </div>
                          <input
                            class="size-4 accent-[color:var(--page-accent)]"
                            type="checkbox"
                            checked={suggestion.accepted}
                            onchange={() => controller.toggleSuggestion(suggestion.id)}
                          />
                        </label>
                      {/each}
                    </div>
                  {/if}
                </section>
              {/if}

              {#if activeTool === 'translate'}
                <section class="rounded-[1rem] p-4">
                  <p class="mb-3 text-sm font-semibold text-[color:var(--text)]">Translate options</p>

                  <div class="flex flex-wrap items-center gap-3 text-sm">
                    <button
                      class="app-text-button"
                      type="button"
                      disabled={!controller.getWorkingEnglishText().trim() || pipelineState.processing.translation.status === 'running' || !setupStatus.canUseLlm}
                      onclick={() => {
                        activeWorkspaceTab = 'translation';
                        void controller.translate(controller.getWorkingEnglishText());
                      }}
                    >
                      {pipelineState.processing.translation.status === 'running' ? 'Translating…' : 'Translate original'}
                    </button>

                    <button
                      class="app-text-button"
                      type="button"
                      disabled={!pipelineState.refinedTranscript.trim() || pipelineState.processing.translation.status === 'running' || !setupStatus.canUseLlm}
                      onclick={() => {
                        activeWorkspaceTab = 'translation';
                        void controller.translate(pipelineState.refinedTranscript);
                      }}
                    >
                      Translate refined
                    </button>

                    {#if pipelineState.processing.translation.status === 'running'}
                      <button class="app-text-button text-[color:var(--danger)] hover:text-[color:var(--danger)]" type="button" onclick={() => controller.cancelStage('translation')}>
                        Cancel
                      </button>
                    {/if}
                  </div>

                </section>
              {/if}
            </div>
          </div>
        </section>
      {/if}
    </div>

    {#if copyMessage}
      <div class="pointer-events-none fixed right-6 top-6 z-30 rounded-full bg-[color:var(--page-accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg">
        {copyMessage}
      </div>
    {/if}
  </div>

  <div class="pointer-events-none fixed inset-x-0 bottom-0 z-10 px-4 pb-4 sm:px-6">
    <div class="mx-auto max-w-[62rem] pointer-events-auto">
      <SessionDrawer
        currentTitle={pipelineState.audioSource?.name ?? 'Current session'}
        currentTarget={pipelineState.exportTarget}
        currentHasRefined={Boolean(pipelineState.refinedTranscript.trim())}
        currentHasTranslation={Boolean(pipelineState.translation.trim())}
        previousItems={pipelineState.transcriptHistory.filter((item) => item.id !== pipelineState.currentSessionId)}
        expanded={drawerExpanded}
        onToggleExpanded={() => (drawerExpanded = !drawerExpanded)}
        onOpenTarget={openCurrentTarget}
        onExportTxt={exportTxt}
        onExportMarkdown={exportMarkdown}
        onClear={() => controller.clearSession()}
        onOpenHistory={openHistoryTarget}
      />
    </div>
  </div>

  <TranscriptModal
    open={modalOpen}
    title={modalTitle}
    body={modalBody}
    onClose={() => {
      modalOpen = false;
      modalTarget = null;
    }}
    onCopy={copyModal}
  />
</div>
