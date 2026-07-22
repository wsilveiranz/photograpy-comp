import { useEffect, useState } from 'react';
import type { AnonymizedEntry } from '../types';
import {
  castVote,
  listMyVotes,
  listVotingEntries,
  removeVote,
} from '../services/votes';
import './voting-gallery.css';

export interface VotingGalleryProps {
  competitionId: string;
}

export function VotingGallery({ competitionId }: VotingGalleryProps) {
  const [entries, setEntries] = useState<AnonymizedEntry[]>([]);
  const [votedEntryIds, setVotedEntryIds] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(3);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadGallery() {
      setIsLoading(true);
      const [entriesResult, votesResult] = await Promise.all([
        listVotingEntries(competitionId),
        listMyVotes(competitionId),
      ]);
      if (!active) {
        return;
      }
      if (entriesResult.data === null || votesResult.data === null) {
        setError(entriesResult.error ?? votesResult.error);
      } else {
        setEntries(entriesResult.data);
        setVotedEntryIds(votesResult.data.entryIds);
        setRemaining(votesResult.data.remaining);
      }
      setIsLoading(false);
    }

    void loadGallery();
    return () => {
      active = false;
    };
  }, [competitionId]);

  async function toggleVote(entryId: string) {
    const isVoted = votedEntryIds.includes(entryId);
    if (!isVoted && remaining === 0) {
      return;
    }

    setPendingEntryId(entryId);
    setError(null);
    const result = isVoted
      ? await removeVote(competitionId, entryId)
      : await castVote(competitionId, entryId);
    if (result.data === null) {
      setError(result.error);
    } else {
      setVotedEntryIds((current) =>
        isVoted ? current.filter((id) => id !== entryId) : [...current, entryId],
      );
      setRemaining(result.data.remaining);
    }
    setPendingEntryId(null);
  }

  return (
    <section aria-label="Vote for photos" className="voting-gallery">
      <div className="voting-gallery__summary">
        <h2>Choose your favourite photos</h2>
        <p aria-live="polite">
          {remaining} {remaining === 1 ? 'token' : 'tokens'} remaining
        </p>
      </div>

      {error && <p className="voting-gallery__error">{error}</p>}

      {isLoading ? (
        <p className="voting-gallery__loading" aria-live="polite">
          <span className="voting-gallery__spinner" aria-hidden="true" />
          Loading photos…
        </p>
      ) : (
        <div className="voting-gallery__grid">
          {entries.map((entry) => {
            const isVoted = votedEntryIds.includes(entry.entryId);
            const isPending = pendingEntryId === entry.entryId;
            const cannotAddVote = !isVoted && remaining === 0;
            return (
              <button
                key={entry.entryId}
                type="button"
                onClick={() => void toggleVote(entry.entryId)}
                disabled={isPending || cannotAddVote}
                aria-pressed={isVoted}
                className="voting-gallery__entry"
              >
                <img
                  src={entry.thumbUrl}
                  alt="Competition entry"
                  className="voting-gallery__image"
                />
                <span className="voting-gallery__entry-label">
                  {isPending && <span className="voting-gallery__spinner" aria-hidden="true" />}
                  {isPending
                    ? 'Updating vote…'
                    : isVoted
                      ? 'Selected — tap to remove'
                      : 'Tap to vote'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
