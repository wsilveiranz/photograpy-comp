import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) {
    return <p aria-live="polite">Checking your sign-in status…</p>;
  }

  if (!user) {
    return <p role="status">Please sign in to access this page.</p>;
  }

  return <>{children}</>;
}
