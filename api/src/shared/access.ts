import type { ClientPrincipalClaim } from './auth';

// Custom role assigned (by the rolesSource function) to users whose sign-in matches the configured
// tenant/domain allowlist. The x-ms-client-principal header forwards userRoles to the backend, so
// requireUser can honour this decision even though the full claim set is not forwarded.
export const APPROVED_ROLE = 'approved';

const TENANT_CLAIM_TYPES = new Set([
  'tid',
  'http://schemas.microsoft.com/identity/claims/tenantid',
]);

const EMAIL_CLAIM_TYPES = new Set([
  'email',
  'emails',
  'preferred_username',
  'upn',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
]);

export interface AccessPolicy {
  tenantIds: Set<string>;
  domains: Set<string>;
  restricted: boolean;
}

export interface PrincipalIdentity {
  userId?: string;
  userDetails?: string;
  claims?: ClientPrincipalClaim[];
}

// Reads ALLOWED_TENANT_IDS and ALLOWED_EMAIL_DOMAINS (comma-separated). When neither is set the
// policy is "unrestricted": any authenticated user is allowed (matches the "if provided" semantics).
export function getAccessPolicy(env: NodeJS.ProcessEnv = process.env): AccessPolicy {
  const tenantIds = new Set(parseList(env.ALLOWED_TENANT_IDS));
  const domains = new Set(parseList(env.ALLOWED_EMAIL_DOMAINS).map(stripLeadingAt));
  return {
    tenantIds,
    domains,
    restricted: tenantIds.size > 0 || domains.size > 0,
  };
}

export function extractTenantId(claims: ClientPrincipalClaim[] = []): string | undefined {
  const match = claims.find((claim) => TENANT_CLAIM_TYPES.has(claim.type.toLowerCase()))?.value;
  return normalize(match);
}

export function extractEmailDomain(identity: PrincipalIdentity): string | undefined {
  const candidates = [
    identity.userDetails,
    ...(identity.claims ?? [])
      .filter((claim) => EMAIL_CLAIM_TYPES.has(claim.type.toLowerCase()))
      .map((claim) => claim.value),
  ];
  for (const candidate of candidates) {
    const domain = domainOf(candidate);
    if (domain) {
      return domain;
    }
  }
  return undefined;
}

// True if the identity satisfies the policy. An unrestricted policy always returns true; otherwise
// the identity must match at least one configured allowlist (tenant id OR email domain).
export function isIdentityAllowed(
  identity: PrincipalIdentity,
  policy: AccessPolicy = getAccessPolicy(),
): boolean {
  if (!policy.restricted) {
    return true;
  }
  const tenantId = extractTenantId(identity.claims);
  if (tenantId && policy.tenantIds.has(tenantId)) {
    return true;
  }
  const domain = extractEmailDomain(identity);
  if (domain && policy.domains.has(domain)) {
    return true;
  }
  return false;
}

// Roles emitted by the SWA rolesSource function. Only assigns the approved role when the policy is
// restricted and the identity matches; an unrestricted policy needs no custom role.
export function computeApprovedRoles(
  identity: PrincipalIdentity,
  policy: AccessPolicy = getAccessPolicy(),
): string[] {
  if (!policy.restricted) {
    return [];
  }
  return isIdentityAllowed(identity, policy) ? [APPROVED_ROLE] : [];
}

// Normalises the claim shapes SWA can send: {type,value} (backend) and {typ,val} (rolesSource body).
export function normalizeClaims(value: unknown): ClientPrincipalClaim[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((claim): ClientPrincipalClaim[] => {
    if (typeof claim !== 'object' || claim === null) {
      return [];
    }
    const record = claim as Record<string, unknown>;
    const type = stringOf(record.type) ?? stringOf(record.typ);
    const claimValue = stringOf(record.value) ?? stringOf(record.val);
    return type && claimValue ? [{ type, value: claimValue }] : [];
  });
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function stripLeadingAt(value: string): string {
  return value.startsWith('@') ? value.slice(1) : value;
}

function domainOf(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const at = value.lastIndexOf('@');
  if (at < 0) {
    return undefined;
  }
  return normalize(value.slice(at + 1));
}

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

function stringOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
