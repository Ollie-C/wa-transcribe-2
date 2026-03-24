import { browser } from '$app/environment';

import { SESSION_STORAGE_KEY, TRANSCRIPT_HISTORY_STORAGE_KEY, UPLOAD_HISTORY_STORAGE_KEY } from '$lib/config';
import type { PersistedSession, PipelineState, TranscriptHistoryItem, UploadHistoryItem } from '$lib/types';

const AUDIO_DB_NAME = 'wa-transcribe-2-db';
const AUDIO_STORE_NAME = 'audio-blobs';

export interface StorageAdapter {
  loadSession(): PersistedSession | null;
  saveSession(state: PipelineState): void;
  clearSession(): void;
  loadUploadHistory(): UploadHistoryItem[];
  saveUploadHistory(items: UploadHistoryItem[]): void;
  loadTranscriptHistory(): TranscriptHistoryItem[];
  saveTranscriptHistory(items: TranscriptHistoryItem[]): void;
  saveAudioBlob(id: string, blob: Blob): Promise<void>;
  loadAudioBlob(id: string): Promise<Blob | null>;
  deleteAudioBlob(id: string): Promise<void>;
}

function safeParse<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function toPersistedSession(state: PipelineState): PersistedSession {
  return {
    step: state.step,
    audioSource: state.audioSource,
    rawTranscript: state.rawTranscript,
    instructionText: state.instructionText,
    correctedTranscript: state.correctedTranscript,
    refinedTranscript: state.refinedTranscript,
    refinedSourceText: state.refinedSourceText,
    translation: state.translation,
    correctionRules: state.correctionRules,
    pendingSuggestions: state.pendingSuggestions,
    refinementDiff: state.refinementDiff,
    exportTarget: state.exportTarget,
    timestamps: state.timestamps
  };
}

function openAudioDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUDIO_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(AUDIO_STORE_NAME)) {
        database.createObjectStore(AUDIO_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });
}

async function withAudioStore<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
  if (!browser) {
    throw new Error('Audio storage is only available in the browser.');
  }

  const database = await openAudioDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(AUDIO_STORE_NAME, mode);
    const store = transaction.objectStore(AUDIO_STORE_NAME);

    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
      database.close();
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
      database.close();
    };

    handler(store, resolve, reject);
  });
}

export function createBrowserStorageAdapter(): StorageAdapter {
  return {
    loadSession() {
      if (!browser) {
        return null;
      }

      return safeParse<PersistedSession>(localStorage.getItem(SESSION_STORAGE_KEY));
    },
    saveSession(state) {
      if (!browser) {
        return;
      }

      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(toPersistedSession(state)));
    },
    clearSession() {
      if (!browser) {
        return;
      }

      localStorage.removeItem(SESSION_STORAGE_KEY);
    },
    loadUploadHistory() {
      if (!browser) {
        return [];
      }

      return safeParse<UploadHistoryItem[]>(localStorage.getItem(UPLOAD_HISTORY_STORAGE_KEY)) ?? [];
    },
    saveUploadHistory(items) {
      if (!browser) {
        return;
      }

      localStorage.setItem(UPLOAD_HISTORY_STORAGE_KEY, JSON.stringify(items));
    },
    loadTranscriptHistory() {
      if (!browser) {
        return [];
      }

      return safeParse<TranscriptHistoryItem[]>(localStorage.getItem(TRANSCRIPT_HISTORY_STORAGE_KEY)) ?? [];
    },
    saveTranscriptHistory(items) {
      if (!browser) {
        return;
      }

      localStorage.setItem(TRANSCRIPT_HISTORY_STORAGE_KEY, JSON.stringify(items));
    },
    async saveAudioBlob(id, blob) {
      await withAudioStore<void>('readwrite', (store, resolve, reject) => {
        const request = store.put(blob, id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error('Failed to save audio blob.'));
      });
    },
    async loadAudioBlob(id) {
      return withAudioStore<Blob | null>('readonly', (store, resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
        request.onerror = () => reject(request.error ?? new Error('Failed to load audio blob.'));
      });
    },
    async deleteAudioBlob(id) {
      await withAudioStore<void>('readwrite', (store, resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error('Failed to delete audio blob.'));
      });
    }
  };
}
