import { apiGet, apiSend, apiUrl } from '../lib/apiClient';
import type { Entry, Result } from '../types';

export type ReviewDecision = 'approved' | 'rejected';
export type ImageVariant = 'thumb' | 'original';

export async function uploadEntry(
  competitionId: string,
  file: File,
  title: string,
): Promise<Result<Entry>> {
  const form = new FormData();
  form.set('file', file);
  form.set('title', title);
  return apiSend<Entry>(
    'POST',
    `/competitions/${encodeURIComponent(competitionId)}/entries`,
    form,
  );
}

export async function listMyEntries(competitionId: string): Promise<Result<Entry[]>> {
  return apiGet<Entry[]>(
    `/competitions/${encodeURIComponent(competitionId)}/my-entries`,
  );
}

export async function listVettingEntries(competitionId: string): Promise<Result<Entry[]>> {
  return apiGet<Entry[]>(
    `/manage/competitions/${encodeURIComponent(competitionId)}/entries`,
  );
}

export async function reviewEntry(
  competitionId: string,
  entryId: string,
  decision: ReviewDecision,
): Promise<Result<Entry>> {
  return apiSend<Entry>('PATCH', `/manage/entries/${encodeURIComponent(entryId)}`, {
    competitionId,
    decision,
  });
}

export function imageUrl(
  competitionId: string,
  entryId: string,
  variant: ImageVariant,
): string {
  const params = new URLSearchParams({ variant });
  return apiUrl(
    `/images/${encodeURIComponent(competitionId)}/${encodeURIComponent(entryId)}?${params}`,
  );
}
