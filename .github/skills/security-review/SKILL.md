---
name: security-review
description: "Use when a change touches credentials, secrets, configuration, authentication/authorization, storage access (connection strings, SAS/keys), or content moderation — to review secure-by-default compliance. Complements the automated secret-scan preToolUse hook by handling judgment calls the regex gate cannot (e.g. subtle config leaks, missing fail-closed behaviour, over-broad SAS, authz gaps)."
---

# security-review

A focused secure-by-default review for this repo. The deterministic `secret-scan` preToolUse hook
blocks obvious hardcoded secrets in `src/**` / `api/src/**`; this skill covers the judgment calls it
cannot, and should be invoked whenever a change touches security-sensitive surfaces.

## When to invoke

- Any edit to `api/src/shared/storage.ts`, `auth.ts`, `moderation.ts`, or code that reads config
  (`process.env`, `getStorageConnection()`), builds connection strings, or mints SAS URLs.
- Auth/authorization changes (admin allow-list, `requireUser`/`requireAdmin`, route roles,
  `staticwebapp.config.json`).
- Anything handling uploaded image bytes, content moderation, or user PII (email/OID/alias).
- When the secret-scan hook fires and you believe it is a false positive — review before exempting.

## Secure-by-default principles (repo invariants)

1. **No credentials or config literals in source — ever, including Azurite.** All secrets/config come
   from runtime configuration (app settings / env), read via `getStorageConnection()` or
   `process.env`. Local emulator values live only in the gitignored `api/local.settings.json`.
2. **No Managed Identity / Key Vault refs** (unsupported by SWA managed Functions) — connection
   string via the `STORAGE_CONNECTION` app setting only.
3. **Fail closed.** Missing/invalid config throws a clear, actionable error; never silently fall back
   to a default account, key, or empty allow-list that grants access.
4. **Least privilege, short-lived access.** Image access uses short-lived **read-only** SAS
   (minutes, `r` permission, scoped to the exact blob) — never public containers, account SAS, or
   long-lived/write SAS handed to the browser.
5. **Server-side authz + business rules.** Admin checks (allow-list), the 5-photo limit, the 3-token
   cap, and status/window gating are enforced in Functions, not just the UI.
6. **Anonymization.** Voter-facing payloads expose only `entryId` + `thumbUrl`; never `userId`,
   email, or alias until winners are revealed.
7. **Never log secrets or raw image bytes.** Structured logs carry `operation` + ids only.

## Review checklist

- [ ] No secret/connection string/key/token literal in `src/**` or `api/src/**` (grep for
      `AccountKey=`, `-----BEGIN`, `AKIA`, `gh[pousr]_`, `AIza`, `xox[baprs]-`, hardcoded `sig=`).
- [ ] Config read exclusively from `process.env` / `getStorageConnection()`; nothing defaulted to a
      real credential.
- [ ] Missing config path **throws** (fail closed) rather than degrading to insecure behaviour.
- [ ] SAS is read-only, blob-scoped, and short-lived; SAS/URLs are not logged.
- [ ] Admin/authorization enforced server-side; allow-list empty ⇒ deny, not allow-all.
- [ ] No user identity (userId/email/alias) leaks in anonymized/voter responses.
- [ ] Uploaded content validated (type/size/dimensions) before storage; moderation failures do not
      silently approve.
- [ ] No secret or PII written to logs.

## Output

Report only concrete, high-confidence issues with file:line and a secure fix. Do not flag style or
non-security concerns. If clean, say so explicitly.
