// Shared domain types — mirror the Azure Table entity shapes.
// See .github/copilot-instructions.md for the data model.

export type CompetitionStatus = 'submissions' | 'voting' | 'tiebreak' | 'closed';
export type EntryStatus = 'pending' | 'approved' | 'rejected';
export type ModerationSeverities = Record<string, string>;

export interface Competition {
  id: string;
  name: string;
  status: CompetitionStatus;
  prizeDescription: string;
  prizeImageUrl: string | null;
  votingStartsAt: string | null;
  votingEndsAt: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface Entry {
  id: string;
  competitionId: string;
  userId: string;
  userAlias?: string;
  title: string;
  /** Blob name, keyed as `${competitionId}/${entryId}`. */
  blobName: string;
  /** Thumbnail blob name, keyed as `${competitionId}/thumb/${entryId}.jpg`. */
  thumbBlobName: string;
  /** Short-lived read URL for the original, when included by the API. */
  imageUrl?: string;
  /** Short-lived read URL for the thumbnail/preview, when included by the API. */
  thumbUrl?: string;
  contentType: string;
  width: number;
  height: number;
  sizeBytes: number;
  status: EntryStatus;
  moderation?: ModerationSeverities;
  flagged: boolean;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface Vote {
  competitionId: string;
  userId: string;
  entryId: string;
  createdAt: string;
}

export interface TieBreakVote {
  competitionId: string;
  adminId: string;
  entryId: string;
  createdAt: string;
}

export interface AnonymizedEntry {
  entryId: string;
  thumbUrl: string;
}

export interface WinnerView {
  entryId: string;
  title: string;
  imageUrl: string;
  thumbUrl: string;
  userAlias: string;
  voteCount: number;
}

/** Standard result shape returned by every service function. */
export type Result<T> = { data: T; error: null } | { data: null; error: string };
