import { describe, expect, it } from 'vitest';
import { getDisplayName, type ClientPrincipal } from './auth';

function principal(overrides: Partial<ClientPrincipal> = {}): ClientPrincipal {
  return {
    userId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    userDetails: '',
    claims: [],
    roles: [],
    ...overrides,
  };
}

describe('getDisplayName', () => {
  it('prefers a name claim over user details', () => {
    expect(
      getDisplayName(
        principal({
          userDetails: 'ada@example.com',
          claims: [{ type: 'NAME', value: 'Ada Lovelace' }],
        }),
      ),
    ).toBe('Ada Lovelace');
  });

  it('falls back to email-like user details', () => {
    expect(getDisplayName(principal({ userDetails: 'ada@example.com' }))).toBe('ada@example.com');
  });

  it('falls back to the user id when user details are unavailable', () => {
    expect(getDisplayName(principal())).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90');
  });
});
