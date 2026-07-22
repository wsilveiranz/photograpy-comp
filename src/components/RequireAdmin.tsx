import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading, user } = useAuth();

  if (loading) {
    return <p aria-live="polite">Checking your sign-in status…</p>;
  }

  if (!user) {
    return <p role="status">Please sign in to access this page.</p>;
  }

  if (!isAdmin) {
    return <p role="status">You do not have permission to access this page.</p>;
  }

  return <>{children}</>;
}
