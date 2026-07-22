// Thin HTTP client for the Azure Functions backend.
// The ONLY module (besides services) that knows about transport details.

import type { Result } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export async function apiGet<T>(path: string): Promise<Result<T>> {
  return request<T>('GET', path);
}

export async function apiSend<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<Result<T>> {
  return request<T>(method, path, body);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  try {
    const isFormData = body instanceof FormData;
    const hasBody = body !== undefined;
    const res = await fetch(apiUrl(path), {
      method,
      headers: hasBody && !isFormData ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
    if (!res.ok) {
      return { data: null, error: await readError(res) };
    }
    return { data: (await res.json()) as T, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Network error' };
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown;
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      return body.error;
    }
  } catch {
    // Fall back to the status when the response is not JSON.
  }
  return `Request failed with status ${response.status}`;
}
