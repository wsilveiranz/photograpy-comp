import { apiGet, apiSend } from '../lib/apiClient';
import type { Result, WinnerView } from '../types';

export interface Standing {
  entryId: string;
  title: string;
  voteCount: number;
}

export interface TieStatus {
  tied: boolean;
  entryIds: string[];
}

export interface ResultsView {
  standings: Standing[];
  tie: TieStatus;
}

export interface TieBreakView {
  counts: Record<string, number>;
  clearWinner: string | null;
}

export interface WinnersView {
  winner: WinnerView;
  runnersUp: WinnerView[];
}

export async function getResults(competitionId: string): Promise<Result<ResultsView>> {
  return apiGet<ResultsView>(`/competitions/${encodeURIComponent(competitionId)}/results`);
}

export async function castTieBreak(
  competitionId: string,
  entryId: string,
): Promise<Result<TieBreakView>> {
  return apiSend<TieBreakView>(
    'POST',
    `/admin/competitions/${encodeURIComponent(competitionId)}/tiebreak`,
    { entryId },
  );
}

export async function getTieBreak(competitionId: string): Promise<Result<TieBreakView>> {
  return apiGet<TieBreakView>(`/admin/competitions/${encodeURIComponent(competitionId)}/tiebreak`);
}

export async function resolveWinner(
  competitionId: string,
): Promise<Result<{ winnerId: string }>> {
  return apiSend<{ winnerId: string }>(
    'POST',
    `/admin/competitions/${encodeURIComponent(competitionId)}/resolve`,
  );
}

export async function getWinners(competitionId: string): Promise<Result<WinnersView>> {
  return apiGet<WinnersView>(`/competitions/${encodeURIComponent(competitionId)}/winners`);
}
