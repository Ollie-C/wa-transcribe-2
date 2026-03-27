<script lang="ts">
  import VolumeMeter from '$lib/components/VolumeMeter.svelte';
  import type { AudioSourceMetadata, StageState } from '$lib/types';

  let {
    audioSource,
    recentUploads,
    transcriptionState,
    onSelectAudio,
    onReuseUpload,
    onCancelTranscription
  }: {
    audioSource: AudioSourceMetadata | null;
    recentUploads: Array<{ id: string; name: string; origin: AudioSourceMetadata['origin']; addedAt: string }>;
    transcriptionState: StageState;
    onSelectAudio: (file: File | Blob, metadata: AudioSourceMetadata) => void;
    onReuseUpload: (id: string) => Promise<void> | void;
    onCancelTranscription: () => void;
  } = $props();

  let restoringId = $state<string | null>(null);
  let uploadsOpen = $state(false);

  let fileInput: HTMLInputElement | null = null;
  let recording = $state(false);
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let recordingError = $state('');

  function onFileChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    onSelectAudio(file, {
      name: file.name,
      origin: 'upload',
      mimeType: file.type || 'audio/webm',
      size: file.size,
      lastModified: file.lastModified
    });
  }

  async function startRecording(): Promise<void> {
    recordingError = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      chunks = [];

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((track) => track.stop());
        const mimeType = recorder?.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        onSelectAudio(blob, {
          name: `recording-${new Date().toISOString()}.webm`,
          origin: 'recording',
          mimeType,
          size: blob.size
        });
      });

      recorder.start();
      recording = true;
    } catch (error) {
      recordingError = error instanceof Error ? error.message : 'Microphone access failed.';
    }
  }

  function stopRecording(): void {
    recorder?.stop();
    recorder = null;
    recording = false;
  }

  async function handleReuseUpload(id: string): Promise<void> {
    restoringId = id;
    recordingError = '';

    try {
      await onReuseUpload(id);
    } catch (error) {
      recordingError = error instanceof Error ? error.message : 'Failed to restore saved audio.';
    } finally {
      restoringId = null;
    }
  }
</script>

<div class="space-y-4 md:h-full md:overflow-y-auto md:pr-1">
  <div class="rounded-[1rem] border border-dashed border-[color:var(--line)] bg-[color:var(--surface-soft)] p-4">
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <input
        bind:this={fileInput}
        class="hidden"
        aria-label="Upload audio file"
        type="file"
        accept="audio/*,.opus"
        onchange={onFileChange}
      />

      <button class="app-icon-button" type="button" aria-label="Upload audio" onclick={() => fileInput?.click()}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4 7.5 8.5l1.4 1.4 2.1-2.1V16h2V7.8l2.1 2.1 1.4-1.4z" fill="currentColor"></path>
          <path d="M5 18h14v2H5z" fill="currentColor"></path>
        </svg>
      </button>

      <span class="text-[color:var(--muted)]" aria-hidden="true">|</span>

      {#if recording}
        <button
          class="app-text-button text-[color:var(--danger)] hover:text-[color:var(--danger)]"
          type="button"
          aria-label="Stop recording"
          onclick={stopRecording}
        >
          Stop
        </button>
      {:else}
        <button
          class="app-text-button"
          type="button"
          aria-label="Record audio"
          onclick={startRecording}
        >
          Record
        </button>
      {/if}

      {#if transcriptionState.status === 'running'}
        <button
          class="app-text-button text-[color:var(--danger)] hover:text-[color:var(--danger)]"
          type="button"
          aria-label="Cancel transcription"
          onclick={onCancelTranscription}
        >
          Cancel transcription
        </button>
      {/if}
    </div>

    <div class="mt-4">
      <VolumeMeter active={recording} />
    </div>

    {#if audioSource}
      <div class="mt-3 rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2">
        <p class="text-sm font-semibold text-[color:var(--text)]">{audioSource.name}</p>
        <p class="mt-1 text-xs text-[color:var(--muted)]">
          {audioSource.origin === 'upload' ? 'Uploaded file' : 'Browser recording'} · {Math.max(1, Math.round(audioSource.size / 1024))} KB
        </p>
      </div>
    {/if}
    {#if recordingError}
      <p class="mt-3 text-sm text-[color:var(--danger)]">{recordingError}</p>
    {/if}
  </div>

  <div class="rounded-[0.9rem]">
    <button
      class="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
      type="button"
      aria-expanded={uploadsOpen}
      onclick={() => (uploadsOpen = !uploadsOpen)}
    >
      <div class="flex items-center gap-2">
        <span class="block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Previous uploads</span>
        <span class="block text-sm text-[color:var(--text)]">
          {recentUploads.length > 0 ? `${recentUploads.length}` : 'No uploads yet'}
        </span>
      </div>
      <span class="text-sm text-[color:var(--muted)]">{uploadsOpen ? 'Hide' : 'Show'}</span>
    </button>

    {#if uploadsOpen}
      <div class="px-3 py-3">
        {#if recentUploads.length > 0}
          <div class="grid gap-2">
            {#each recentUploads as item}
              <div class="flex items-center justify-between rounded-[0.9rem] px-3 py-2">
                <div class="min-w-0">
                  <p class="truncate text-sm text-[color:var(--text)]">{item.name}</p>
                  <p class="text-[11px] text-[color:var(--muted)]">{item.origin === 'upload' ? 'Upload' : 'Recording'} · {new Date(item.addedAt).toLocaleString()}</p>
                </div>
                <button class="app-text-button text-xs" type="button" disabled={restoringId === item.id} onclick={() => handleReuseUpload(item.id)}>
                  {restoringId === item.id ? 'Loading…' : 'Use again'}
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-[color:var(--muted)]">No uploads yet.</p>
        {/if}
      </div>
    {/if}
  </div>
</div>
