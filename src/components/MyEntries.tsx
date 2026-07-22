import { useCallback, useEffect, useState } from 'react';
import { imageUrl, listMyEntries } from '../services/entries';
import type { Entry } from '../types';
import './entry-management.css';

export interface MyEntriesProps {
  competitionId: string;
  refreshKey?: string | number;
}

export function MyEntries({ competitionId, refreshKey }: MyEntriesProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await listMyEntries(competitionId);
    if (result.error !== null) {
      setError(result.error);
    } else {
      setEntries(result.data);
    }
    setIsLoading(false);
  }, [competitionId]);

  useEffect(() => {
    void refreshKey;
    void loadEntries();
  }, [loadEntries, refreshKey]);

  return (
    <section className="entry-panel" aria-labelledby="my-entries-heading">
      <div className="entry-panel__heading">
        <div>
          <p className="entry-panel__eyebrow">Submission status</p>
          <h2 id="my-entries-heading">My photos</h2>
        </div>
        <button
          className="entry-button entry-button--secondary"
          type="button"
          disabled={isLoading}
          onClick={() => void loadEntries()}
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="entry-error" role="alert">
          {error}
        </p>
      )}
      {isLoading && entries.length === 0 && <p role="status">Loading your photos…</p>}
      {!isLoading && !error && entries.length === 0 && <p>You have not uploaded any photos yet.</p>}

      <div className="entry-grid">
        {entries.map((entry) => (
          <article className="entry-card" key={entry.id}>
            <img
              className="entry-card__image"
              src={entry.thumbUrl ?? imageUrl(competitionId, entry.id, 'thumb')}
              alt={entry.title}
            />
            <div className="entry-card__body">
              <h3>{entry.title}</h3>
              <p>
                Status:{' '}
                <strong className={`entry-status entry-status--${entry.status}`}>
                  {statusLabel(entry.status)}
                </strong>
              </p>
              {entry.status === 'pending' && <p>Awaiting administrator review.</p>}
              {entry.status === 'rejected' && (
                <p>This photo cannot enter voting and still counts toward your 5-photo limit.</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function statusLabel(status: Entry['status']): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Pending review';
  }
}
