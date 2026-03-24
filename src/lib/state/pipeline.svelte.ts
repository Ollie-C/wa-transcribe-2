import { browser } from '$app/environment';

import { applyAcceptedSuggestions, applyCorrections, parseInstructionText } from '$lib/services/context-fixer';
import { refineTranscript } from '$lib/services/refiner';
import { createBrowserStorageAdapter } from '$lib/services/storage';
import { getTranscriberRuntimeProfile, releaseTranscriber, transcribeAudio } from '$lib/services/transcriber';
import { getTranslatorRuntimeProfile, releaseTranslator, translateTranscript } from '$lib/services/translator';
import type {
  AsyncStage,
  AudioSourceMetadata,
  CorrectionMode,
  CorrectionRule,
  CorrectionSuggestion,
  ExportTarget,
  ModelKey,
  PipelineState,
  StageState
} from '$lib/types';
import { buildDiff } from '$lib/utils/diff';
import { resolveDefaultExportTarget } from '$lib/utils/export';

function createStageState(): StageState {
  return {
    status: 'idle',
    message: '',
    error: null,
    progress: null
  };
}

function createInitialState(): PipelineState {
  return {
    hydrated: false,
    step: 'input',
    currentSessionId: null,
    audioSource: null,
    rawTranscript: '',
    instructionText: '',
    correctedTranscript: '',
    refinedTranscript: '',
    refinedSourceText: '',
    translation: '',
    correctionRules: [],
    pendingSuggestions: [],
    refinementDiff: [],
    exportTarget: 'raw',
    uploadHistory: [],
    transcriptHistory: [],
    modelStatus: {
      whisper: {
        status: 'idle',
        progress: null,
        message: 'Uses your local Whisper backend when you transcribe.',
        device: 'unknown',
        profile: 'FastAPI / faster-whisper'
      },
      marian: {
        status: 'idle',
        progress: null,
        message: 'Uses your local backend when you translate.',
        device: 'unknown',
        profile: 'API / Llama 3.1'
      }
    },
    processing: {
      transcription: createStageState(),
      correction: createStageState(),
      refinement: createStageState(),
      translation: createStageState()
    },
    timestamps: {
      transcribedAt: null,
      correctedAt: null,
      refinedAt: null,
      translatedAt: null
    }
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function abortError(stage: string): DOMException {
  return new DOMException(`${stage} cancelled.`, 'AbortError');
}

type PipelineDependencies = {
  transcribeAudio: typeof transcribeAudio;
  applyCorrections: typeof applyCorrections;
  applyAcceptedSuggestions: typeof applyAcceptedSuggestions;
  refineTranscript: typeof refineTranscript;
  translateTranscript: typeof translateTranscript;
  buildDiff: typeof buildDiff;
  storage: ReturnType<typeof createBrowserStorageAdapter>;
  releaseTranscriber: typeof releaseTranscriber;
  releaseTranslator: typeof releaseTranslator;
  getTranscriberRuntimeProfile: typeof getTranscriberRuntimeProfile;
  getTranslatorRuntimeProfile: typeof getTranslatorRuntimeProfile;
};

export class PipelineController {
  state = $state<PipelineState>(createInitialState());

  #runtimeAudioFile: File | Blob | null = null;
  #controllers = new Map<AsyncStage, AbortController>();
  #runIds: Record<AsyncStage, number> = {
    transcription: 0,
    correction: 0,
    refinement: 0,
    translation: 0
  };
  #dependencies: PipelineDependencies;

  constructor(dependencies?: Partial<PipelineDependencies>) {
    this.#dependencies = {
      transcribeAudio,
      applyCorrections,
      applyAcceptedSuggestions,
      refineTranscript,
      translateTranscript,
      buildDiff,
      storage: createBrowserStorageAdapter(),
      releaseTranscriber,
      releaseTranslator,
      getTranscriberRuntimeProfile,
      getTranslatorRuntimeProfile,
      ...dependencies
    };
  }

  hydrate(): void {
    if (!browser || this.state.hydrated) {
      return;
    }

    const session = this.#dependencies.storage.loadSession();
    const uploadHistory = this.#dependencies.storage.loadUploadHistory();
    const transcriptHistory = this.#dependencies.storage.loadTranscriptHistory();

    if (session) {
      Object.assign(this.state, createInitialState(), session);
    }

    this.state.uploadHistory = uploadHistory;
    this.state.transcriptHistory = transcriptHistory;
    this.state.hydrated = true;
    this.state.exportTarget = resolveDefaultExportTarget(this.state);
    if (this.state.rawTranscript.trim() || this.state.refinedTranscript.trim() || this.state.translation.trim()) {
      this.state.currentSessionId ||= crypto.randomUUID();
      this.#syncCurrentTranscriptHistory();
    }
    this.#persist();
  }

  setAudioFile(file: File | Blob, metadata: AudioSourceMetadata): void {
    this.#runtimeAudioFile = file;
    this.state.currentSessionId = crypto.randomUUID();
    this.state.audioSource = metadata;
    this.state.step = 'transcript';
    this.state.processing.transcription = createStageState();
    this.state.processing.transcription.message = `Ready to transcribe ${metadata.name}`;
    void this.#pushUploadHistory(file, metadata);
    this.resetDownstream('transcript');
    this.#persist();
  }

  async restoreUpload(id: string): Promise<void> {
    const item = this.state.uploadHistory.find((entry) => entry.id === id);
    if (!item) {
      this.#setStageError('transcription', 'That saved audio item is no longer available.');
      return;
    }

    try {
      const blob = await this.#dependencies.storage.loadAudioBlob(id);
      if (!blob) {
        this.#setStageError('transcription', 'The saved audio blob could not be found. Please upload the file again.');
        return;
      }

      this.#runtimeAudioFile = blob;
      this.state.currentSessionId = crypto.randomUUID();
      this.state.audioSource = {
        name: item.name,
        origin: item.origin,
        mimeType: item.mimeType,
        size: item.size,
        lastModified: item.lastModified
      };
      this.state.step = 'transcript';
      this.state.processing.transcription = createStageState();
      this.state.processing.transcription.message = `Ready to transcribe ${item.name}`;
      this.resetDownstream('transcript');
      this.#persist();
    } catch (error) {
      this.#setStageError('transcription', this.#toErrorMessage(error));
    }
  }

  updateRawTranscript(value: string): void {
    if (value.trim() && !this.state.currentSessionId) {
      this.state.currentSessionId = crypto.randomUUID();
    }
    this.state.rawTranscript = value;
    this.state.step = value.trim() ? 'transcript' : 'input';
    this.resetDownstream('transcript');
    this.#syncExportTarget();
    this.#syncCurrentTranscriptHistory();
    this.#persist();
  }

  updateCorrectedTranscript(value: string): void {
    this.state.correctedTranscript = value;
    this.state.timestamps.correctedAt = value.trim() ? nowIso() : null;
    this.resetDownstream('refinement');
    this.#syncExportTarget();
    this.#syncCurrentTranscriptHistory();
    this.#persist();
  }

  updateRefinedTranscript(value: string): void {
    this.state.refinedTranscript = value;
    this.state.refinementDiff = this.#dependencies.buildDiff(this.state.refinedSourceText || this.getWorkingEnglishText(), value);
    this.state.timestamps.refinedAt = value.trim() ? nowIso() : null;
    this.resetDownstream('translation');
    this.#syncExportTarget();
    this.#syncCurrentTranscriptHistory();
    this.#persist();
  }

  updateTranslation(value: string): void {
    this.state.translation = value;
    this.state.timestamps.translatedAt = value.trim() ? nowIso() : null;
    this.#syncExportTarget();
    this.#syncCurrentTranscriptHistory();
    this.#persist();
  }

  setExportTarget(value: ExportTarget): void {
    this.state.exportTarget = value;
    this.#persist();
  }

  setInstructionText(value: string): void {
    this.state.instructionText = value;
    this.state.correctionRules = parseInstructionText(value);
    this.state.pendingSuggestions = [];
    this.state.processing.correction = createStageState();
    this.state.correctedTranscript = '';
    this.resetDownstream('refinement');
    this.#syncExportTarget();
    this.#persist();
  }

  addCorrectionRule(): void {
    this.state.correctionRules.push({
      id: crypto.randomUUID(),
      heard: '',
      correct: '',
      mode: 'exact',
      createdAt: nowIso(),
      lastAppliedAt: null,
      lastReplacementCount: 0
    });
    this.#persist();
  }

  updateCorrectionRule(id: string, patch: Partial<Pick<CorrectionRule, 'heard' | 'correct' | 'mode'>>): void {
    const rule = this.state.correctionRules.find((item) => item.id === id);
    if (!rule) {
      return;
    }

    Object.assign(rule, patch);
    this.state.pendingSuggestions = [];
    this.state.processing.correction = createStageState();
    this.#persist();
  }

  removeCorrectionRule(id: string): void {
    this.state.correctionRules = this.state.correctionRules.filter((item) => item.id !== id);
    this.state.pendingSuggestions = this.state.pendingSuggestions.filter((item) => item.ruleId !== id);
    this.#persist();
  }

  toggleSuggestion(id: string): void {
    const suggestion = this.state.pendingSuggestions.find((item) => item.id === id);
    if (!suggestion) {
      return;
    }

    suggestion.accepted = !suggestion.accepted;
    this.#persist();
  }

  applyAcceptedSuggestions(): void {
    const accepted = this.state.pendingSuggestions.filter((item) => item.accepted);
    if (!accepted.length) {
      return;
    }

    const base = this.state.correctedTranscript || this.state.rawTranscript;
    const result = this.#dependencies.applyAcceptedSuggestions(base, accepted);
    this.state.correctedTranscript = result.text;
    this.state.pendingSuggestions = [];
    this.state.processing.correction = {
      status: 'success',
      message: `Applied ${result.replacements.reduce((sum, item) => sum + item.count, 0)} fuzzy replacements.`,
      error: null,
      progress: 1
    };
    this.state.timestamps.correctedAt = nowIso();
    this.state.step = 'refinement';
    this.resetDownstream('refinement');
    this.#syncExportTarget();
    this.#persist();
  }

  cancelStage(stage: AsyncStage): void {
    const controller = this.#controllers.get(stage);
    controller?.abort(abortError(stage));
    this.#controllers.delete(stage);
    this.state.processing[stage].status = 'idle';
    this.state.processing[stage].message = `${stage} cancelled.`;
    this.state.processing[stage].progress = null;
    this.state.processing[stage].error = null;
    this.#persist();
  }

  clearSession(): void {
    for (const stage of Object.keys(this.#runIds) as AsyncStage[]) {
      this.cancelStage(stage);
    }

    Object.assign(this.state, createInitialState());
    this.state.hydrated = true;
    this.state.uploadHistory = this.#dependencies.storage.loadUploadHistory();
    this.state.transcriptHistory = this.#dependencies.storage.loadTranscriptHistory();
    this.#runtimeAudioFile = null;
    this.#dependencies.storage.clearSession();
    void this.unloadModels();
  }

  async unloadModels(): Promise<void> {
    await Promise.all([this.#dependencies.releaseTranscriber(), this.#dependencies.releaseTranslator()]);
    this.#resetModelStatus('whisper');
    this.#resetModelStatus('marian');
  }

  async unloadModel(model: ModelKey): Promise<void> {
    if (model === 'whisper') {
      await this.#dependencies.releaseTranscriber();
    } else {
      await this.#dependencies.releaseTranslator();
    }

    this.#resetModelStatus(model);
  }

  async transcribe(): Promise<void> {
    if (!this.#runtimeAudioFile) {
      this.#setStageError('transcription', 'Select or record an audio file before transcribing.');
      return;
    }

    const { runId, signal } = this.#beginStage('transcription', 'Sending audio to local Whisper backend…');
    this.state.modelStatus.whisper.status = 'loading';
    this.state.modelStatus.whisper.message = 'Preparing local transcription request…';
    this.state.modelStatus.whisper.device = 'unknown';
    this.state.modelStatus.whisper.profile = this.#dependencies.getTranscriberRuntimeProfile();

    try {
      const result = await this.#dependencies.transcribeAudio(this.#runtimeAudioFile, signal, {
        onModelProgress: (update) => {
          this.state.modelStatus.whisper.status = update.progress === 1 ? 'ready' : 'loading';
          this.state.modelStatus.whisper.progress = update.progress;
          this.state.modelStatus.whisper.message = update.message;
        }
      });

      if (!this.#isCurrentRun('transcription', runId)) {
        return;
      }

      this.state.rawTranscript = result.text;
      this.state.step = result.text.trim() ? 'refinement' : 'transcript';
      this.state.timestamps.transcribedAt = nowIso();
      this.state.processing.transcription = {
        status: 'success',
        message: 'Transcription complete.',
        error: null,
        progress: 1
      };
      this.state.modelStatus.whisper.status = 'ready';
      this.state.modelStatus.whisper.progress = 1;
      this.state.modelStatus.whisper.message = 'Local Whisper backend is ready for the next transcription.';
      this.resetDownstream('transcript');
      this.#syncExportTarget();
      this.#syncCurrentTranscriptHistory();
      this.#persist();
    } catch (error) {
      if (!this.#isCurrentRun('transcription', runId)) {
        return;
      }

      this.state.modelStatus.whisper.status = 'error';
      this.#setStageError('transcription', this.#toErrorMessage(error));
    } finally {
      this.#controllers.delete('transcription');
    }
  }

  async applyCorrections(): Promise<void> {
    if (!this.state.rawTranscript.trim()) {
      this.#setStageError('correction', 'There is no transcript text to correct yet.');
      return;
    }

    const rules = parseInstructionText(this.state.instructionText);
    this.state.correctionRules = rules;
    const { runId } = this.#beginStage('correction', 'Applying instructions…');

    try {
      const result = this.#dependencies.applyCorrections(this.state.rawTranscript, rules);

      if (!this.#isCurrentRun('correction', runId)) {
        return;
      }

      this.state.correctedTranscript = result.text;
      this.state.pendingSuggestions = result.suggestions;
      this.state.processing.correction = {
        status: 'success',
        message:
          result.suggestions.length > 0 ? `Applied instructions and found ${result.suggestions.length} fuzzy matches.` : 'Instructions applied.',
        error: null,
        progress: 1
      };

      const replacementsByRule = new Map(result.replacements.map((item) => [item.ruleId, item.count]));
      this.state.correctionRules.forEach((rule) => {
        rule.lastReplacementCount = replacementsByRule.get(rule.id) ?? 0;
        rule.lastAppliedAt = nowIso();
      });

      this.state.timestamps.correctedAt = nowIso();
      this.state.step = 'refinement';
      this.resetDownstream('refinement');
      this.#syncExportTarget();
      this.#syncCurrentTranscriptHistory();
      this.#persist();
    } catch (error) {
      this.#setStageError('correction', this.#toErrorMessage(error));
    }
  }

  async refine(): Promise<void> {
    const input = this.getWorkingEnglishText();
    if (!input.trim()) {
      this.#setStageError('refinement', 'There is no English transcript text to refine.');
      return;
    }

    const { runId, signal } = this.#beginStage('refinement', 'Sending transcript to local Llama backend…');

    try {
      const result = await this.#dependencies.refineTranscript(
        input,
        parseInstructionText(this.state.instructionText),
        signal,
        {
          onProgress: (update) => {
            this.state.processing.refinement.progress = update.progress;
            this.state.processing.refinement.message = update.message;
          }
        }
      );

      if (!this.#isCurrentRun('refinement', runId)) {
        return;
      }

      this.state.refinedSourceText = input;
      this.state.refinedTranscript = result.text;
      this.state.refinementDiff = this.#dependencies.buildDiff(input, result.text);
      this.state.timestamps.refinedAt = nowIso();
      this.state.step = 'translation';
      this.state.processing.refinement = {
        status: 'success',
        message: `Refinement complete across ${result.chunksUsed} chunk${result.chunksUsed === 1 ? '' : 's'}.`,
        error: null,
        progress: 1
      };
      this.resetDownstream('translation');
      this.#syncExportTarget();
      this.#syncCurrentTranscriptHistory();
      this.#persist();
    } catch (error) {
      if (!this.#isCurrentRun('refinement', runId)) {
        return;
      }

      this.#setStageError('refinement', this.#toErrorMessage(error));
    } finally {
      this.#controllers.delete('refinement');
    }
  }

  async translate(): Promise<void> {
    const input = this.state.refinedTranscript || this.getWorkingEnglishText();
    if (!input.trim()) {
      this.#setStageError('translation', 'There is no English transcript text to translate.');
      return;
    }

    const { runId, signal } = this.#beginStage('translation', 'Sending text to local translation backend…');
    this.state.modelStatus.marian.status = 'loading';
    this.state.modelStatus.marian.message = 'Sending translation request…';
    this.state.modelStatus.marian.device = 'unknown';
    this.state.modelStatus.marian.profile = this.#dependencies.getTranslatorRuntimeProfile();

    try {
      const result = await this.#dependencies.translateTranscript(input, signal, {
        onProgress: (update) => {
          this.state.modelStatus.marian.status = update.progress === 1 ? 'ready' : 'loading';
          this.state.modelStatus.marian.progress = update.progress;
          this.state.modelStatus.marian.message = update.message;
        }
      });

      if (!this.#isCurrentRun('translation', runId)) {
        return;
      }

      this.state.translation = result.text;
      this.state.timestamps.translatedAt = nowIso();
      this.state.processing.translation = {
        status: 'success',
        message: `Translation complete across ${result.chunksUsed} chunk${result.chunksUsed === 1 ? '' : 's'}.`,
        error: null,
        progress: 1
      };
      this.state.modelStatus.marian.status = 'ready';
      this.state.modelStatus.marian.progress = 1;
      this.state.modelStatus.marian.message = 'Japanese translation complete.';
      this.#syncExportTarget();
      this.#syncCurrentTranscriptHistory();
      this.#persist();
    } catch (error) {
      if (!this.#isCurrentRun('translation', runId)) {
        return;
      }

      this.state.modelStatus.marian.status = 'error';
      this.#setStageError('translation', this.#toErrorMessage(error));
    } finally {
      this.#controllers.delete('translation');
    }
  }

  getWorkingEnglishText(): string {
    return this.state.correctedTranscript || this.state.rawTranscript;
  }

  resetDownstream(from: 'transcript' | 'refinement' | 'translation'): void {
    if (from === 'transcript') {
      this.state.correctedTranscript = '';
      this.state.pendingSuggestions = [];
      this.state.timestamps.correctedAt = null;
    }

    if (from === 'transcript' || from === 'refinement') {
      this.state.refinedTranscript = '';
      this.state.refinedSourceText = '';
      this.state.refinementDiff = [];
      this.state.timestamps.refinedAt = null;
      this.state.processing.refinement = createStageState();
    }

    if (from !== 'translation') {
      this.state.translation = '';
      this.state.timestamps.translatedAt = null;
      this.state.processing.translation = createStageState();
    }
  }

  #beginStage(stage: AsyncStage, message: string): { runId: number; signal: AbortSignal } {
    this.cancelStage(stage);

    const controller = new AbortController();
    this.#controllers.set(stage, controller);
    this.#runIds[stage] += 1;
    this.state.processing[stage] = {
      status: 'running',
      message,
      error: null,
      progress: 0
    };

    return { runId: this.#runIds[stage], signal: controller.signal };
  }

  #isCurrentRun(stage: AsyncStage, runId: number): boolean {
    return this.#runIds[stage] === runId;
  }

  #setStageError(stage: AsyncStage, message: string): void {
    this.state.processing[stage] = {
      status: 'error',
      message,
      error: message,
      progress: null
    };
    this.#persist();
  }

  #toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'An unexpected error occurred.';
  }

  #syncExportTarget(): void {
    this.state.exportTarget = resolveDefaultExportTarget(this.state);
  }

  async #pushUploadHistory(file: File | Blob, metadata: AudioSourceMetadata): Promise<void> {
    const entry = {
      id: crypto.randomUUID(),
      name: metadata.name,
      origin: metadata.origin,
      mimeType: metadata.mimeType,
      size: metadata.size,
      lastModified: metadata.lastModified,
      addedAt: nowIso()
    };
    const trimmed = this.state.uploadHistory.filter((item) => item.name !== metadata.name);
    const removed = trimmed.slice(7);
    const next = [
      entry,
      ...trimmed.slice(0, 7)
    ];

    this.state.uploadHistory = next;
    this.#dependencies.storage.saveUploadHistory(next);

    try {
      await this.#dependencies.storage.saveAudioBlob(entry.id, file);
      await Promise.all(removed.map((item) => this.#dependencies.storage.deleteAudioBlob(item.id)));
    } catch (error) {
      this.state.processing.transcription = {
        status: 'error',
        message: 'Audio was selected, but saving it for reuse failed.',
        error: this.#toErrorMessage(error),
        progress: null
      };
      this.#persist();
    }
  }

  #syncCurrentTranscriptHistory(): void {
    const hasContent =
      this.state.rawTranscript.trim() || this.state.refinedTranscript.trim() || this.state.translation.trim();

    if (!hasContent || !this.state.currentSessionId) {
      return;
    }

    const entry = {
      id: this.state.currentSessionId,
      title: this.state.audioSource?.name ?? 'Untitled transcript',
      audioName: this.state.audioSource?.name ?? null,
      rawTranscript: this.state.rawTranscript,
      refinedTranscript: this.state.refinedTranscript,
      translation: this.state.translation,
      updatedAt: nowIso()
    };

    const next = [
      entry,
      ...this.state.transcriptHistory.filter((item) => item.id !== entry.id)
    ].slice(0, 12);

    this.state.transcriptHistory = next;
    this.#dependencies.storage.saveTranscriptHistory(next);
  }

  #resetModelStatus(model: ModelKey): void {
    this.state.modelStatus[model] = {
      status: 'idle',
      progress: null,
      message: model === 'whisper' ? 'Local Whisper backend remains available for the next run.' : 'Backend model remains available for the next run.',
      device: 'unknown',
      profile: model === 'whisper' ? 'FastAPI / faster-whisper' : 'Queued'
    };
  }

  #persist(): void {
    if (!browser || !this.state.hydrated) {
      return;
    }

    this.#dependencies.storage.saveSession(this.state);
  }
}

export const pipeline = new PipelineController();
