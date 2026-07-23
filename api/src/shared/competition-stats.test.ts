import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  getTableClient: vi.fn(),
  TABLE_NAMES: {
    competitions: 'Competitions',
    entries: 'Entries',
    votes: 'Votes',
    tieBreakVotes: 'TieBreakVotes',
  },
}));

vi.mock('./storage', () => storage);

import { getCompetitionStats } from './competition-stats';

function asyncEntities(items: unknown[]) {
  return (async function* () {
    yield* items;
  })();
}

describe('getCompetitionStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts all entries, approved entries, and votes in the competition partition', async () => {
    const entries = {
      listEntities: vi.fn().mockImplementation(() =>
        asyncEntities([
          { partitionKey: 'competition-1', rowKey: 'entry-1', status: 'approved' },
          { partitionKey: 'competition-1', rowKey: 'entry-2', status: 'pending' },
          { partitionKey: 'competition-1', rowKey: 'entry-3', status: 'approved' },
          { partitionKey: 'competition-1', rowKey: 'entry-4', status: 'rejected' },
        ]),
      ),
    };
    const votes = {
      listEntities: vi.fn().mockImplementation(() =>
        asyncEntities([
          { partitionKey: 'competition-1', rowKey: 'user-1_entry-1' },
          { partitionKey: 'competition-1', rowKey: 'user-2_entry-3' },
          { partitionKey: 'competition-1', rowKey: 'user-3_entry-3' },
        ]),
      ),
    };
    storage.getTableClient.mockImplementation(async (name: string) =>
      name === storage.TABLE_NAMES.entries ? entries : votes,
    );

    await expect(getCompetitionStats('competition-1')).resolves.toEqual({
      entryCount: 4,
      approvedEntryCount: 2,
      voteCount: 3,
    });
    const expectedQuery = {
      queryOptions: { filter: "PartitionKey eq 'competition-1'" },
    };
    expect(entries.listEntities).toHaveBeenCalledWith(expectedQuery);
    expect(votes.listEntities).toHaveBeenCalledWith(expectedQuery);
  });
});
