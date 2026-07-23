# Deployment & GitHub configuration

This guide provisions the production infrastructure and lists **every setting you must provide** to
publish the photography-competition app.

The app runs on exactly **two Azure resources**:

| Resource | Role |
|---|---|
| **Azure Static Web App** (Standard SKU) | Serves the built frontend **and** the managed Functions API (`api/`) same-origin under `/api/*`. |
| **Azure Storage account** | System of record — **Blob** for photos, **Tables** for competitions/entries/votes. |

An optional **Azure AI Content Safety** account pre-screens uploads. Without it, uploads are flagged
for **manual review** (they still work; an admin approves them in the vetting queue).

Sign-in uses the SWA **pre-configured** Entra (Microsoft) provider, so **no app registration
(client id / secret) is required** and you don't need permission to register an Entra application.
Because that provider admits any Microsoft account, access is restricted at the app layer via an
**allowlist** (`ALLOWED_TENANT_IDS` and/or `ALLOWED_EMAIL_DOMAINS`) — see
[Step 2](#step-2--restrict-who-can-sign-in).

> The Bicep template lives in [`infra/main.bicep`](../infra/main.bicep) with sample values in
> [`infra/main.parameters.json`](../infra/main.parameters.json).

---

## Prerequisites

- **Azure CLI** (`az`) logged in: `az login`, then `az account set --subscription <SUB_ID>`.
- Permission to create resources in the target subscription. **No** Entra app-registration
  permission is needed — sign-in uses the SWA pre-configured provider.
- The GitHub repository hosting this code (deploys run from `.github/workflows/azure-static-web-apps.yml`).

---

## Step 1 — Deploy the infrastructure

A single deployment creates everything; there is no separate auth phase because the pre-configured
provider needs no redirect URI or secret.

```bash
# Create a resource group
az group create --name rg-photocomp --location australiaeast

# Deploy storage + Static Web App
az deployment group create \
  --resource-group rg-photocomp \
  --template-file infra/main.bicep \
  --parameters infra/main.parameters.json
```

Note the outputs — you will need the hostname and SWA name next:

```bash
az deployment group show -g rg-photocomp -n main \
  --query properties.outputs.{host:staticWebAppDefaultHostname.value,swa:staticWebAppName.value} -o table
```

To also provision Content Safety, pass `deployContentSafety=true` (endpoint + key are then wired
automatically):

```bash
az deployment group create -g rg-photocomp --template-file infra/main.bicep \
  --parameters infra/main.parameters.json deployContentSafety=true
```

---

## Step 2 — Restrict who can sign in

The pre-configured provider lets **any** Microsoft (work/school or personal) account authenticate,
so restrict access with an allowlist. Set either or both (comma-separated):

- `ALLOWED_EMAIL_DOMAINS` — e.g. `contoso.com,fabrikam.com`. A user is allowed if their
  email/UPN domain matches. **Most reliable** restriction.
- `ALLOWED_TENANT_IDS` — e.g. your Directory (tenant) ID. A user is allowed if their `tid` claim
  matches.

If **both are empty, any signed-in user is allowed.** Admins in `ADMIN_ALLOWLIST` are always
allowed (so you can never lock yourself out).

```bash
# Set the allowlist (either or both)
az staticwebapp appsettings set --name <staticWebAppName> \
  --setting-names ALLOWED_EMAIL_DOMAINS=contoso.com

# …or re-run Bicep declaratively
az deployment group create -g rg-photocomp --template-file infra/main.bicep \
  --parameters infra/main.parameters.json allowedEmailDomains=contoso.com
```

> **Tenant-vs-domain reliability.** Domain gating is enforced directly in the API from the signed-in
> user's email. Tenant-ID gating depends on the `tid` claim reaching the SWA **rolesSource** function
> (`/api/roles`), which assigns an `approved` role — Static Web Apps does **not** forward the full
> claim set to ordinary API functions. Prefer `ALLOWED_EMAIL_DOMAINS` when your allowed users all
> share a domain; use `ALLOWED_TENANT_IDS` for multi-domain tenants.

> `STORAGE_CONNECTION`, `ADMIN_ALLOWLIST`, `ALLOWED_*`, and (if enabled) `CONTENT_SAFETY_*` are set by
> the Bicep deployment from your parameters — you only adjust them by hand to change the allowlist.

---

## Step 3 — Configure GitHub

Deployment is performed by the workflow at `.github/workflows/azure-static-web-apps.yml` on every
push to `main`. It needs **one** repository secret.

### GitHub repository secrets

Add under **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Required | How to obtain |
|---|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | **Yes** | `az staticwebapp secrets list --name <staticWebAppName> --query "properties.apiKey" -o tsv` |
| `GITHUB_TOKEN` | Automatic | Provided by GitHub Actions — **do not** create it. |

```bash
# Retrieve the deployment token
az staticwebapp secrets list --name <staticWebAppName> --query "properties.apiKey" -o tsv
```

Then add it:

```bash
# Using the GitHub CLI (optional)
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --body "<token>"
```

No GitHub **variables** are required. The workflow installs from the public npm registry
(`https://registry.npmjs.org/`) and builds both the frontend and `api/` itself.

---

## Step 4 — Deploy the app

Push to `main` (or re-run the workflow). The action uploads the built frontend (`dist`) and the
managed Functions in `api/`.

```bash
git push origin main
```

Verify:

```bash
# Should return an empty competition list (200 [])
curl https://<your-swa-host>/api/competitions
```

Then open `https://<your-swa-host>/`, sign in, and create the first competition from **Admin**
(available to identifiers listed in `ADMIN_ALLOWLIST`).

---

## Settings reference

### Azure Static Web App — application settings

Set by the Bicep template unless noted. Read by the Functions API at runtime.

| Setting | Required | Set by | Purpose |
|---|---|---|---|
| `STORAGE_CONNECTION` | **Yes** | Bicep | Full storage **account-key** connection string. Used for Table/Blob access **and SAS generation** — a SAS-only or `UseDevelopmentStorage=true` value will not work in production. |
| `ADMIN_ALLOWLIST` | Recommended | Bicep param | Comma-separated admin identifiers (email / UPN / Entra object id), matched case-insensitively. Empty = no admins. Admins are always allowed to sign in (never gated out). |
| `ALLOWED_EMAIL_DOMAINS` | Optional | Bicep param | Comma-separated email domains permitted to sign in (e.g. `contoso.com`). Empty = no domain gating. Most reliable restriction. |
| `ALLOWED_TENANT_IDS` | Optional | Bicep param | Comma-separated Entra tenant IDs permitted to sign in. Empty = no tenant gating. Relies on the `rolesSource` claim forwarding (see Step 2). |
| `CONTENT_SAFETY_ENDPOINT` | Optional | Bicep (if enabled) | Azure AI Content Safety endpoint. If unset, uploads are flagged for **manual review**. |
| `CONTENT_SAFETY_KEY` | Optional | Bicep (if enabled) | Content Safety key (paired with the endpoint). |

> If **both** `ALLOWED_EMAIL_DOMAINS` and `ALLOWED_TENANT_IDS` are empty, any signed-in Microsoft
> account is allowed. Sign-in uses the SWA **pre-configured** provider — no `openIdIssuer`,
> `AAD_CLIENT_ID`, or `AAD_CLIENT_SECRET` is required.

### Frontend build-time variables

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | No | Defaults to `/api` (same-origin). Only override for unusual hosting. Must keep the `VITE_` prefix. |

### Bicep parameters (`infra/main.parameters.json`)

| Parameter | Default | Notes |
|---|---|---|
| `staticWebAppLocation` | `eastasia` | Must be a Static Web Apps-supported region. |
| `staticWebAppName` | generated | Globally unique. |
| `storageAccountName` | generated | 3-24 lowercase alphanumeric, globally unique. |
| `storageSkuName` | `Standard_LRS` | `Standard_LRS` / `Standard_ZRS` / `Standard_GRS`. |
| `adminAllowlist` | `''` | Populates `ADMIN_ALLOWLIST`. |
| `deployContentSafety` | `false` | When `true`, provisions Content Safety and wires `CONTENT_SAFETY_*`. |
| `contentSafetySkuName` | `S0` | `F0` (free, quota-limited) or `S0`. |
| `allowedEmailDomains` | `''` | Populates `ALLOWED_EMAIL_DOMAINS`. Comma-separated email domains. |
| `allowedTenantIds` | `''` | Populates `ALLOWED_TENANT_IDS`. Comma-separated Entra tenant IDs. |

---

## Security notes

- **No secrets in source or the workflow.** The storage connection string is derived from the account
  key inside the deployment and injected as an application setting; nothing sensitive is committed.
  Sign-in uses the pre-configured provider, so there is no Entra client secret to manage.
- SWA managed Functions do **not** support Managed Identity or Key Vault references, so an
  account-key connection string is required by design.
- The `photos` blob container is **private**; images are served only via short-lived read SAS URLs.
- Access is gated server-side: unapproved users receive `403` from the API and a "not permitted"
  screen in the UI, even though the pre-configured provider let them authenticate.
- Rotate the storage key periodically; re-run the Bicep (or `az staticwebapp appsettings set`) to
  update the app settings, and refresh `AZURE_STATIC_WEB_APPS_API_TOKEN` in GitHub if you reset the
  deployment token.
