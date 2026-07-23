import { describe, expect, it } from 'vitest';
import {
  APPROVED_ROLE,
  computeApprovedRoles,
  extractEmailDomain,
  extractTenantId,
  getAccessPolicy,
  isIdentityAllowed,
  normalizeClaims,
  type PrincipalIdentity,
} from './access';

const CONTOSO_TENANT = '11111111-1111-1111-1111-111111111111';

function policy(env: Record<string, string | undefined>) {
  return getAccessPolicy(env as NodeJS.ProcessEnv);
}

describe('getAccessPolicy', () => {
  it('is unrestricted when no allowlists are configured', () => {
    const result = policy({});
    expect(result.restricted).toBe(false);
    expect(result.tenantIds.size).toBe(0);
    expect(result.domains.size).toBe(0);
  });

  it('parses comma-separated tenant ids and domains, lowercased', () => {
    const result = policy({
      ALLOWED_TENANT_IDS: ` ${CONTOSO_TENANT.toUpperCase()} , `,
      ALLOWED_EMAIL_DOMAINS: '@Contoso.com, Fabrikam.COM',
    });
    expect(result.restricted).toBe(true);
    expect(result.tenantIds.has(CONTOSO_TENANT)).toBe(true);
    expect(result.domains.has('contoso.com')).toBe(true);
    expect(result.domains.has('fabrikam.com')).toBe(true);
  });
});

describe('extractTenantId', () => {
  it('reads the tid claim regardless of casing', () => {
    expect(extractTenantId([{ type: 'TID', value: CONTOSO_TENANT.toUpperCase() }])).toBe(
      CONTOSO_TENANT,
    );
  });

  it('reads the long-form tenant claim type', () => {
    expect(
      extractTenantId([
        {
          type: 'http://schemas.microsoft.com/identity/claims/tenantid',
          value: CONTOSO_TENANT,
        },
      ]),
    ).toBe(CONTOSO_TENANT);
  });

  it('returns undefined when no tenant claim is present', () => {
    expect(extractTenantId([{ type: 'name', value: 'Ada' }])).toBeUndefined();
  });
});

describe('extractEmailDomain', () => {
  it('derives the domain from userDetails', () => {
    expect(extractEmailDomain({ userDetails: 'Ada@Contoso.com' })).toBe('contoso.com');
  });

  it('falls back to an email claim when userDetails is not an email', () => {
    expect(
      extractEmailDomain({
        userDetails: 'Ada Lovelace',
        claims: [{ type: 'email', value: 'ada@fabrikam.com' }],
      }),
    ).toBe('fabrikam.com');
  });

  it('returns undefined when there is no email anywhere', () => {
    expect(extractEmailDomain({ userDetails: 'Ada Lovelace' })).toBeUndefined();
  });
});

describe('isIdentityAllowed', () => {
  it('allows anyone when the policy is unrestricted', () => {
    expect(isIdentityAllowed({ userDetails: 'anyone@example.com' }, policy({}))).toBe(true);
  });

  it('allows a matching tenant id', () => {
    const identity: PrincipalIdentity = {
      userDetails: 'ada@other.com',
      claims: [{ type: 'tid', value: CONTOSO_TENANT }],
    };
    expect(isIdentityAllowed(identity, policy({ ALLOWED_TENANT_IDS: CONTOSO_TENANT }))).toBe(true);
  });

  it('allows a matching email domain (bare or @-prefixed config)', () => {
    const identity: PrincipalIdentity = { userDetails: 'ada@contoso.com' };
    expect(isIdentityAllowed(identity, policy({ ALLOWED_EMAIL_DOMAINS: 'contoso.com' }))).toBe(true);
    expect(isIdentityAllowed(identity, policy({ ALLOWED_EMAIL_DOMAINS: '@contoso.com' }))).toBe(
      true,
    );
  });

  it('blocks an identity that matches neither tenant nor domain', () => {
    const identity: PrincipalIdentity = {
      userDetails: 'ada@intruder.com',
      claims: [{ type: 'tid', value: 'deadbeef' }],
    };
    expect(
      isIdentityAllowed(
        identity,
        policy({ ALLOWED_TENANT_IDS: CONTOSO_TENANT, ALLOWED_EMAIL_DOMAINS: 'contoso.com' }),
      ),
    ).toBe(false);
  });
});

describe('computeApprovedRoles', () => {
  it('assigns no custom role when unrestricted', () => {
    expect(computeApprovedRoles({ userDetails: 'ada@contoso.com' }, policy({}))).toEqual([]);
  });

  it('assigns the approved role on a match', () => {
    expect(
      computeApprovedRoles(
        { userDetails: 'ada@contoso.com' },
        policy({ ALLOWED_EMAIL_DOMAINS: 'contoso.com' }),
      ),
    ).toEqual([APPROVED_ROLE]);
  });

  it('assigns an empty role list on a miss', () => {
    expect(
      computeApprovedRoles(
        { userDetails: 'ada@intruder.com' },
        policy({ ALLOWED_EMAIL_DOMAINS: 'contoso.com' }),
      ),
    ).toEqual([]);
  });
});

describe('normalizeClaims', () => {
  it('accepts the {typ,val} shape sent by the rolesSource body', () => {
    expect(normalizeClaims([{ typ: 'tid', val: CONTOSO_TENANT }])).toEqual([
      { type: 'tid', value: CONTOSO_TENANT },
    ]);
  });

  it('accepts the {type,value} shape and drops malformed entries', () => {
    expect(
      normalizeClaims([
        { type: 'email', value: 'ada@contoso.com' },
        { type: 'broken' },
        'nonsense',
        null,
      ]),
    ).toEqual([{ type: 'email', value: 'ada@contoso.com' }]);
  });

  it('returns an empty array for non-array input', () => {
    expect(normalizeClaims(undefined)).toEqual([]);
    expect(normalizeClaims('claims')).toEqual([]);
  });
});
