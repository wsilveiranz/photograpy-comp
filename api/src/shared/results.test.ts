import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  getTableClient: vi.fn(),
  generateReadSasUrl: vi.fn(),
  TABLE_NAMES: {
    competitions: 'Competitions',
    entries: 'Entries',
    votes: 'Votes',
    tieBreakVotes: 'TieBreakVotes',
  },
}));

vi.mock('./storage', () => storage);

import { detectTie, getWinners, tally } from './results';

function asyncEntities(items: unknown[]) {
  return (async function* () {
    yield* items;
  })();
}

function entry(id: string, status: 'approved' | 'rejected') {
  return {
    partitionKey: 'competition-1',
    rowKey: id,
    userId: `user-${id}`,
    userAlias: `Alias ${id}`,
    title: `Title ${id}`,
    blobName: `competition-1/${id}`,
    thumbBlobName: `competition-1/thumb/${id}.jpg`,
    contentType: 'image/jpeg',
    width: 2000,
    height: 1200,
    sizeBytes: 12,
    status,
    moderation: '{}',
    flagged: false,
    uploadedAt: '2026-01-01T00:00:00.000Z',
  };
}

function vote(userId: string, entryId: string) {
  return {
    partitionKey: 'competition-1',
    rowKey: `${userId}_${entryId}`,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('results', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tallies votes for approved entries only and detects a shared top count', async () => {
    const entries = {
      listEntities: vi
        .fn()
        .mockImplementation(() => asyncEntities([entry('entry-1', 'approved'), entry('entry-2', 'approved'), entry('entry-3', 'rejected')])),
    };
    const votes = {
      listEntities: vi
        .fn()
        .mockImplementation(() =>
          asyncEntities([
            vote('one', 'entry-1'),
            vote('two', 'entry-1'),
            vote('three', 'entry-2'),
            vote('four', 'entry-2'),
            vote('five', 'entry-3'),
          ]),
        ),
    };
    storage.getTableClient.mockImplementation(async (name: string) =>
      name === storage.TABLE_NAMES.entries ? entries : votes,
    );

    const standings = await tally('competition-1');

    expect(standings).toEqual([
      { entryId: 'entry-1', title: 'Title entry-1', voteCount: 2 },
      { entryId: 'entry-2', title: 'Title entry-2', voteCount: 2 },
    ]);
    expect(detectTie(standings)).toEqual({ tied: true, entryIds: ['entry-1', 'entry-2'] });
  });

  it('withholds winner details until the competition is closed', async () => {
    const competitions = {
      getEntity: vi.fn().mockResolvedValue({
        partitionKey: 'competition',
        rowKey: 'competition-1',
        name: 'Competition',
        status: 'voting',
        prizeDescription: 'Prize',
        prizeBlobName: '',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    };
    storage.getTableClient.mockResolvedValue(competitions);

    await expect(getWinners('competition-1')).resolves.toBeNull();
  });
});
