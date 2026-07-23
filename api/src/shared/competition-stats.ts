import type { EntryEntity, VoteEntity } from './entities';
import { getTableClient, TABLE_NAMES } from './storage';

export interface CompetitionStats {
  entryCount: number;
  approvedEntryCount: number;
  voteCount: number;
}

export async function getCompetitionStats(
  competitionId: string,
): Promise<CompetitionStats> {
  const filter = `PartitionKey eq '${escapeOData(competitionId)}'`;
  const [entries, votes] = await Promise.all([
    getTableClient(TABLE_NAMES.entries),
    getTableClient(TABLE_NAMES.votes),
  ]);

  const [entryStats, voteCount] = await Promise.all([
    countEntries(entries, filter),
    countVotes(votes, filter),
  ]);

  return { ...entryStats, voteCount };
}

async function countEntries(
  entries: Awaited<ReturnType<typeof getTableClient>>,
  filter: string,
): Promise<Pick<CompetitionStats, 'entryCount' | 'approvedEntryCount'>> {
  let entryCount = 0;
  let approvedEntryCount = 0;

  for await (const entry of entries.listEntities<EntryEntity>({
    queryOptions: { filter },
  })) {
    entryCount += 1;
    if (entry.status === 'approved') {
      approvedEntryCount += 1;
    }
  }

  return { entryCount, approvedEntryCount };
}

async function countVotes(
  votes: Awaited<ReturnType<typeof getTableClient>>,
  filter: string,
): Promise<number> {
  let voteCount = 0;
  for await (const _vote of votes.listEntities<VoteEntity>({
    queryOptions: { filter },
  })) {
    voteCount += 1;
  }
  return voteCount;
}

function escapeOData(value: string): string {
  return value.replaceAll("'", "''");
}
