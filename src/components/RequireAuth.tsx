import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { NotAuthorized } from './NotAuthorized';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) {
    return <p aria-live="polite">Checking your sign-in status…</p>;
  }

  if (!user) {
    return <p role="status">Please sign in to access this page.</p>;
  }

  if (!user.isApproved) {
    return <NotAuthorized />;
  }

  return <>{children}</>;
}
