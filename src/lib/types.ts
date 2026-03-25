export type PipelineStep = 'input' | 'transcript' | 'refinement' | 'translation';
export type ExportTarget = 'raw' | 'refined' | 'translation';
export type ModelKey = 'whisper' | 'marian';
export type AsyncStage = 'transcription' | 'correction' | 'refinement' | 'translation';
export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';
export type StageStatus = 'idle' | 'running' | 'success' | 'error';
export type CorrectionMode = 'exact' | 'fuzzy' | 'instruction';
export type DiffSegmentType = 'equal' | 'insert' | 'delete';
export type ReadinessState = 'ready' | 'offline' | 'missing' | 'unavailable';
export type SetupState = 'checking' | 'ready' | 'backend-offline' | 'ollama-offline' | 'model-missing' | 'whisper-unavailable';

export interface AudioSourceMetadata {
  name: string;
  origin: 'upload' | 'recording';
  mimeType: string;
  size: number;
  lastModified?: number;
}

export interface ModelState {
  status: ModelStatus;
  progress: number | null;
  message: string;
  device: 'webgpu' | 'wasm' | 'unknown';
  profile: string;
}

export interface StageState {
  status: StageStatus;
  message: string;
  error: string | null;
  progress: number | null;
}

export interface ReplacementSummary {
  ruleId: string;
  from: string;
  to: string;
  count: number;
}

export interface CorrectionRule {
  id: string;
  heard: string;
  correct: string;
  mode: CorrectionMode;
  createdAt: string;
  lastAppliedAt: string | null;
  lastReplacementCount: number;
}

export interface CorrectionSuggestion {
  id: string;
  ruleId: string;
  candidate: string;
  replacement: string;
  score: number;
  accepted: boolean;
}

export interface DiffSegment {
  type: DiffSegmentType;
  text: string;
}

export interface TranscriptChunk {
  text: string;
  timestamp?: [number, number];
}

export interface PipelineTimestamps {
  transcribedAt: string | null;
  correctedAt: string | null;
  refinedAt: string | null;
  translatedAt: string | null;
}

export interface UploadHistoryItem {
  id: string;
  name: string;
  origin: AudioSourceMetadata['origin'];
  mimeType: string;
  size: number;
  lastModified?: number;
  addedAt: string;
}

export interface TranscriptHistoryItem {
  id: string;
  title: string;
  audioName: string | null;
  rawTranscript: string;
  refinedTranscript: string;
  translation: string;
  updatedAt: string;
}

export interface PipelineState {
  hydrated: boolean;
  step: PipelineStep;
  currentSessionId: string | null;
  audioSource: AudioSourceMetadata | null;
  rawTranscript: string;
  instructionText: string;
  correctedTranscript: string;
  refinedTranscript: string;
  refinedSourceText: string;
  translation: string;
  correctionRules: CorrectionRule[];
  pendingSuggestions: CorrectionSuggestion[];
  refinementDiff: DiffSegment[];
  exportTarget: ExportTarget;
  uploadHistory: UploadHistoryItem[];
  transcriptHistory: TranscriptHistoryItem[];
  modelStatus: Record<ModelKey, ModelState>;
  processing: Record<AsyncStage, StageState>;
  timestamps: PipelineTimestamps;
}

export interface PersistedSession {
  version: number;
  step: PipelineStep;
  audioSource: AudioSourceMetadata | null;
  rawTranscript: string;
  instructionText: string;
  correctedTranscript: string;
  refinedTranscript: string;
  refinedSourceText: string;
  translation: string;
  correctionRules: CorrectionRule[];
  pendingSuggestions: CorrectionSuggestion[];
  refinementDiff: DiffSegment[];
  exportTarget: ExportTarget;
  timestamps: PipelineTimestamps;
}

export interface RefinementResult {
  text: string;
  chunksUsed: number;
}

export interface TranslationResult {
  text: string;
  chunksUsed: number;
}

export interface TranscriptionResult {
  text: string;
  chunks: TranscriptChunk[];
}

export interface ModelProgressUpdate {
  progress: number | null;
  message: string;
}

export interface StoredEnvelope<T> {
  version: number;
  data: T;
}

export interface DependencyReadiness {
  ready: boolean;
  status: ReadinessState;
  detail: string;
}

export interface BackendReadinessResponse {
  status: 'ready' | 'degraded';
  api: DependencyReadiness;
  ollama: DependencyReadiness;
  llm_model: DependencyReadiness;
  whisper: DependencyReadiness;
}

export interface SetupStatus {
  state: SetupState;
  title: string;
  message: string;
  hint: string;
  checkedAt: string | null;
  canTranscribe: boolean;
  canUseLlm: boolean;
  readiness: BackendReadinessResponse | null;
}
