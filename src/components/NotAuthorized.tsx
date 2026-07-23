import { useAuth } from '../context/AuthContext';
import './not-authorized.css';

export function NotAuthorized() {
  const { user, logout } = useAuth();

  return (
    <div className="not-authorized" role="alert">
      <h2 className="not-authorized__title">Access not permitted</h2>
      <p className="not-authorized__message">
        You are signed in as {user?.userDetails || user?.userId}, but this account is not allowed to
        take part in this competition. Please sign in with an approved work or school account.
      </p>
      <button className="not-authorized__button" type="button" onClick={logout}>
        Sign out
      </button>
    </div>
  );
}
