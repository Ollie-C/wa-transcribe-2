import { LOCAL_API_BASE_URL } from '$lib/config';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function readErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const payload = (await response.json().catch(() => null)) as unknown;
    if (isObject(payload) && typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail.trim();
    }
  }

  const text = await response.text().catch(() => '');
  return text.trim();
}

export function normalizeRequestError(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return error.message;
  }

  if (error instanceof TypeError) {
    return `Cannot reach the local API at ${LOCAL_API_BASE_URL}. Start \`pnpm dev:local\` and retry.`;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
