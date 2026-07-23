import type { Competition } from '../types';
import { CompetitionCard } from './CompetitionCard';
import './past-competitions.css';

export interface PastCompetitionsProps {
  competitions: Competition[];
}

export function PastCompetitions({ competitions }: PastCompetitionsProps) {
  if (competitions.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="past-competitions-heading" className="past-competitions">
      <h2 id="past-competitions-heading">Past competitions</h2>
      <div className="competition-grid">
        {competitions.map((competition) => (
          <CompetitionCard
            key={competition.id}
            competition={competition}
            href={`/competitions/${encodeURIComponent(competition.id)}/winners`}
          />
        ))}
      </div>
    </section>
  );
}
