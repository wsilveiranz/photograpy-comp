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

import {
  CompetitionError,
  createCompetition,
  updateStatus,
} from './competitions';

function asyncEntities(items: unknown[]) {
  return (async function* () {
    yield* items;
  })();
}

function competition(status: 'submissions' | 'voting' | 'closed') {
  return {
    partitionKey: 'competition',
    rowKey: 'competition-1',
    name: 'Competition',
    status,
    prizeDescription: 'Prize',
    prizeBlobName: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('competitions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prevents creating a second active competition', async () => {
    const table = {
      listEntities: vi.fn().mockImplementation(() => asyncEntities([competition('submissions')])),
      createEntity: vi.fn(),
    };
    storage.getTableClient.mockResolvedValue(table);

    await expect(
      createCompetition({ name: 'Another competition', prizeDescription: 'Prize' }),
    ).rejects.toMatchObject({ code: 'active_competition_exists' });
    expect(table.createEntity).not.toHaveBeenCalled();
  });

  it('allows submissions to transition to voting only with an ordered window', async () => {
    const table = {
      getEntity: vi.fn().mockResolvedValue(competition('submissions')),
      updateEntity: vi.fn().mockResolvedValue(undefined),
    };
    storage.getTableClient.mockResolvedValue(table);

    const updated = await updateStatus('competition-1', {
      action: 'openVoting',
      votingStartsAt: '2026-02-01T10:00:00.000Z',
      votingEndsAt: '2026-02-01T11:00:00.000Z',
    });

    expect(updated).toMatchObject({
      status: 'voting',
      votingStartsAt: '2026-02-01T10:00:00.000Z',
      votingEndsAt: '2026-02-01T11:00:00.000Z',
    });
    await expect(
      updateStatus('competition-1', {
        action: 'openVoting',
        votingStartsAt: '2026-02-01T11:00:00.000Z',
        votingEndsAt: '2026-02-01T10:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('rejects invalid lifecycle transitions', async () => {
    const table = {
      getEntity: vi.fn().mockResolvedValue(competition('closed')),
      updateEntity: vi.fn(),
    };
    storage.getTableClient.mockResolvedValue(table);

    await expect(updateStatus('competition-1', { action: 'toTiebreak' })).rejects.toMatchObject({
      code: 'invalid_transition',
    });
  });
});
