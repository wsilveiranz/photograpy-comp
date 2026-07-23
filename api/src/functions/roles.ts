import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { computeApprovedRoles, normalizeClaims, type PrincipalIdentity } from '../shared/access';

// SWA "rolesSource" endpoint. After sign-in, Static Web Apps POSTs the authenticated user's full
// claim set here (including tenant id / email, which are NOT forwarded to normal API functions) and
// expects `{ "roles": [...] }` back. We assign the `approved` role only to users whose tenant or
// email domain matches the configured allowlist; that role then rides along in the
// x-ms-client-principal header so requireUser can enforce it. See docs/deployment.md (Option B).
export async function roles(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const identity = toIdentity(body);
  const assignedRoles = computeApprovedRoles(identity);

  context.log({
    operation: 'auth.roles',
    identityProvider: readString(body, 'identityProvider'),
    approved: assignedRoles.length > 0,
  });

  return {
    status: 200,
    jsonBody: { roles: assignedRoles },
  };
}

function toIdentity(body: unknown): PrincipalIdentity {
  if (typeof body !== 'object' || body === null) {
    return {};
  }
  const record = body as Record<string, unknown>;
  return {
    userId: readString(record, 'userId'),
    userDetails: readString(record, 'userDetails'),
    claims: normalizeClaims(record.claims),
  };
}

function readString(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

app.http('roles', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'roles',
  handler: roles,
});
