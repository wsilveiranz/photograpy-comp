import { randomUUID } from 'node:crypto';
import type { CompetitionEntity } from './entities';
import {
  fromCompetitionEntity,
  toCompetitionEntity,
  type CompetitionRecord,
} from './entities';
import {
  generateReadSasUrl,
  getPhotosContainerClient,
  getTableClient,
  TABLE_NAMES,
} from './storage';
import { validateImage } from './validation';

const COMPETITION_PARTITION_KEY = 'competition';
const PRIZE_SAS_TTL_MINUTES = 60;

export interface Competition {
  id: string;
  name: string;
  status: CompetitionRecord['status'];
  prizeDescription: string;
  prizeImageUrl: string | null;
  votingStartsAt: string | null;
  votingEndsAt: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface CreateCompetitionInput {
  name: string;
  prizeDescription: string;
}

export type CompetitionStatusAction =
  | {
      action: 'openVoting';
      votingStartsAt: string;
      votingEndsAt: string;
    }
  | { action: 'toTiebreak' | 'close' | 'forceClose' };

export type CompetitionErrorCode =
  | 'active_competition_exists'
  | 'competition_not_found'
  | 'invalid_transition'
  | 'validation_error';

export class CompetitionError extends Error {
  constructor(
    public readonly code: CompetitionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CompetitionError';
  }
}

export async function createCompetition(
  input: CreateCompetitionInput,
): Promise<CompetitionRecord> {
  const name = requireText(input.name, 'Competition name');
  const prizeDescription = requireText(input.prizeDescription, 'Prize description');
  const existing = await listCompetitions();

  if (existing.some((competition) => competition.status !== 'closed')) {
    throw new CompetitionError(
      'active_competition_exists',
      'An active competition already exists.',
    );
  }

  const record: CompetitionRecord = {
    id: randomUUID(),
    name,
    status: 'submissions',
    prizeDescription,
    prizeBlobName: '',
    votingStartsAt: null,
    votingEndsAt: null,
    createdAt: new Date().toISOString(),
    closedAt: null,
  };

  const table = await getTableClient(TABLE_NAMES.competitions);
  await table.createEntity(toCompetitionEntity(record));
  return record;
}

export async function getCompetition(id: string): Promise<CompetitionRecord | null> {
  const competitionId = requireText(id, 'Competition id');
  const table = await getTableClient(TABLE_NAMES.competitions);

  try {
    const entity = await table.getEntity<CompetitionEntity>(
      COMPETITION_PARTITION_KEY,
      competitionId,
    );
    return fromCompetitionEntity(entity);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function listCompetitions(): Promise<CompetitionRecord[]> {
  const table = await getTableClient(TABLE_NAMES.competitions);
  const records: CompetitionRecord[] = [];
  const entities = table.listEntities<CompetitionEntity>({
    queryOptions: { filter: `PartitionKey eq '${COMPETITION_PARTITION_KEY}'` },
  });

  for await (const entity of entities) {
    records.push(fromCompetitionEntity(entity));
  }

  return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function updateStatus(
  id: string,
  statusAction: CompetitionStatusAction,
): Promise<CompetitionRecord> {
  const record = await requireCompetition(id);
  const updated = applyStatusAction(record, statusAction);
  const table = await getTableClient(TABLE_NAMES.competitions);
  await table.updateEntity(toCompetitionEntity(updated), 'Replace');
  return updated;
}

export async function setPrize(
  id: string,
  imageBuffer: Buffer,
  contentType: string,
  description: string,
): Promise<CompetitionRecord> {
  const record = await requireCompetition(id);
  const prizeDescription = requireText(description, 'Prize description');
  const validation = validateImage(imageBuffer, contentType);

  if (!validation.valid) {
    throw new CompetitionError('validation_error', validation.error);
  }

  const blobName = `prizes/${record.id}`;
  const container = await getPhotosContainerClient();
  await container.getBlockBlobClient(blobName).uploadData(imageBuffer, {
    blobHTTPHeaders: { blobContentType: validation.contentType },
  });

  const updated: CompetitionRecord = {
    ...record,
    prizeBlobName: blobName,
    prizeDescription,
  };
  const table = await getTableClient(TABLE_NAMES.competitions);
  await table.updateEntity(toCompetitionEntity(updated), 'Replace');
  return updated;
}

export async function toCompetitionView(record: CompetitionRecord): Promise<Competition> {
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    prizeDescription: record.prizeDescription,
    prizeImageUrl: record.prizeBlobName
      ? await generateReadSasUrl(record.prizeBlobName, PRIZE_SAS_TTL_MINUTES)
      : null,
    votingStartsAt: record.votingStartsAt,
    votingEndsAt: record.votingEndsAt,
    createdAt: record.createdAt,
    closedAt: record.closedAt,
  };
}

async function requireCompetition(id: string): Promise<CompetitionRecord> {
  const record = await getCompetition(id);
  if (!record) {
    throw new CompetitionError('competition_not_found', 'Competition not found.');
  }
  return record;
}

function applyStatusAction(
  record: CompetitionRecord,
  statusAction: CompetitionStatusAction,
): CompetitionRecord {
  if (statusAction.action === 'openVoting') {
    if (record.status !== 'submissions') {
      throw invalidTransition(record, statusAction.action);
    }

    const votingStartsAt = parseTimestamp(statusAction.votingStartsAt, 'Voting start');
    const votingEndsAt = parseTimestamp(statusAction.votingEndsAt, 'Voting end');
    if (Date.parse(votingEndsAt) <= Date.parse(votingStartsAt)) {
      throw new CompetitionError(
        'validation_error',
        'Voting end must be after voting start.',
      );
    }

    return {
      ...record,
      status: 'voting',
      votingStartsAt,
      votingEndsAt,
    };
  }

  if (statusAction.action === 'toTiebreak') {
    if (record.status !== 'voting') {
      throw invalidTransition(record, statusAction.action);
    }
    return { ...record, status: 'tiebreak' };
  }

  if (record.status !== 'voting' && record.status !== 'tiebreak') {
    throw invalidTransition(record, statusAction.action);
  }

  return {
    ...record,
    status: 'closed',
    closedAt: new Date().toISOString(),
  };
}

function invalidTransition(
  record: CompetitionRecord,
  action: CompetitionStatusAction['action'],
): CompetitionError {
  return new CompetitionError(
    'invalid_transition',
    `Cannot apply ${action} while competition is ${record.status}.`,
  );
}

function parseTimestamp(value: string, fieldName: string): string {
  const timestamp = Date.parse(value);
  if (!value || Number.isNaN(timestamp)) {
    throw new CompetitionError('validation_error', `${fieldName} must be a valid date and time.`);
  }
  return new Date(timestamp).toISOString();
}

function requireText(value: string, fieldName: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new CompetitionError('validation_error', `${fieldName} is required.`);
  }
  return normalized;
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as { statusCode?: unknown; code?: unknown };
  return candidate.statusCode === 404 || candidate.code === 'ResourceNotFound';
}
