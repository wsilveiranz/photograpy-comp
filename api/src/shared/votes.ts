import type { TableEntity } from '@azure/data-tables';
import {
  fromCompetitionEntity,
  fromEntryEntity,
  toVoteEntity,
  type CompetitionEntity,
  type EntryEntity,
  type VoteEntity,
  type VoteRecord,
} from './entities';
import { generateReadSasUrl, getTableClient, TABLE_NAMES } from './storage';

const MAX_TOKENS = 3;
const THUMBNAIL_SAS_TTL_MINUTES = 15;

export type VoteErrorCode =
  | 'not-voting'
  | 'window-closed'
  | 'entry-not-approved'
  | 'already-voted'
  | 'token-limit-reached';

export class VoteError extends Error {
  constructor(public readonly code: VoteErrorCode) {
    super(code);
  }
}

export interface AnonymizedEntry {
  entryId: string;
  thumbUrl: string;
}

export async function castVote(
  competitionId: string,
  userId: string,
  entryId: string,
): Promise<void> {
  const [competitions, entries, votes] = await Promise.all([
    getTableClient(TABLE_NAMES.competitions),
    getTableClient(TABLE_NAMES.entries),
    getTableClient(TABLE_NAMES.votes),
  ]);

  const competition = fromCompetitionEntity(
    await getEntityOrThrow<CompetitionEntity>(competitions, 'competition', competitionId),
  );
  if (competition.status !== 'voting') {
    throw new VoteError('not-voting');
  }
  if (
    !competition.votingEndsAt ||
    !Number.isFinite(Date.parse(competition.votingEndsAt)) ||
    Date.now() > Date.parse(competition.votingEndsAt)
  ) {
    throw new VoteError('window-closed');
  }

  const entry = fromEntryEntity(
    await getEntityOrThrow<EntryEntity>(entries, competitionId, entryId),
  );
  if (entry.competitionId !== competitionId || entry.status !== 'approved') {
    throw new VoteError('entry-not-approved');
  }

  const voteRowKey = `${userId}_${entryId}`;
  if (await entityExists<VoteEntity>(votes, competitionId, voteRowKey)) {
    throw new VoteError('already-voted');
  }

  if ((await listMyVotes(competitionId, userId)).length >= MAX_TOKENS) {
    throw new VoteError('token-limit-reached');
  }

  const vote: VoteRecord = {
    competitionId,
    userId,
    entryId,
    createdAt: new Date().toISOString(),
  };

  try {
    await votes.createEntity(toVoteEntity(vote));
  } catch (error) {
    if (getStatusCode(error) === 409) {
      throw new VoteError('already-voted');
    }
    throw error;
  }
}

export async function removeVote(
  competitionId: string,
  userId: string,
  entryId: string,
): Promise<void> {
  const votes = await getTableClient(TABLE_NAMES.votes);
  try {
    await votes.deleteEntity(competitionId, `${userId}_${entryId}`);
  } catch (error) {
    if (getStatusCode(error) !== 404) {
      throw error;
    }
  }
}

export async function listMyVotes(competitionId: string, userId: string): Promise<string[]> {
  const votes = await getTableClient(TABLE_NAMES.votes);
  const prefix = `${userId}_`;
  const filter =
    `PartitionKey eq '${escapeOData(competitionId)}' and ` +
    `RowKey ge '${escapeOData(prefix)}' and RowKey lt '${escapeOData(`${userId}_~`)}'`;
  const entryIds: string[] = [];

  for await (const entity of votes.listEntities<VoteEntity>({ queryOptions: { filter } })) {
    entryIds.push(entity.rowKey.slice(prefix.length));
  }

  return entryIds;
}

export async function getRemainingTokens(competitionId: string, userId: string): Promise<number> {
  return Math.max(0, MAX_TOKENS - (await listMyVotes(competitionId, userId)).length);
}

export async function listApprovedAnonymized(
  competitionId: string,
): Promise<AnonymizedEntry[]> {
  const entries = await getTableClient(TABLE_NAMES.entries);
  const filter = `PartitionKey eq '${escapeOData(competitionId)}'`;
  const approvedEntries = [];

  for await (const entity of entries.listEntities<EntryEntity>({ queryOptions: { filter } })) {
    const entry = fromEntryEntity(entity);
    if (entry.status === 'approved') {
      approvedEntries.push(entry);
    }
  }

  return Promise.all(
    approvedEntries.map(async (entry) => ({
      entryId: entry.id,
      thumbUrl: await generateReadSasUrl(entry.thumbBlobName, THUMBNAIL_SAS_TTL_MINUTES),
    })),
  );
}

async function getEntityOrThrow<T extends TableEntity>(
  client: Awaited<ReturnType<typeof getTableClient>>,
  partitionKey: string,
  rowKey: string,
): Promise<T> {
  try {
    return await client.getEntity<T>(partitionKey, rowKey);
  } catch (error) {
    if (getStatusCode(error) === 404) {
      throw new VoteError('entry-not-approved');
    }
    throw error;
  }
}

async function entityExists<T extends TableEntity>(
  client: Awaited<ReturnType<typeof getTableClient>>,
  partitionKey: string,
  rowKey: string,
): Promise<boolean> {
  try {
    await client.getEntity<T>(partitionKey, rowKey);
    return true;
  } catch (error) {
    if (getStatusCode(error) === 404) {
      return false;
    }
    throw error;
  }
}

function getStatusCode(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? (error as { statusCode?: unknown }).statusCode as number | undefined
    : undefined;
}

function escapeOData(value: string): string {
  return value.replaceAll("'", "''");
}
