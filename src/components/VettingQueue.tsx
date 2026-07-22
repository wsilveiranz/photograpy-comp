import { useCallback, useEffect, useState } from 'react';
import {
  imageUrl,
  listVettingEntries,
  reviewEntry,
  type ReviewDecision,
} from '../services/entries';
import type { Entry } from '../types';
import './entry-management.css';

export interface VettingQueueProps {
  competitionId: string;
}

export function VettingQueue({ competitionId }: VettingQueueProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingEntryId, setReviewingEntryId] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await listVettingEntries(competitionId);
    if (result.error !== null) {
      setError(result.error);
    } else {
      setEntries(result.data);
    }
    setIsLoading(false);
  }, [competitionId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  async function decide(entryId: string, decision: ReviewDecision) {
    setReviewingEntryId(entryId);
    setError(null);
    const result = await reviewEntry(competitionId, entryId, decision);
    setReviewingEntryId(null);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    setEntries((current) =>
      current.map((entry) => (entry.id === result.data.id ? result.data : entry)),
    );
  }

  return (
    <section className="entry-panel" aria-labelledby="vetting-heading">
      <div className="entry-panel__heading">
        <div>
          <p className="entry-panel__eyebrow">Administrator</p>
          <h2 id="vetting-heading">Photo vetting</h2>
        </div>
        <button
          className="entry-button entry-button--secondary"
          type="button"
          disabled={isLoading}
          onClick={() => void loadEntries()}
        >
          {isLoading ? 'Refreshing…' : 'Refresh queue'}
        </button>
      </div>

      {error && (
        <p className="entry-error" role="alert">
          {error}
        </p>
      )}
      {isLoading && entries.length === 0 && <p role="status">Loading the vetting queue…</p>}
      {!isLoading && !error && entries.length === 0 && <p>There are no photos to review.</p>}

      <div className="entry-grid entry-grid--vetting">
        {entries.map((entry) => {
          const isReviewing = reviewingEntryId === entry.id;
          return (
            <article
              className={`entry-card${entry.flagged ? ' entry-card--flagged' : ''}`}
              key={entry.id}
            >
              <img
                className="entry-card__image"
                src={entry.thumbUrl ?? imageUrl(competitionId, entry.id, 'thumb')}
                alt={entry.title}
              />
              <div className="entry-card__body">
                <div className="entry-card__title-row">
                  <h3>{entry.title}</h3>
                  {entry.flagged && <strong className="entry-flag">Flagged for review</strong>}
                </div>
                <p>
                  Status: <strong>{entry.status}</strong>
                </p>
                <p>
                  Submitted by <strong>{entry.userAlias ?? entry.userId}</strong>
                </p>
                <ModerationSummary entry={entry} />
                <div className="entry-actions">
                  <button
                    className="entry-button entry-button--primary"
                    type="button"
                    disabled={isReviewing}
                    onClick={() => void decide(entry.id, 'approved')}
                  >
                    {isReviewing && <span className="entry-spinner" aria-hidden="true" />}
                    {isReviewing ? 'Saving…' : 'Approve'}
                  </button>
                  <button
                    className="entry-button entry-button--danger"
                    type="button"
                    disabled={isReviewing}
                    onClick={() => void decide(entry.id, 'rejected')}
                  >
                    {isReviewing && <span className="entry-spinner" aria-hidden="true" />}
                    {isReviewing ? 'Saving…' : 'Reject'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ModerationSummary({ entry }: { entry: Entry }) {
  const severities = Object.entries(entry.moderation ?? {});
  if (severities.length === 0) {
    return <p>Automated moderation: no concerns reported.</p>;
  }
  return (
    <div>
      <strong>Automated moderation</strong>
      <ul className="entry-moderation">
        {severities.map(([category, severity]) => (
          <li key={category}>
            {category}: {severity}
          </li>
        ))}
      </ul>
    </div>
  );
}
