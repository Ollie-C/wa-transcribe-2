import { describe, expect, it } from 'vitest';

import { resolveApiBaseUrl } from '$lib/config';

describe('resolveApiBaseUrl', () => {
  it('keeps localhost for local development by default', () => {
    expect(resolveApiBaseUrl({ DEV: true })).toBe('http://127.0.0.1:8001');
  });

  it('uses same-origin requests in hosted mode by default', () => {
    expect(resolveApiBaseUrl({ DEV: false })).toBe('');
  });

  it('respects explicit hosted relative API mode', () => {
    expect(resolveApiBaseUrl({ DEV: false, VITE_USE_RELATIVE_API: 'true', VITE_API_BASE_URL: 'https://example.com' })).toBe('');
  });

  it('respects an explicit API base override', () => {
    expect(resolveApiBaseUrl({ DEV: false, VITE_API_BASE_URL: 'https://api.example.com' })).toBe('https://api.example.com');
  });
});
