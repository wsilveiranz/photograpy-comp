import { apiGet, apiSend } from '../lib/apiClient';
import type { AnonymizedEntry, Result } from '../types';

export interface MyVotes {
  entryIds: string[];
  remaining: number;
}

interface VoteChange {
  remaining: number;
}

export async function castVote(
  competitionId: string,
  entryId: string,
): Promise<Result<VoteChange>> {
  return apiSend<VoteChange>('POST', `/competitions/${encodeURIComponent(competitionId)}/votes`, {
    entryId,
  });
}

export async function removeVote(
  competitionId: string,
  entryId: string,
): Promise<Result<VoteChange>> {
  return apiSend<VoteChange>(
    'DELETE',
    `/competitions/${encodeURIComponent(competitionId)}/votes/${encodeURIComponent(entryId)}`,
  );
}

export async function listMyVotes(competitionId: string): Promise<Result<MyVotes>> {
  return apiGet<MyVotes>(`/competitions/${encodeURIComponent(competitionId)}/my-votes`);
}

export async function listVotingEntries(
  competitionId: string,
): Promise<Result<AnonymizedEntry[]>> {
  return apiGet<AnonymizedEntry[]>(
    `/competitions/${encodeURIComponent(competitionId)}/entries`,
  );
}
