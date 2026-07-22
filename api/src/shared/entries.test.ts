import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  getTableClient: vi.fn(),
  getPhotosContainerClient: vi.fn(),
  generateReadSasUrl: vi.fn(),
  TABLE_NAMES: {
    competitions: 'Competitions',
    entries: 'Entries',
    votes: 'Votes',
    tieBreakVotes: 'TieBreakVotes',
  },
}));

vi.mock('./storage', () => storage);

import { EntryServiceError, uploadEntry } from './entries';

const competition = {
  partitionKey: 'competition',
  rowKey: 'competition-1',
  name: 'Competition',
  status: 'submissions' as const,
  prizeDescription: 'Prize',
  prizeBlobName: '',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function entries(count: number) {
  return {
    listEntities: vi.fn(async function* () {
      for (let index = 0; index < count; index += 1) {
        yield {
          partitionKey: 'competition-1',
          rowKey: `entry-${index}`,
          userId: 'user-1',
          status: index === 4 ? 'rejected' : 'approved',
        };
      }
    }),
  };
}

describe('uploadEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects the sixth upload, including when one existing entry was rejected', async () => {
    const competitions = { getEntity: vi.fn().mockResolvedValue(competition) };
    const entryClient = entries(5);
    storage.getTableClient.mockImplementation(async (name: string) =>
      name === storage.TABLE_NAMES.competitions ? competitions : entryClient,
    );

    await expect(
      uploadEntry(
        'competition-1',
        { userId: 'user-1', userDetails: 'person@example.test', claims: [], roles: [] },
        Buffer.from('not reached'),
        'image/png',
        'Sixth photo',
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: 'You have reached the 5-photo limit for this competition. Rejected entries still count.',
    });
  });
});
