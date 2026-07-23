import { useEffect, useState, type ReactNode } from 'react';
import type { AnonymizedEntry } from '../types';
import {
  castVote,
  listMyVotes,
  listVotingEntries,
  removeVote,
} from '../services/votes';
import { Lightbox } from './Lightbox';
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  function renderVoteButton(entry: AnonymizedEntry): ReactNode {
    const isVoted = votedEntryIds.includes(entry.entryId);
    const isPending = pendingEntryId === entry.entryId;
    const cannotAddVote = !isVoted && remaining === 0;
    return (
      <button
        type="button"
        onClick={() => void toggleVote(entry.entryId)}
        disabled={isPending || cannotAddVote}
        aria-pressed={isVoted}
        className={`voting-gallery__vote${isVoted ? ' voting-gallery__vote--selected' : ''}`}
      >
        {isPending && <span className="voting-gallery__spinner" aria-hidden="true" />}
        {isPending
          ? 'Updating vote…'
          : isVoted
            ? 'Selected — tap to remove'
            : 'Tap to vote'}
      </button>
    );
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
          {entries.map((entry, entryIndex) => (
            <figure key={entry.entryId} className="voting-gallery__entry">
              <button
                type="button"
                className="voting-gallery__view"
                onClick={() => setLightboxIndex(entryIndex)}
                aria-label="View photo larger"
              >
                <img
                  src={entry.thumbUrl}
                  alt="Competition entry"
                  className="voting-gallery__image"
                  width={entry.width}
                  height={entry.height}
                  loading="lazy"
                />
              </button>
              {renderVoteButton(entry)}
            </figure>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          items={entries.map((entry) => ({
            id: entry.entryId,
            url: entry.fullUrl,
            width: entry.width,
            height: entry.height,
            alt: 'Competition entry',
          }))}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          renderActions={(item) => {
            const entry = entries.find((candidate) => candidate.entryId === item.id);
            return entry ? renderVoteButton(entry) : null;
          }}
        />
      )}
    </section>
  );
}
