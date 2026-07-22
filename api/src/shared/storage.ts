import { TableClient } from '@azure/data-tables';
import {
  BlobSASPermissions,
  BlobServiceClient,
  ContainerClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';

export const TABLE_NAMES = {
  competitions: 'Competitions',
  entries: 'Entries',
  votes: 'Votes',
  tieBreakVotes: 'TieBreakVotes',
} as const;

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES];

const PHOTOS_CONTAINER_NAME = 'photos';
const AZURITE_ACCOUNT_NAME = 'devstoreaccount1';
const AZURITE_ACCOUNT_KEY =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

const tableClients = new Map<TableName, Promise<TableClient>>();
let blobServiceClient: BlobServiceClient | undefined;
let photosContainerClient: Promise<ContainerClient> | undefined;
let sharedKeyCredential: StorageSharedKeyCredential | undefined;

export function getStorageConnection(): string {
  const conn = process.env.STORAGE_CONNECTION;
  if (!conn) {
    throw new Error('STORAGE_CONNECTION app setting is not configured');
  }
  return conn;
}

export function getTableClient(name: TableName): Promise<TableClient> {
  const existing = tableClients.get(name);
  if (existing) {
    return existing;
  }

  const initialized = initializeTableClient(name).catch((error: unknown) => {
    tableClients.delete(name);
    throw error;
  });
  tableClients.set(name, initialized);
  return initialized;
}

export function getPhotosContainerClient(): Promise<ContainerClient> {
  if (!photosContainerClient) {
    photosContainerClient = initializePhotosContainerClient().catch((error: unknown) => {
      photosContainerClient = undefined;
      throw error;
    });
  }
  return photosContainerClient;
}

export async function generateReadSasUrl(blobName: string, ttlMinutes: number): Promise<string> {
  if (!blobName) {
    throw new Error('blobName is required');
  }
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) {
    throw new Error('ttlMinutes must be a positive number');
  }

  const container = await getPhotosContainerClient();
  const now = Date.now();
  const sas = generateBlobSASQueryParameters(
    {
      containerName: PHOTOS_CONTAINER_NAME,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(now - 5 * 60_000),
      expiresOn: new Date(now + ttlMinutes * 60_000),
    },
    getSharedKeyCredential(),
  ).toString();

  return `${container.getBlobClient(blobName).url}?${sas}`;
}

async function initializeTableClient(name: TableName): Promise<TableClient> {
  const client = TableClient.fromConnectionString(getStorageConnection(), name);
  await client.createTable();
  return client;
}

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(getStorageConnection());
  }
  return blobServiceClient;
}

async function initializePhotosContainerClient(): Promise<ContainerClient> {
  const client = getBlobServiceClient().getContainerClient(PHOTOS_CONTAINER_NAME);
  await client.createIfNotExists();
  return client;
}

function getSharedKeyCredential(): StorageSharedKeyCredential {
  if (!sharedKeyCredential) {
    const { accountName, accountKey } = parseSharedKeyDetails(getStorageConnection());
    sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  }
  return sharedKeyCredential;
}

function parseSharedKeyDetails(connectionString: string): {
  accountName: string;
  accountKey: string;
} {
  if (/useDevelopmentStorage\s*=\s*true/i.test(connectionString)) {
    return {
      accountName: AZURITE_ACCOUNT_NAME,
      accountKey: AZURITE_ACCOUNT_KEY,
    };
  }

  const settings = new Map<string, string>();
  for (const segment of connectionString.split(';')) {
    const separatorIndex = segment.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    settings.set(
      segment.slice(0, separatorIndex).trim().toLowerCase(),
      segment.slice(separatorIndex + 1).trim(),
    );
  }

  const accountName = settings.get('accountname');
  const accountKey = settings.get('accountkey');
  if (!accountName || !accountKey) {
    throw new Error('STORAGE_CONNECTION must contain AccountName and AccountKey to generate SAS URLs');
  }

  return { accountName, accountKey };
}
