// Shared domain types — mirror the Azure Table entity shapes.
// See .github/copilot-instructions.md for the data model.

export type CompetitionStatus = 'open' | 'voting' | 'closed';

export interface Competition {
  id: string;
  name: string;
  status: CompetitionStatus;
  createdAt: string;
}

export interface Entry {
  id: string;
  competitionId: string;
  userId: string;
  title: string;
  /** Blob name, keyed as `${competitionId}/${entryId}`. */
  blobName: string;
  uploadedAt: string;
}

export interface Vote {
  competitionId: string;
  userId: string;
  entryId: string;
  createdAt: string;
}

/** Standard result shape returned by every service function. */
export type Result<T> = { data: T; error: null } | { data: null; error: string };
