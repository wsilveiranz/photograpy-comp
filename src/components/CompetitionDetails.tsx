import { useEffect, useState } from 'react';
import { getCompetition } from '../services/competitions';
import type { Competition } from '../types';
import { CompetitionCard } from './CompetitionCard';

export interface CompetitionDetailsProps {
  competitionId: string;
}

export function CompetitionDetails({ competitionId }: CompetitionDetailsProps) {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCompetition() {
      setLoading(true);
      setError(null);
      const result = await getCompetition(competitionId);
      if (cancelled) {
        return;
      }

      setCompetition(result.data);
      setError(result.error);
      setLoading(false);
    }

    void loadCompetition();
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  if (loading) {
    return <p aria-live="polite">Loading competition…</p>;
  }
  if (error) {
    return <p role="alert">Unable to load competition: {error}</p>;
  }
  if (!competition) {
    return <p role="status">Competition not found.</p>;
  }

  return (
    <section aria-labelledby="competition-details-heading">
      <h2 id="competition-details-heading">Competition details</h2>
      <CompetitionCard competition={competition} linkToDetails={false} />
    </section>
  );
}
