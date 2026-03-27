import { browser } from '$app/environment';

import { THEME_STORAGE_KEY } from '$lib/config';

export type ThemeMode = 'light' | 'dark';

type ThemeSettings = {
  mode: ThemeMode;
};

const DEFAULT_THEME: ThemeSettings = {
  mode: 'dark'
};

function applyTheme(settings: ThemeSettings): void {
  if (!browser) {
    return;
  }

  document.documentElement.dataset.mode = settings.mode;
}

export class ThemeController {
  settings = $state<ThemeSettings>({ ...DEFAULT_THEME });

  hydrate(): void {
    if (!browser) {
      return;
    }

    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
        if (parsed.mode) {
          this.settings.mode = parsed.mode;
        }
      }
    } catch {
      // Ignore invalid persisted theme settings.
    }

    applyTheme(this.settings);
    this.#persist();
  }

  setMode(mode: ThemeMode): void {
    this.settings.mode = mode;
    applyTheme(this.settings);
    this.#persist();
  }

  toggleMode(): void {
    this.setMode(this.settings.mode === 'light' ? 'dark' : 'light');
  }

  #persist(): void {
    if (!browser) {
      return;
    }

    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(this.settings));
  }
}

export const theme = new ThemeController();
