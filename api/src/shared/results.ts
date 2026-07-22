import { odata } from '@azure/data-tables';
import type { CompetitionEntity, EntryEntity, TieBreakVoteEntity, VoteEntity } from './entities';
import {
  fromCompetitionEntity,
  fromEntryEntity,
  fromTieBreakVoteEntity,
  fromVoteEntity,
  toCompetitionEntity,
  toTieBreakVoteEntity,
} from './entities';
import { generateReadSasUrl, getTableClient, TABLE_NAMES } from './storage';

const SAS_TTL_MINUTES = 30;

export interface Standing {
  entryId: string;
  title: string;
  voteCount: number;
}

export interface TieStatus {
  tied: boolean;
  entryIds: string[];
}

export interface Results {
  standings: Standing[];
  tie: TieStatus;
}

export interface TieBreakResults {
  counts: Record<string, number>;
  clearWinner: string | null;
}

export interface WinnerView {
  entryId: string;
  title: string;
  imageUrl: string;
  thumbUrl: string;
  userAlias: string;
  voteCount: number;
}

export interface Winners {
  winner: WinnerView;
  runnersUp: WinnerView[];
}

export class ResultsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ResultsError';
  }
}

export async function tally(competitionId: string): Promise<Standing[]> {
  const entries = await listEntries(competitionId);
  const approvedEntries = new Map(
    entries.filter((entry) => entry.status === 'approved').map((entry) => [entry.id, entry]),
  );
  const voteCounts = new Map<string, number>();
  const voteClient = await getTableClient(TABLE_NAMES.votes);

  for await (const entity of voteClient.listEntities<VoteEntity>({
    queryOptions: { filter: odata`PartitionKey eq ${competitionId}` },
  })) {
    const vote = fromVoteEntity(entity);
    if (approvedEntries.has(vote.entryId)) {
      voteCounts.set(vote.entryId, (voteCounts.get(vote.entryId) ?? 0) + 1);
    }
  }

  return [...approvedEntries.values()]
    .map((entry) => ({
      entryId: entry.id,
      title: entry.title,
      voteCount: voteCounts.get(entry.id) ?? 0,
    }))
    .sort((left, right) => right.voteCount - left.voteCount || left.entryId.localeCompare(right.entryId));
}

export function detectTie(standings: Standing[]): TieStatus {
  if (standings.length < 2) {
    return { tied: false, entryIds: [] };
  }

  const topCount = standings[0].voteCount;
  const entryIds = standings
    .filter((standing) => standing.voteCount === topCount)
    .map((standing) => standing.entryId);
  return { tied: entryIds.length > 1, entryIds: entryIds.length > 1 ? entryIds : [] };
}

export async function getResults(competitionId: string): Promise<Results> {
  const standings = await tally(competitionId);
  return { standings, tie: detectTie(standings) };
}

export async function castTieBreak(
  competitionId: string,
  adminId: string,
  entryId: string,
): Promise<TieBreakResults> {
  const competition = await getCompetition(competitionId);
  if (competition.status !== 'tiebreak') {
    throw new ResultsError('Tie-break voting is not currently open.', 409);
  }

  const { tie } = await getResults(competitionId);
  if (!tie.tied || !tie.entryIds.includes(entryId)) {
    throw new ResultsError('The selected entry is not part of the current first-place tie.', 400);
  }

  const client = await getTableClient(TABLE_NAMES.tieBreakVotes);
  await client.upsertEntity(
    toTieBreakVoteEntity({
      competitionId,
      adminId,
      entryId,
      createdAt: new Date().toISOString(),
    }),
    'Replace',
  );
  return getTieBreak(competitionId);
}

export async function getTieBreak(competitionId: string): Promise<TieBreakResults> {
  const { tie } = await getResults(competitionId);
  if (!tie.tied) {
    return { counts: {}, clearWinner: null };
  }

  const counts = Object.fromEntries(tie.entryIds.map((entryId) => [entryId, 0])) as Record<
    string,
    number
  >;
  const client = await getTableClient(TABLE_NAMES.tieBreakVotes);
  let totalVotes = 0;
  for await (const entity of client.listEntities<TieBreakVoteEntity>({
    queryOptions: { filter: odata`PartitionKey eq ${competitionId}` },
  })) {
    const vote = fromTieBreakVoteEntity(entity);
    if (vote.entryId in counts) {
      counts[vote.entryId] += 1;
      totalVotes += 1;
    }
  }

  const leader = tie.entryIds.reduce(
    (current, entryId) => (counts[entryId] > counts[current] ? entryId : current),
    tie.entryIds[0],
  );
  return {
    counts,
    clearWinner: totalVotes > 0 && counts[leader] > totalVotes / 2 ? leader : null,
  };
}

export async function resolveWinner(competitionId: string, _adminId: string): Promise<string> {
  const competition = await getCompetition(competitionId);
  if (competition.status === 'closed') {
    throw new ResultsError('This competition has already been closed.', 409);
  }

  const results = await getResults(competitionId);
  if (results.standings.length === 0) {
    throw new ResultsError('A competition with no approved entries cannot be resolved.', 409);
  }

  let winnerId = results.standings[0].entryId;
  if (results.tie.tied) {
    const tieBreak = await getTieBreak(competitionId);
    if (!tieBreak.clearWinner) {
      throw new ResultsError('A majority tie-break winner is required before resolving.', 409);
    }
    winnerId = tieBreak.clearWinner;
  }

  const competitionClient = await getTableClient(TABLE_NAMES.competitions);
  await competitionClient.upsertEntity(
    toCompetitionEntity({
      ...competition,
      status: 'closed',
      closedAt: new Date().toISOString(),
    }),
    'Replace',
  );
  return winnerId;
}

export async function getWinners(competitionId: string): Promise<Winners | null> {
  const competition = await getCompetition(competitionId);
  if (competition.status !== 'closed') {
    return null;
  }

  const entries = await listEntries(competitionId);
  const approvedEntries = new Map(
    entries.filter((entry) => entry.status === 'approved').map((entry) => [entry.id, entry]),
  );
  const { standings, tie } = await getResults(competitionId);
  if (standings.length === 0) {
    throw new ResultsError('No approved entries are available to reveal.', 404);
  }

  let winnerId = standings[0].entryId;
  if (tie.tied) {
    const tieBreak = await getTieBreak(competitionId);
    if (!tieBreak.clearWinner) {
      throw new ResultsError('A closed competition with a first-place tie must have a tie-break winner.', 409);
    }
    winnerId = tieBreak.clearWinner;
  }

  const winnerStanding = standings.find((standing) => standing.entryId === winnerId);
  if (!winnerStanding) {
    throw new ResultsError('The resolved winner is not an approved entry.', 409);
  }
  const winner = await toWinnerView(winnerStanding, approvedEntries);
  const runnersUp = await Promise.all(
    standings
      .filter((standing) => standing.entryId !== winnerId)
      .slice(0, 2)
      .map((standing) => toWinnerView(standing, approvedEntries)),
  );
  return { winner, runnersUp };
}

async function getCompetition(competitionId: string) {
  try {
    const client = await getTableClient(TABLE_NAMES.competitions);
    const entity = await client.getEntity<CompetitionEntity>('competition', competitionId);
    return fromCompetitionEntity(entity);
  } catch (error) {
    if (isNotFound(error)) {
      throw new ResultsError('Competition not found.', 404);
    }
    throw error;
  }
}

async function listEntries(competitionId: string) {
  const client = await getTableClient(TABLE_NAMES.entries);
  const entries = [];
  for await (const entity of client.listEntities<EntryEntity>({
    queryOptions: { filter: odata`PartitionKey eq ${competitionId}` },
  })) {
    entries.push(fromEntryEntity(entity));
  }
  return entries;
}

async function toWinnerView(
  standing: Standing,
  entries: Map<string, ReturnType<typeof fromEntryEntity>>,
): Promise<WinnerView> {
  const entry = entries.get(standing.entryId);
  if (!entry) {
    throw new ResultsError('Standing references an unavailable entry.', 409);
  }
  const [imageUrl, thumbUrl] = await Promise.all([
    generateReadSasUrl(entry.blobName, SAS_TTL_MINUTES),
    generateReadSasUrl(entry.thumbBlobName, SAS_TTL_MINUTES),
  ]);
  return {
    entryId: entry.id,
    title: entry.title,
    imageUrl,
    thumbUrl,
    userAlias: entry.userAlias,
    voteCount: standing.voteCount,
  };
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 404;
}
