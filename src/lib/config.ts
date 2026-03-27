export const APP_TITLE = 'WA Transcribe 2';
export const STORAGE_SCHEMA_VERSION = 1;
export const SESSION_STORAGE_KEY = 'wa-transcribe-2/session';
export const UPLOAD_HISTORY_STORAGE_KEY = 'wa-transcribe-2/upload-history';
export const TRANSCRIPT_HISTORY_STORAGE_KEY = 'wa-transcribe-2/transcript-history';
export const SETTINGS_STORAGE_KEY = 'wa-transcribe-2/settings';
export const THEME_STORAGE_KEY = 'wa-transcribe-2/theme';

type AppEnv = {
  DEV?: boolean;
  VITE_API_BASE_URL?: string;
  VITE_USE_RELATIVE_API?: string;
};

export function resolveApiBaseUrl(env: AppEnv): string {
  if (env.VITE_USE_RELATIVE_API === 'true') {
    return '';
  }

  if (env.VITE_API_BASE_URL?.trim()) {
    return env.VITE_API_BASE_URL.trim();
  }

  return env.DEV ? 'http://127.0.0.1:8001' : '';
}

export const LOCAL_API_BASE_URL = resolveApiBaseUrl(import.meta.env);

export const TRANSCRIPTION_LANGUAGE = 'english';

export const REFINEMENT_CHUNK_SIZE = 4800;
export const TRANSLATION_CHUNK_SIZE = 1400;
export const MAX_FUZZY_SUGGESTIONS_PER_RULE = 5;
export const FUZZY_THRESHOLD = 0.45;
