import { apiGet, apiSend } from '../lib/apiClient';
import type { Competition, Result } from '../types';

export interface CreateCompetitionInput {
  name: string;
  prizeDescription: string;
}

export type CompetitionStatusUpdate =
  | {
      action: 'openVoting';
      votingStartsAt: string;
      votingEndsAt: string;
    }
  | { action: 'toTiebreak' | 'close' | 'forceClose' };

export async function listCompetitions(): Promise<Result<Competition[]>> {
  return apiGet<Competition[]>('/competitions');
}

export async function getCompetition(id: string): Promise<Result<Competition>> {
  return apiGet<Competition>(`/competitions/${encodeURIComponent(id)}`);
}

export async function createCompetition(
  input: CreateCompetitionInput,
): Promise<Result<Competition>> {
  return apiSend<Competition>('POST', '/admin/competitions', input);
}

export async function updateCompetitionStatus(
  id: string,
  update: CompetitionStatusUpdate,
): Promise<Result<Competition>> {
  return apiSend<Competition>(
    'PATCH',
    `/admin/competitions/${encodeURIComponent(id)}`,
    update,
  );
}

export async function setPrize(
  id: string,
  image: File,
  description: string,
): Promise<Result<Competition>> {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('description', description);
  return apiSend<Competition>(
    'POST',
    `/admin/competitions/${encodeURIComponent(id)}/prize`,
    formData,
  );
}
