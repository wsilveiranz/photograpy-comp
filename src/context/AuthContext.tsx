import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { logger } from '../lib/logger';
import { getCurrentUser, type CurrentUser } from '../services/auth';

interface AuthContextValue {
  user: CurrentUser | null;
  isAdmin: boolean;
  isApproved: boolean;
  loading: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getCurrentUser();

    if (result.data) {
      setUser(result.data);
      setError(null);
    } else {
      setUser(null);
      setError(result.error);
      logger.warn({ operation: 'getCurrentUser' }, 'Unable to retrieve the current user');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(() => {
    const redirectUri = encodeURIComponent(window.location.href);
    window.location.href = `/.auth/login/aad?post_login_redirect_uri=${redirectUri}`;
  }, []);

  const logout = useCallback(() => {
    window.location.href = '/.auth/logout';
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAdmin: user?.isAdmin ?? false,
      isApproved: user?.isApproved ?? false,
      loading,
      error,
      login,
      logout,
      refresh,
    }),
    [error, loading, login, logout, refresh, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
