import type { TableEntity } from '@azure/data-tables';

export type CompetitionStatus = 'submissions' | 'voting' | 'tiebreak' | 'closed';
export type EntryStatus = 'pending' | 'approved' | 'rejected';
export type ModerationSeverities = Record<string, string>;

export interface CompetitionRecord {
  id: string;
  name: string;
  status: CompetitionStatus;
  prizeDescription: string;
  prizeBlobName: string;
  votingStartsAt: string | null;
  votingEndsAt: string | null;
  createdAt: string;
  closedAt: string | null;
}

export type CompetitionEntity = TableEntity<{
  name: string;
  status: CompetitionStatus;
  prizeDescription: string;
  prizeBlobName: string;
  votingStartsAt?: string;
  votingEndsAt?: string;
  createdAt: string;
  closedAt?: string;
}>;

export interface EntryRecord {
  id: string;
  competitionId: string;
  userId: string;
  userAlias: string;
  title: string;
  blobName: string;
  thumbBlobName: string;
  contentType: string;
  width: number;
  height: number;
  sizeBytes: number;
  status: EntryStatus;
  moderation: ModerationSeverities;
  flagged: boolean;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export type EntryEntity = TableEntity<{
  userId: string;
  userAlias: string;
  title: string;
  blobName: string;
  thumbBlobName: string;
  contentType: string;
  width: number;
  height: number;
  sizeBytes: number;
  status: EntryStatus;
  moderation: string;
  flagged: boolean;
  uploadedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}>;

export interface VoteRecord {
  competitionId: string;
  userId: string;
  entryId: string;
  createdAt: string;
}

export type VoteEntity = TableEntity<{
  createdAt: string;
}>;

export interface TieBreakVoteRecord {
  competitionId: string;
  adminId: string;
  entryId: string;
  createdAt: string;
}

export type TieBreakVoteEntity = TableEntity<{
  entryId: string;
  createdAt: string;
}>;

export function toCompetitionEntity(record: CompetitionRecord): CompetitionEntity {
  return {
    partitionKey: 'competition',
    rowKey: record.id,
    name: record.name,
    status: record.status,
    prizeDescription: record.prizeDescription,
    prizeBlobName: record.prizeBlobName,
    createdAt: record.createdAt,
    ...(record.votingStartsAt ? { votingStartsAt: record.votingStartsAt } : {}),
    ...(record.votingEndsAt ? { votingEndsAt: record.votingEndsAt } : {}),
    ...(record.closedAt ? { closedAt: record.closedAt } : {}),
  };
}

export function fromCompetitionEntity(entity: CompetitionEntity): CompetitionRecord {
  return {
    id: entity.rowKey,
    name: entity.name,
    status: entity.status,
    prizeDescription: entity.prizeDescription,
    prizeBlobName: entity.prizeBlobName,
    votingStartsAt: entity.votingStartsAt ?? null,
    votingEndsAt: entity.votingEndsAt ?? null,
    createdAt: entity.createdAt,
    closedAt: entity.closedAt ?? null,
  };
}

export function toEntryEntity(record: EntryRecord): EntryEntity {
  return {
    partitionKey: record.competitionId,
    rowKey: record.id,
    userId: record.userId,
    userAlias: record.userAlias,
    title: record.title,
    blobName: record.blobName,
    thumbBlobName: record.thumbBlobName,
    contentType: record.contentType,
    width: record.width,
    height: record.height,
    sizeBytes: record.sizeBytes,
    status: record.status,
    moderation: JSON.stringify(record.moderation),
    flagged: record.flagged,
    uploadedAt: record.uploadedAt,
    ...(record.reviewedAt ? { reviewedAt: record.reviewedAt } : {}),
    ...(record.reviewedBy ? { reviewedBy: record.reviewedBy } : {}),
  };
}

export function fromEntryEntity(entity: EntryEntity): EntryRecord {
  return {
    id: entity.rowKey,
    competitionId: entity.partitionKey,
    userId: entity.userId,
    userAlias: entity.userAlias,
    title: entity.title,
    blobName: entity.blobName,
    thumbBlobName: entity.thumbBlobName,
    contentType: entity.contentType,
    width: entity.width,
    height: entity.height,
    sizeBytes: entity.sizeBytes,
    status: entity.status,
    moderation: parseModeration(entity.moderation),
    flagged: entity.flagged,
    uploadedAt: entity.uploadedAt,
    reviewedAt: entity.reviewedAt ?? null,
    reviewedBy: entity.reviewedBy ?? null,
  };
}

export function toVoteEntity(record: VoteRecord): VoteEntity {
  return {
    partitionKey: record.competitionId,
    rowKey: `${record.userId}_${record.entryId}`,
    createdAt: record.createdAt,
  };
}

export function fromVoteEntity(entity: VoteEntity): VoteRecord {
  const separatorIndex = entity.rowKey.indexOf('_');
  if (separatorIndex < 1 || separatorIndex === entity.rowKey.length - 1) {
    throw new Error('Vote entity rowKey must use the userId_entryId format');
  }

  return {
    competitionId: entity.partitionKey,
    userId: entity.rowKey.slice(0, separatorIndex),
    entryId: entity.rowKey.slice(separatorIndex + 1),
    createdAt: entity.createdAt,
  };
}

export function toTieBreakVoteEntity(record: TieBreakVoteRecord): TieBreakVoteEntity {
  return {
    partitionKey: record.competitionId,
    rowKey: record.adminId,
    entryId: record.entryId,
    createdAt: record.createdAt,
  };
}

export function fromTieBreakVoteEntity(entity: TieBreakVoteEntity): TieBreakVoteRecord {
  return {
    competitionId: entity.partitionKey,
    adminId: entity.rowKey,
    entryId: entity.entryId,
    createdAt: entity.createdAt,
  };
}

function parseModeration(value: string): ModerationSeverities {
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.values(parsed).some((severity) => typeof severity !== 'string')
  ) {
    throw new Error('Entry moderation must be a JSON object of category severities');
  }

  return parsed as ModerationSeverities;
}
