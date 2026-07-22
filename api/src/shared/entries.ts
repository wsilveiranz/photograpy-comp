import { randomUUID } from 'node:crypto';
import type { InvocationContext } from '@azure/functions';
import convertHeic from 'heic-convert';
import sharp from 'sharp';
import type { ClientPrincipal } from './auth';
import { deriveAlias } from './aliases';
import {
  fromCompetitionEntity,
  fromEntryEntity,
  toEntryEntity,
  type CompetitionEntity,
  type EntryEntity,
  type EntryRecord,
  type EntryStatus,
} from './entities';
import { analyzeImage } from './moderation';
import {
  generateReadSasUrl,
  getPhotosContainerClient,
  getTableClient,
  TABLE_NAMES,
} from './storage';
import { validateImage } from './validation';

export interface EntryView extends EntryRecord {
  imageUrl?: string;
  thumbUrl?: string;
}

export interface ListEntriesOptions {
  includeAll: boolean;
}

export interface EntryViewOptions {
  includeUrls: boolean;
}

export type ReviewDecision = Extract<EntryStatus, 'approved' | 'rejected'>;

export class EntryServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const MAX_ENTRIES_PER_USER = 5;
const PREVIEW_LONG_EDGE = 1200;
const SAS_TTL_MINUTES = 15;

export async function uploadEntry(
  competitionId: string,
  principal: ClientPrincipal,
  fileBuffer: Buffer,
  declaredContentType: string,
  title: string,
  context?: Pick<InvocationContext, 'log'>,
): Promise<EntryView> {
  const normalizedCompetitionId = requireValue(competitionId, 'Competition id is required.');
  const normalizedTitle = requireValue(title, 'Title is required.');
  if (normalizedTitle.length > 120) {
    throw new EntryServiceError('Title must be 120 characters or fewer.', 400);
  }

  const competitions = await getTableClient(TABLE_NAMES.competitions);
  let competitionEntity: CompetitionEntity;
  try {
    competitionEntity = (await competitions.getEntity(
      'competition',
      normalizedCompetitionId,
    )) as unknown as CompetitionEntity;
  } catch (error: unknown) {
    if (isNotFound(error)) {
      throw new EntryServiceError('Competition not found.', 404);
    }
    throw error;
  }

  if (fromCompetitionEntity(competitionEntity).status !== 'submissions') {
    throw new EntryServiceError('This competition is not accepting submissions.', 409);
  }

  const entries = await getTableClient(TABLE_NAMES.entries);
  const userFilter = [
    `PartitionKey eq '${escapeOData(normalizedCompetitionId)}'`,
    `userId eq '${escapeOData(principal.userId)}'`,
  ].join(' and ');
  let entryCount = 0;
  for await (const _entity of entries.listEntities({ queryOptions: { filter: userFilter } })) {
    entryCount += 1;
    if (entryCount >= MAX_ENTRIES_PER_USER) {
      throw new EntryServiceError(
        'You have reached the 5-photo limit for this competition. Rejected entries still count.',
        409,
      );
    }
  }

  const validation = validateImage(fileBuffer, declaredContentType);
  if (!validation.valid) {
    throw new EntryServiceError(validation.error, 400);
  }

  const entryId = randomUUID();
  const blobName = `${normalizedCompetitionId}/${entryId}`;
  const thumbBlobName = `${normalizedCompetitionId}/thumb/${entryId}.jpg`;
  const previewBuffer = await createPreview(fileBuffer, validation.contentType);
  const moderation = await analyzeImage(previewBuffer, (details) =>
    context?.log({
      ...details,
      competitionId: normalizedCompetitionId,
      entryId,
      userId: principal.userId,
    }),
  );
  const uploadedAt = new Date().toISOString();
  const record: EntryRecord = {
    id: entryId,
    competitionId: normalizedCompetitionId,
    userId: principal.userId,
    userAlias: deriveAlias(principal),
    title: normalizedTitle,
    blobName,
    thumbBlobName,
    contentType: validation.contentType,
    width: validation.width,
    height: validation.height,
    sizeBytes: validation.sizeBytes,
    status: 'pending',
    moderation: moderation.severities,
    flagged: moderation.flagged,
    uploadedAt,
    reviewedAt: null,
    reviewedBy: null,
  };
  const view = await toEntryView(record, { includeUrls: true });

  const container = await getPhotosContainerClient();
  const originalBlob = container.getBlockBlobClient(blobName);
  const previewBlob = container.getBlockBlobClient(thumbBlobName);
  let originalUploaded = false;
  let previewUploaded = false;
  try {
    await originalBlob.uploadData(fileBuffer, {
      blobHTTPHeaders: { blobContentType: validation.contentType },
    });
    originalUploaded = true;
    await previewBlob.uploadData(previewBuffer, {
      blobHTTPHeaders: { blobContentType: 'image/jpeg' },
    });
    previewUploaded = true;
    await entries.createEntity(toEntryEntity(record));
  } catch (error: unknown) {
    await Promise.allSettled([
      ...(originalUploaded ? [originalBlob.deleteIfExists()] : []),
      ...(previewUploaded ? [previewBlob.deleteIfExists()] : []),
    ]);
    throw error;
  }

  return view;
}

export async function listEntriesForCompetition(
  competitionId: string,
  options: ListEntriesOptions,
): Promise<EntryView[]> {
  const entries = await getTableClient(TABLE_NAMES.entries);
  const filters = [`PartitionKey eq '${escapeOData(competitionId)}'`];
  if (!options.includeAll) {
    filters.push(`status eq 'approved'`);
  }
  const records: EntryRecord[] = [];
  for await (const entity of entries.listEntities({
    queryOptions: { filter: filters.join(' and ') },
  })) {
    records.push(fromEntryEntity(entity as unknown as EntryEntity));
  }
  records.sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
  return Promise.all(records.map((record) => toEntryView(record, { includeUrls: true })));
}

export async function listMyEntries(
  competitionId: string,
  userId: string,
): Promise<EntryView[]> {
  const entries = await getTableClient(TABLE_NAMES.entries);
  const filter = [
    `PartitionKey eq '${escapeOData(competitionId)}'`,
    `userId eq '${escapeOData(userId)}'`,
  ].join(' and ');
  const records: EntryRecord[] = [];
  for await (const entity of entries.listEntities({ queryOptions: { filter } })) {
    records.push(fromEntryEntity(entity as unknown as EntryEntity));
  }
  records.sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
  return Promise.all(records.map((record) => toEntryView(record, { includeUrls: true })));
}

export async function reviewEntry(
  competitionId: string,
  entryId: string,
  decision: ReviewDecision,
  reviewerId: string,
): Promise<EntryView> {
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new EntryServiceError('Decision must be approved or rejected.', 400);
  }

  const entries = await getTableClient(TABLE_NAMES.entries);
  const record = await getEntryRecord(entries, competitionId, entryId);
  record.status = decision;
  record.reviewedAt = new Date().toISOString();
  record.reviewedBy = reviewerId;
  const view = await toEntryView(record, { includeUrls: true });
  await entries.updateEntity(toEntryEntity(record), 'Replace');
  return view;
}

export async function getEntryImageUrl(
  competitionId: string,
  entryId: string,
  variant: 'thumb' | 'original',
): Promise<string> {
  const entries = await getTableClient(TABLE_NAMES.entries);
  const record = await getEntryRecord(entries, competitionId, entryId);
  return generateReadSasUrl(
    variant === 'thumb' ? record.thumbBlobName : record.blobName,
    SAS_TTL_MINUTES,
  );
}

export async function toEntryView(
  record: EntryRecord,
  options: EntryViewOptions,
): Promise<EntryView> {
  if (!options.includeUrls) {
    return { ...record };
  }
  const [imageUrl, thumbUrl] = await Promise.all([
    generateReadSasUrl(record.blobName, SAS_TTL_MINUTES),
    generateReadSasUrl(record.thumbBlobName, SAS_TTL_MINUTES),
  ]);
  return { ...record, imageUrl, thumbUrl };
}

async function createPreview(fileBuffer: Buffer, contentType: string): Promise<Buffer> {
  const previewSource =
    contentType === 'image/heic' || contentType === 'image/heif'
      ? Buffer.from(
          await convertHeic({
            buffer: fileBuffer,
            format: 'JPEG',
            quality: 0.95,
          }),
        )
      : fileBuffer;

  return sharp(previewSource)
    .rotate()
    .resize({
      width: PREVIEW_LONG_EDGE,
      height: PREVIEW_LONG_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

async function getEntryRecord(
  entries: Awaited<ReturnType<typeof getTableClient>>,
  competitionId: string,
  entryId: string,
): Promise<EntryRecord> {
  try {
    const entity = (await entries.getEntity(
      competitionId,
      entryId,
    )) as unknown as EntryEntity;
    return fromEntryEntity(entity);
  } catch (error: unknown) {
    if (isNotFound(error)) {
      throw new EntryServiceError('Entry not found.', 404);
    }
    throw error;
  }
}

function requireValue(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new EntryServiceError(message, 400);
  }
  return normalized;
}

function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    error.statusCode === 404
  );
}
