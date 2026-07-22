// Thin HTTP client for the Azure Functions backend.
// The ONLY module (besides services) that knows about transport details.

import type { Result } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export async function apiGet<T>(path: string): Promise<Result<T>> {
  return request<T>('GET', path);
}

export async function apiSend<T>(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<Result<T>> {
  return request<T>(method, path, body);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      return { data: null, error: `Request failed with status ${res.status}` };
    }
    return { data: (await res.json()) as T, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Network error' };
  }
}
