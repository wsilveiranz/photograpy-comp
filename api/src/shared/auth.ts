import type { HttpRequest, HttpResponseInit } from '@azure/functions';

export interface ClientPrincipalClaim {
  type: string;
  value: string;
}

export interface ClientPrincipal {
  userId: string;
  userDetails: string;
  claims: ClientPrincipalClaim[];
  roles: string[];
}

export type AuthResult = ClientPrincipal | HttpResponseInit;

export function parseClientPrincipal(request: HttpRequest): ClientPrincipal | null {
  const encodedPrincipal = request.headers.get('x-ms-client-principal');
  if (!encodedPrincipal) {
    return null;
  }

  try {
    const parsed = parseHeaderValue(encodedPrincipal);
    return normalizePrincipal(unwrapPrincipal(parsed));
  } catch {
    return null;
  }
}

export function isAdmin(principal: ClientPrincipal): boolean {
  const allowList = new Set(
    (process.env.ADMIN_ALLOWLIST ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  if (allowList.size === 0) {
    return false;
  }

  const adminClaimTypes = new Set([
    'oid',
    'objectidentifier',
    'nameidentifier',
    'preferred_username',
    'email',
    'emails',
    'upn',
    'http://schemas.microsoft.com/identity/claims/objectidentifier',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
  ]);
  const identifiers = [
    principal.userId,
    ...(principal.userDetails.includes('@') ? [principal.userDetails] : []),
    ...principal.claims
      .filter((claim) => adminClaimTypes.has(claim.type.toLowerCase()))
      .map((claim) => claim.value),
  ].map((value) => value.trim().toLowerCase());

  return identifiers.some((identifier) => allowList.has(identifier));
}

export function requireUser(request: HttpRequest): AuthResult {
  return (
    parseClientPrincipal(request) ?? {
      status: 401,
      jsonBody: { error: 'Authentication required' },
    }
  );
}

export function requireAdmin(request: HttpRequest): AuthResult {
  const principal = parseClientPrincipal(request);
  if (!principal) {
    return {
      status: 401,
      jsonBody: { error: 'Authentication required' },
    };
  }
  if (!isAdmin(principal)) {
    return {
      status: 403,
      jsonBody: { error: 'Administrator access required' },
    };
  }
  return principal;
}

export function isAuthError(result: AuthResult): result is HttpResponseInit {
  return 'status' in result;
}

function parseHeaderValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed) as unknown;
  }

  const normalizedBase64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(normalizedBase64, 'base64').toString('utf8')) as unknown;
}

function unwrapPrincipal(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.length > 0 ? unwrapPrincipal(value[0]) : null;
  }
  if (!isRecord(value)) {
    return null;
  }
  if ('clientPrincipal' in value) {
    return value.clientPrincipal;
  }
  return value;
}

function normalizePrincipal(value: unknown): ClientPrincipal | null {
  if (!isRecord(value)) {
    return null;
  }

  const claims = normalizeClaims(value.claims);
  const userId =
    getString(value, 'userId') ??
    findClaim(claims, [
      'oid',
      'objectidentifier',
      'nameidentifier',
      'sub',
      'http://schemas.microsoft.com/identity/claims/objectidentifier',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
    ]);
  if (!userId) {
    return null;
  }

  const userDetails =
    getString(value, 'userDetails') ??
    findClaim(claims, [
      'preferred_username',
      'email',
      'emails',
      'upn',
      'name',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    ]) ??
    userId;

  const roleValues = [
    ...normalizeStringArray(value.roles),
    ...normalizeStringArray(value.userRoles),
  ];

  return {
    userId,
    userDetails,
    claims,
    roles: [...new Set(roleValues)],
  };
}

function normalizeClaims(value: unknown): ClientPrincipalClaim[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((claim): ClientPrincipalClaim[] => {
    if (!isRecord(claim)) {
      return [];
    }
    const type = getString(claim, 'type') ?? getString(claim, 'typ');
    const claimValue = getString(claim, 'value') ?? getString(claim, 'val');
    return type && claimValue ? [{ type, value: claimValue }] : [];
  });
}

function findClaim(claims: ClientPrincipalClaim[], types: string[]): string | undefined {
  const acceptedTypes = new Set(types.map((type) => type.toLowerCase()));
  return claims.find((claim) => acceptedTypes.has(claim.type.toLowerCase()))?.value;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
