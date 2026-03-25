<script lang="ts">
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

<div class="space-y-4">
  <div class="rounded-[1rem] border border-dashed border-[color:var(--line)] bg-[color:var(--surface-soft)] p-4">
    <p class="mb-3 text-sm leading-6 text-[color:var(--muted)]">
      Audio stays on this machine. Upload a WhatsApp voice note or record a quick sample to start.
    </p>

    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <input
        bind:this={fileInput}
        class="hidden"
        aria-label="Upload audio file"
        type="file"
        accept="audio/*,.opus"
        onchange={onFileChange}
      />

      <button
        class="app-text-button"
        type="button"
        aria-label="Upload audio"
        onclick={() => fileInput?.click()}
      >
        Upload
      </button>

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

  <div>
    <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Previous uploads</p>
    {#if recentUploads.length > 0}
      <div class="grid gap-2">
        {#each recentUploads as item}
          <div class="flex items-center justify-between rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--surface-soft)] px-3 py-2">
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
</div>
