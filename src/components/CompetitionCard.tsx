import type { Competition } from '../types';
import './competitions.css';

export interface CompetitionCardProps {
  competition: Competition;
  linkToDetails?: boolean;
  href?: string;
}

export function CompetitionCard({
  competition,
  linkToDetails = true,
  href,
}: CompetitionCardProps) {
  const content = (
    <>
      {competition.prizeImageUrl && (
        <img
          className="competition-card__image"
          src={competition.prizeImageUrl}
          alt={`Prize for ${competition.name}`}
        />
      )}
      <div className="competition-card__body">
        <span className={`competition-status competition-status--${competition.status}`}>
          {statusLabel(competition.status)}
        </span>
        <h3>{competition.name}</h3>
        <p>{competition.prizeDescription}</p>
        {competition.votingStartsAt && competition.votingEndsAt && (
          <p className="competition-card__dates">
            Voting: {formatDate(competition.votingStartsAt)} –{' '}
            {formatDate(competition.votingEndsAt)}
          </p>
        )}
      </div>
    </>
  );

  return (
    <article className="competition-card">
      {linkToDetails ? (
        <a
          className="competition-card__link"
          href={href ?? `/competitions/${encodeURIComponent(competition.id)}`}
        >
          {content}
        </a>
      ) : (
        content
      )}
    </article>
  );
}

function statusLabel(status: Competition['status']): string {
  switch (status) {
    case 'submissions':
      return 'Submissions open';
    case 'voting':
      return 'Voting open';
    case 'tiebreak':
      return 'Tiebreak';
    case 'closed':
      return 'Closed';
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}
