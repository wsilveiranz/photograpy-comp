// Shared backend logic: Azure Table/Blob clients, validation, and business rules
// (e.g. the 5-photo-per-competition limit, vote gating by competition status).
//
// The app and the Functions share a SINGLE Azure Storage account. Because Static Web Apps
// managed Functions do NOT support Managed Identity, the account is reached via a
// connection string in the `STORAGE_CONNECTION` app setting (locally: Azurite via
// `UseDevelopmentStorage=true`).
//
// Construct storage clients ONCE from this value and reuse them — never per request.
// Placeholder shell: no real implementation yet.

export function getStorageConnection(): string {
  const conn = process.env.STORAGE_CONNECTION;
  if (!conn) {
    throw new Error('STORAGE_CONNECTION app setting is not configured');
  }
  return conn;
}
