<script lang="ts">
  import { onMount } from 'svelte';

  import AudioInput from '$lib/components/AudioInput.svelte';
  import PanelShell from '$lib/components/PanelShell.svelte';
  import RefinementPanel from '$lib/components/RefinementPanel.svelte';
  import SessionDrawer from '$lib/components/SessionDrawer.svelte';
  import TranscriptModal from '$lib/components/TranscriptModal.svelte';
  import TranscriptPanel from '$lib/components/TranscriptPanel.svelte';
  import TranslationPanel from '$lib/components/TranslationPanel.svelte';
  import { APP_TITLE } from '$lib/config';
  import { pipeline } from '$lib/state/pipeline.svelte';
  import { theme } from '$lib/state/theme.svelte';
  import type { AudioSourceMetadata, ExportTarget, TranscriptHistoryItem } from '$lib/types';
  import { buildMarkdownExport, createFileStem, getExportContent } from '$lib/utils/export';

  const controller = pipeline;
  const pipelineState = controller.state;
  const themeState = theme.settings;
  let copyMessage = $state('');
  let section3Collapsed = $state(true);
  let section4Collapsed = $state(true);
  let drawerExpanded = $state(false);
  let modalOpen = $state(false);
  let modalTitle = $state('');
  let modalBody = $state('');

  onMount(() => {
    controller.hydrate();
    theme.hydrate();
  });

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

  async function copyModal(): Promise<void> {
    if (!modalBody.trim()) {
      return;
    }

    await navigator.clipboard.writeText(modalBody);
    flashMessage('Copied text.');
  }

  function exportTxt(): void {
    const content = getExportContent(pipelineState, pipelineState.exportTarget).trim();
    if (!content) {
      flashMessage('There is nothing to export for the selected target yet.');
      return;
    }

    downloadFile(`${createFileStem(pipelineState.audioSource?.name)}-${pipelineState.exportTarget}.txt`, content, 'text/plain;charset=utf-8');
  }

  function exportMarkdown(): void {
    const content = buildMarkdownExport(pipelineState);
    downloadFile(`${createFileStem(pipelineState.audioSource?.name)}-bundle.md`, content, 'text/markdown;charset=utf-8');
  }

  function selectAudio(file: File | Blob, metadata: AudioSourceMetadata): void {
    controller.setAudioFile(file, metadata);
    section3Collapsed = true;
    section4Collapsed = true;
  }

  function openCurrentTarget(target: ExportTarget): void {
    const content = getExportContent(pipelineState, target).trim();
    if (!content) {
      return;
    }

    controller.setExportTarget(target);
    modalTitle = `${pipelineState.audioSource?.name ?? 'Current session'} · ${target === 'raw' ? 'Transcript' : target === 'refined' ? 'Refined' : 'Translated'}`;
    modalBody = content;
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
    <header class="mb-4 flex items-end justify-between gap-4 border-b border-[color:var(--line)] pb-4">
      <div>
        <h1 class="text-xl font-semibold tracking-tight text-[color:var(--text)]">{APP_TITLE}</h1>
        <p class="text-xs text-[color:var(--muted)]">Upload, transcribe, refine, translate.</p>
      </div>
      <div class="flex max-w-[34rem] flex-col items-end gap-2">
        <button class="app-text-button" type="button" onclick={() => theme.toggleMode()}>
          {themeState.mode === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
        <p class="text-right text-xs text-[color:var(--muted)]">{pipelineState.modelStatus.whisper.message}</p>
      </div>
    </header>

    <div class="space-y-4">
      <PanelShell eyebrow="1" title="Upload" description="Choose a file or record audio.">
        <AudioInput
          audioSource={pipelineState.audioSource}
          recentUploads={pipelineState.uploadHistory}
          transcriptionState={pipelineState.processing.transcription}
          onSelectAudio={selectAudio}
          onReuseUpload={(id) => controller.restoreUpload(id)}
          onCancelTranscription={() => controller.cancelStage('transcription')}
        />
      </PanelShell>

      <PanelShell eyebrow="2" title="Transcribe" description="Transcripts save automatically.">
        <TranscriptPanel
          value={pipelineState.rawTranscript}
          processing={pipelineState.processing.transcription}
          canTranscribe={Boolean(pipelineState.audioSource)}
          onTranscribe={() => {
            void controller.transcribe();
            section3Collapsed = false;
            section4Collapsed = false;
          }}
          onCancel={() => controller.cancelStage('transcription')}
          onInput={(value) => controller.updateRawTranscript(value)}
        />
      </PanelShell>

      <PanelShell
        eyebrow="3"
        title="Refine"
        description={!pipelineState.rawTranscript.trim() ? 'Available after a transcript is generated.' : 'Cleanup rules and local refinement.'}
        collapsible={pipelineState.rawTranscript.trim().length > 0}
        collapsed={!pipelineState.rawTranscript.trim() || section3Collapsed}
        onToggle={() => {
          if (pipelineState.rawTranscript.trim()) {
            section3Collapsed = !section3Collapsed;
          }
        }}
      >
        <RefinementPanel
          instructionText={pipelineState.instructionText}
          currentText={controller.getWorkingEnglishText() || pipelineState.rawTranscript}
          correctedText={pipelineState.correctedTranscript}
          refinedText={pipelineState.refinedTranscript}
          suggestions={pipelineState.pendingSuggestions}
          diffSegments={pipelineState.refinementDiff}
          correctionState={pipelineState.processing.correction}
          refinementState={pipelineState.processing.refinement}
          onInstructionInput={(value) => controller.setInstructionText(value)}
          onApplyCorrections={() => controller.applyCorrections()}
          onToggleSuggestion={(id) => controller.toggleSuggestion(id)}
          onApplySuggestions={() => controller.applyAcceptedSuggestions()}
          onRefine={() => controller.refine()}
          onCancelRefinement={() => controller.cancelStage('refinement')}
          onRefinedInput={(value) => controller.updateRefinedTranscript(value)}
        />
      </PanelShell>

      <PanelShell
        eyebrow="4"
        title="Translate"
        description={!pipelineState.rawTranscript.trim() ? 'Available after a transcript is generated.' : 'Japanese translation from the latest approved English text.'}
        collapsible={pipelineState.rawTranscript.trim().length > 0}
        collapsed={!pipelineState.rawTranscript.trim() || section4Collapsed}
        onToggle={() => {
          if (pipelineState.rawTranscript.trim()) {
            section4Collapsed = !section4Collapsed;
          }
        }}
      >
        <TranslationPanel
          sourceText={pipelineState.refinedTranscript || controller.getWorkingEnglishText()}
          translation={pipelineState.translation}
          processing={pipelineState.processing.translation}
          onTranslate={() => controller.translate()}
          onCancel={() => controller.cancelStage('translation')}
          onInput={(value) => controller.updateTranslation(value)}
        />
      </PanelShell>
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
    onClose={() => (modalOpen = false)}
    onCopy={copyModal}
  />
</div>
