import { useCallback, useEffect, useState } from 'react';
import { logger } from '../lib/logger';
import {
  castTieBreak,
  getResults,
  getTieBreak,
  resolveWinner,
  type ResultsView,
  type TieBreakView,
} from '../services/results';
import './Results.css';

export interface ResultsAdminProps {
  competitionId: string;
}

export function ResultsAdmin({ competitionId }: ResultsAdminProps) {
  const [results, setResults] = useState<ResultsView | null>(null);
  const [tieBreak, setTieBreak] = useState<TieBreakView | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const resultsResponse = await getResults(competitionId);
    if (!resultsResponse.data) {
      const message = resultsResponse.error ?? 'Unable to load competition results.';
      logger.error(
        { operation: 'results-admin.load', competitionId },
        message,
      );
      setError(message);
      setResults(null);
      setTieBreak(null);
      setLoading(false);
      return;
    }

    setResults(resultsResponse.data);
    if (resultsResponse.data.tie.tied) {
      const tieBreakResponse = await getTieBreak(competitionId);
      if (!tieBreakResponse.data) {
        const message = tieBreakResponse.error ?? 'Unable to load tie-break results.';
        logger.error(
          { operation: 'results-admin.tiebreak.load', competitionId },
          message,
        );
        setError(message);
        setTieBreak(null);
      } else {
        setTieBreak(tieBreakResponse.data);
      }
    } else {
      setTieBreak(null);
    }
    setLoading(false);
  }, [competitionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitTieBreak() {
    if (!selectedEntryId) {
      setError('Select one of the tied entries before submitting your vote.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const response = await castTieBreak(competitionId, selectedEntryId);
    setSubmitting(false);
    if (!response.data) {
      const message = response.error ?? 'Unable to submit the tie-break vote.';
      logger.error(
        { operation: 'results-admin.tiebreak.cast', competitionId, entryId: selectedEntryId },
        message,
      );
      setError(message);
      return;
    }
    setTieBreak(response.data);
  }

  async function submitResolution() {
    setResolving(true);
    setError(null);
    const response = await resolveWinner(competitionId);
    setResolving(false);
    if (!response.data) {
      const message = response.error ?? 'Unable to close the competition.';
      logger.error({ operation: 'results-admin.resolve', competitionId }, message);
      setError(message);
      return;
    }
    await load();
  }

  if (loading) {
    return <p role="status">Loading standings…</p>;
  }

  return (
    <section className="results-panel" aria-labelledby="results-admin-heading">
      <h2 id="results-admin-heading">Competition results</h2>
      {error && (
        <p className="results-panel__error" role="alert">
          {error}
        </p>
      )}
      {results && (
        <>
          <div className="results-panel__table-wrap">
            <table>
              <caption>Approved-entry vote standings</caption>
              <thead>
                <tr>
                  <th scope="col">Place</th>
                  <th scope="col">Photo</th>
                  <th scope="col">Votes</th>
                </tr>
              </thead>
              <tbody>
                {results.standings.map((standing, index) => (
                  <tr key={standing.entryId}>
                    <td>{index + 1}</td>
                    <td>{standing.title}</td>
                    <td>{standing.voteCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {results.tie.tied ? (
            <form
              className="results-panel__tiebreak"
              onSubmit={(event) => {
                event.preventDefault();
                void submitTieBreak();
              }}
            >
              <h3>First-place tie-break</h3>
              <p>Choose one tied photo. Your latest vote replaces your previous selection.</p>
              <fieldset>
                <legend>Select the winning photo</legend>
                {results.standings
                  .filter((standing) => results.tie.entryIds.includes(standing.entryId))
                  .map((standing) => (
                    <label className="results-panel__choice" key={standing.entryId}>
                      <input
                        type="radio"
                        name="tiebreak-entry"
                        value={standing.entryId}
                        checked={selectedEntryId === standing.entryId}
                        onChange={(event) => setSelectedEntryId(event.target.value)}
                      />
                      <span>
                        {standing.title} ({tieBreak?.counts[standing.entryId] ?? 0} tie-break
                        votes)
                      </span>
                    </label>
                  ))}
              </fieldset>
              <button
                className="results-panel__button"
                type="submit"
                disabled={submitting || !selectedEntryId}
              >
                {submitting && <span className="results-panel__spinner" aria-hidden="true" />}
                {submitting ? 'Submitting vote…' : 'Submit tie-break vote'}
              </button>
              {tieBreak?.clearWinner ? (
                <p className="results-panel__notice">
                  A majority has selected the winning photo. You can now close the competition.
                </p>
              ) : (
                <p className="results-panel__warning">
                  A majority of submitted tie-break votes is required before closing.
                </p>
              )}
              <button
                className="results-panel__button"
                type="button"
                disabled={resolving || !tieBreak?.clearWinner}
                onClick={() => void submitResolution()}
              >
                {resolving && <span className="results-panel__spinner" aria-hidden="true" />}
                {resolving ? 'Closing competition…' : 'Close competition and reveal winner'}
              </button>
            </form>
          ) : (
            <button
              className="results-panel__button"
              type="button"
              disabled={resolving || results.standings.length === 0}
              onClick={() => void submitResolution()}
            >
              {resolving && <span className="results-panel__spinner" aria-hidden="true" />}
              {resolving ? 'Closing competition…' : 'Close competition and reveal winner'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
