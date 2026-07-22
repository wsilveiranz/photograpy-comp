import { useEffect, useState } from 'react';
import { listCompetitions } from '../services/competitions';
import type { Competition } from '../types';
import { CompetitionCard } from './CompetitionCard';

export function CompetitionList() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCompetitions() {
      const result = await listCompetitions();
      if (cancelled) {
        return;
      }

      setCompetitions(result.data ?? []);
      setError(result.error);
      setLoading(false);
    }

    void loadCompetitions();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="competitions-heading">
      <h2 id="competitions-heading">Competitions</h2>
      {loading && <p aria-live="polite">Loading competitions…</p>}
      {error && <p role="alert">Unable to load competitions: {error}</p>}
      {!loading && !error && competitions.length === 0 && (
        <p role="status">No competitions are available yet.</p>
      )}
      {competitions.length > 0 && (
        <div className="competition-grid">
          {competitions.map((competition) => (
            <CompetitionCard key={competition.id} competition={competition} />
          ))}
        </div>
      )}
    </section>
  );
}
