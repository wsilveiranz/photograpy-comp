// Infrastructure for the photography competition app.
//
// Deploys the TWO Azure resources the app needs:
//   1. Storage account  — Blob (photos) + Tables (competitions/entries/votes) — the system of record.
//   2. Static Web App    — hosts the built frontend AND the managed Functions API (api/) same-origin.
//
// Optionally deploys an Azure AI Content Safety account for image pre-screening. When it is NOT
// deployed (and CONTENT_SAFETY_* are unset), the app flags every upload for manual review instead
// of failing — so the site still works without it.
//
// The Static Web App application settings are configured here from the deployed resources:
//   STORAGE_CONNECTION      (built from the storage account key — required for SAS generation)
//   CONTENT_SAFETY_ENDPOINT / CONTENT_SAFETY_KEY  (only when deployContentSafety = true)
//   ADMIN_ALLOWLIST         (from parameter)
//   ALLOWED_TENANT_IDS / ALLOWED_EMAIL_DOMAINS  (optional access gate — see docs/deployment.md)
//
// Sign-in uses the SWA PRE-CONFIGURED Entra provider (/.auth/login/aad), so NO app registration
// (client id / secret) is required. Because the pre-configured provider admits any Microsoft
// account, access is restricted at the app layer: set ALLOWED_TENANT_IDS and/or
// ALLOWED_EMAIL_DOMAINS to permit only your organisation. Leave both empty to allow any signed-in
// user. See docs/deployment.md (Option B) for the tenant-vs-domain reliability note.
//
// SWA managed Functions cannot use Managed Identity / Key Vault references, so a storage account-key
// connection string is required and is injected as an application setting (never hardcoded in source).

targetScope = 'resourceGroup'

@description('Azure region for the storage account (and Content Safety, if deployed). Defaults to the resource group location.')
param location string = resourceGroup().location

@description('Azure region for the Static Web App. Must be a Static Web Apps-supported region.')
@allowed([
  'westus2'
  'centralus'
  'eastus2'
  'westeurope'
  'eastasia'
  'eastasiastage'
])
param staticWebAppLocation string = 'eastasia'

@description('Globally-unique name for the Static Web App.')
param staticWebAppName string = 'swa-photocomp-${uniqueString(resourceGroup().id)}'

@description('Globally-unique storage account name (3-24 lowercase alphanumeric characters).')
@minLength(3)
@maxLength(24)
param storageAccountName string = toLower('stphoto${uniqueString(resourceGroup().id)}')

@description('Storage account SKU. Standard_LRS is sufficient for a single internal competition site.')
@allowed([
  'Standard_LRS'
  'Standard_ZRS'
  'Standard_GRS'
])
param storageSkuName string = 'Standard_LRS'

@description('Comma-separated list of admin identifiers (email / UPN / Entra object id). Matched case-insensitively against the signed-in principal. Leave empty for no admins until you set it later.')
param adminAllowlist string = ''

@description('Deploy an Azure AI Content Safety account and wire CONTENT_SAFETY_* automatically. If false, uploads are flagged for manual review until you configure a moderation endpoint.')
param deployContentSafety bool = false

@description('Name for the Content Safety account (used only when deployContentSafety = true).')
param contentSafetyName string = 'cs-photocomp-${uniqueString(resourceGroup().id)}'

@description('Content Safety SKU. F0 = free tier (quota-limited), S0 = standard.')
@allowed([
  'F0'
  'S0'
])
param contentSafetySkuName string = 'S0'

@description('Comma-separated Entra tenant IDs allowed to sign in. Leave empty to skip tenant gating. Note: tenant-ID gating relies on the SWA rolesSource claim forwarding — see docs/deployment.md.')
param allowedTenantIds string = ''

@description('Comma-separated email domains allowed to sign in (e.g. "contoso.com,fabrikam.com"). Leave empty to skip domain gating. Domain gating is the most reliable restriction.')
param allowedEmailDomains string = ''

// ---------------------------------------------------------------------------
// Storage account: Blob (photos) + Tables (competitions/entries/votes)
// ---------------------------------------------------------------------------
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: storageSkuName
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false // photos are served via short-lived SAS, never public
    allowSharedKeyAccess: true // required: the app generates SAS with the account key
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

// Private container; the app also calls createIfNotExists at runtime, this just pre-creates it.
resource photosContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'photos'
  properties: {
    publicAccess: 'None'
  }
}

// ---------------------------------------------------------------------------
// Optional: Azure AI Content Safety for image pre-screening
// ---------------------------------------------------------------------------
resource contentSafety 'Microsoft.CognitiveServices/accounts@2023-05-01' = if (deployContentSafety) {
  name: contentSafetyName
  location: location
  kind: 'ContentSafety'
  sku: {
    name: contentSafetySkuName
  }
  properties: {
    customSubDomainName: contentSafetyName
    publicNetworkAccess: 'Enabled'
  }
}

// ---------------------------------------------------------------------------
// Static Web App (Standard SKU — the rolesSource access gate requires Standard)
// ---------------------------------------------------------------------------
resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: staticWebAppLocation
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    // No repository is linked here: deployment is driven by the existing GitHub Action using the
    // deployment token (see docs/deployment.md). Leaving this unlinked avoids the SWA creating its
    // own competing workflow file.
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
  }
}

// Build the application settings map from deployed resources + parameters.
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

var baseSettings = {
  STORAGE_CONNECTION: storageConnectionString
  ADMIN_ALLOWLIST: adminAllowlist
  ALLOWED_TENANT_IDS: allowedTenantIds
  ALLOWED_EMAIL_DOMAINS: allowedEmailDomains
}

var contentSafetySettings = deployContentSafety
  ? {
      CONTENT_SAFETY_ENDPOINT: contentSafety!.properties.endpoint
      CONTENT_SAFETY_KEY: contentSafety!.listKeys().key1
    }
  : {}

resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: staticWebApp
  name: 'appsettings'
  // NOTE: writing 'appsettings' REPLACES the full set, so every setting must be present here.
  properties: union(baseSettings, contentSafetySettings)
}

// ---------------------------------------------------------------------------
// Outputs (non-secret). Retrieve the deployment token separately, see docs.
// ---------------------------------------------------------------------------
@description('Static Web App resource name.')
output staticWebAppName string = staticWebApp.name

@description('Default hostname of the Static Web App (the live site URL host).')
output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname

@description('Storage account name.')
output storageAccountName string = storage.name

@description('Whether a Content Safety account was deployed and wired up.')
output contentSafetyDeployed bool = deployContentSafety
