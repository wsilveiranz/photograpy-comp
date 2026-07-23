import { useAuth } from '../context/AuthContext';
import './auth.css';

export function AuthControls() {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return <p aria-live="polite">Checking your sign-in status…</p>;
  }

  if (!user) {
    return (
      <button className="auth-button" type="button" onClick={login}>
        Sign in
      </button>
    );
  }

  return (
    <div className="auth-controls">
      <span>{user.displayName || user.userDetails || user.userId}</span>
      <button className="auth-button" type="button" onClick={logout}>
        Sign out
      </button>
    </div>
  );
}
