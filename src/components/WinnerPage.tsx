import { useEffect, useState } from 'react';
import { logger } from '../lib/logger';
import { getWinners, type WinnersView } from '../services/results';
import type { WinnerView } from '../types';
import './Results.css';

export interface WinnerPageProps {
  competitionId: string;
}

export function WinnerPage({ competitionId }: WinnerPageProps) {
  const [winners, setWinners] = useState<WinnersView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getWinners(competitionId).then((response) => {
      if (!active) {
        return;
      }
      if (!response.data) {
        const message = response.error ?? 'Unable to load winners.';
        logger.error({ operation: 'winner-page.load', competitionId }, message);
        setError(message);
        return;
      }
      setWinners(response.data);
    });
    return () => {
      active = false;
    };
  }, [competitionId]);

  if (error) {
    return (
      <section className="winner-page" aria-labelledby="winner-page-heading">
        <h2 id="winner-page-heading">Winners</h2>
        <p className="results-panel__error" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (!winners) {
    return <p role="status">Loading winners…</p>;
  }

  return (
    <section className="winner-page" aria-labelledby="winner-page-heading">
      <p className="winner-page__eyebrow">Congratulations</p>
      <h2 id="winner-page-heading">Competition winner</h2>
      <WinnerCard winner={winners.winner} featured />
      {winners.runnersUp.length > 0 && (
        <>
          <h3>Runners-up</h3>
          <div className="winner-page__grid">
            {winners.runnersUp.map((runnerUp) => (
              <WinnerCard key={runnerUp.entryId} winner={runnerUp} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function WinnerCard({ winner, featured = false }: { winner: WinnerView; featured?: boolean }) {
  return (
    <article className={featured ? 'winner-card winner-card--featured' : 'winner-card'}>
      <img src={featured ? winner.imageUrl : winner.thumbUrl} alt={`Winning photo: ${winner.title}`} />
      <div className="winner-card__body">
        <h3>{winner.title}</h3>
        <p>
          By {winner.userAlias} · {winner.voteCount} votes
        </p>
      </div>
    </article>
  );
}
