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

import { castVote, listApprovedAnonymized, VoteError } from './votes';

const future = '2099-01-01T00:00:00.000Z';

function competition(status: 'submissions' | 'voting', votingEndsAt: string | null = future) {
  return {
    partitionKey: 'competition',
    rowKey: 'competition-1',
    name: 'Competition',
    status,
    prizeDescription: 'Prize',
    prizeBlobName: '',
    votingEndsAt: votingEndsAt ?? undefined,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function entry(status: 'approved' | 'rejected' = 'approved') {
  return {
    partitionKey: 'competition-1',
    rowKey: 'entry-1',
    userId: 'voter-1',
    userAlias: 'Calm Kea 42',
    title: 'Private title',
    blobName: 'competition-1/entry-1',
    thumbBlobName: 'competition-1/thumb/entry-1.jpg',
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

function asyncEntities(items: unknown[]) {
  return (async function* () {
    yield* items;
  })();
}

function configureVoteClients(options: {
  status?: 'submissions' | 'voting';
  votingEndsAt?: string | null;
  existingVote?: boolean;
  myVotes?: string[];
}) {
  const competitions = {
    getEntity: vi.fn().mockResolvedValue(competition(options.status ?? 'voting', options.votingEndsAt)),
  };
  const entries = { getEntity: vi.fn().mockResolvedValue(entry()) };
  const votes = {
    getEntity: vi.fn().mockImplementation(async (_partition: string, rowKey: string) => {
      if (options.existingVote && rowKey === 'voter-1_entry-1') {
        return { partitionKey: 'competition-1', rowKey, createdAt: '2026-01-01T00:00:00.000Z' };
      }
      throw { statusCode: 404 };
    }),
    listEntities: vi.fn().mockImplementation(() =>
      asyncEntities((options.myVotes ?? []).map((entryId) => ({
        partitionKey: 'competition-1',
        rowKey: `voter-1_${entryId}`,
        createdAt: '2026-01-01T00:00:00.000Z',
      }))),
    ),
    createEntity: vi.fn().mockResolvedValue(undefined),
  };
  storage.getTableClient.mockImplementation(async (name: string) => {
    if (name === storage.TABLE_NAMES.competitions) return competitions;
    if (name === storage.TABLE_NAMES.entries) return entries;
    return votes;
  });
  return { votes };
}

describe('castVote', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a fourth distinct voting token', async () => {
    const { votes } = configureVoteClients({ myVotes: ['entry-2', 'entry-3', 'entry-4'] });

    await expect(castVote('competition-1', 'voter-1', 'entry-1')).rejects.toMatchObject({
      code: 'token-limit-reached',
    });
    expect(votes.createEntity).not.toHaveBeenCalled();
  });

  it('rejects a second token on the same image', async () => {
    configureVoteClients({ existingVote: true });

    await expect(castVote('competition-1', 'voter-1', 'entry-1')).rejects.toMatchObject({
      code: 'already-voted',
    });
  });

  it('allows a voter to vote for their own approved image', async () => {
    const { votes } = configureVoteClients({});

    await expect(castVote('competition-1', 'voter-1', 'entry-1')).resolves.toBeUndefined();
    expect(votes.createEntity).toHaveBeenCalledOnce();
  });

  it.each([
    ['not in voting status', { status: 'submissions' as const }, 'not-voting'],
    ['after the voting window', { votingEndsAt: '2020-01-01T00:00:00.000Z' }, 'window-closed'],
  ])('rejects votes when %s', async (_description, options, code) => {
    configureVoteClients(options);

    await expect(castVote('competition-1', 'voter-1', 'entry-1')).rejects.toMatchObject({
      code,
    });
  });
});

describe('listApprovedAnonymized', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an entry id, image URLs and dimensions for approved entries, without identifying fields', async () => {
    const entries = {
      listEntities: vi.fn().mockImplementation(() => asyncEntities([entry(), entry('rejected')])),
    };
    storage.getTableClient.mockResolvedValue(entries);
    storage.generateReadSasUrl.mockImplementation(async (blobName: string) =>
      blobName.includes('/thumb/')
        ? 'https://images.test/thumb.jpg'
        : 'https://images.test/full.jpg',
    );

    const listed = await listApprovedAnonymized('competition-1');

    expect(listed).toEqual([
      {
        entryId: 'entry-1',
        thumbUrl: 'https://images.test/thumb.jpg',
        fullUrl: 'https://images.test/full.jpg',
        width: 2000,
        height: 1200,
      },
    ]);
    expect(Object.keys(listed[0]).sort()).toEqual([
      'entryId',
      'fullUrl',
      'height',
      'thumbUrl',
      'width',
    ]);
  });
});
