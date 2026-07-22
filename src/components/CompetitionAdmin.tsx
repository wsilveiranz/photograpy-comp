import { useEffect, useState, type FormEvent } from 'react';
import {
  createCompetition,
  getCompetition,
  listCompetitions,
  setPrize,
  updateCompetitionStatus,
  type CompetitionStatusUpdate,
} from '../services/competitions';
import type { Competition } from '../types';
import { CompetitionCard } from './CompetitionCard';
import './competitions.css';

export interface CompetitionAdminProps {
  competitionId?: string;
}

export function CompetitionAdmin({ competitionId }: CompetitionAdminProps) {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [prizeDescription, setPrizeDescription] = useState('');
  const [prizeImage, setPrizeImage] = useState<File | null>(null);
  const [votingStartsAt, setVotingStartsAt] = useState('');
  const [votingEndsAt, setVotingEndsAt] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const result = competitionId
        ? await getCompetition(competitionId)
        : await listCompetitions();
      if (cancelled) {
        return;
      }

      if (competitionId) {
        const detailResult = result as Awaited<ReturnType<typeof getCompetition>>;
        setCompetition(detailResult.data);
        setError(detailResult.error);
        applyCompetitionDates(detailResult.data);
      } else {
        const listResult = result as Awaited<ReturnType<typeof listCompetitions>>;
        const selected =
          listResult.data?.find((item) => item.status !== 'closed') ??
          listResult.data?.[0] ??
          null;
        setCompetition(selected);
        setError(listResult.error);
        applyCompetitionDates(selected);
      }
      setLoading(false);
    }

    function applyCompetitionDates(value: Competition | null) {
      setVotingStartsAt(toDateTimeLocal(value?.votingStartsAt ?? null));
      setVotingEndsAt(toDateTimeLocal(value?.votingEndsAt ?? null));
      setPrizeDescription(value && value.status !== 'closed' ? value.prizeDescription : '');
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const created = await createCompetition({ name, prizeDescription });
    if (!created.data) {
      setError(created.error);
      setBusy(false);
      return;
    }

    let current = created.data;
    if (prizeImage) {
      const prizeResult = await setPrize(current.id, prizeImage, prizeDescription);
      if (prizeResult.data) {
        current = prizeResult.data;
      } else {
        setError(`Competition created, but the prize image was not saved: ${prizeResult.error}`);
      }
    }

    setCompetition(current);
    setName('');
    setPrizeImage(null);
    setNotice('Competition opened for submissions.');
    setBusy(false);
  }

  async function handlePrizeUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!competition || !prizeImage) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await setPrize(competition.id, prizeImage, prizeDescription);
    setBusy(false);
    if (result.data) {
      setCompetition(result.data);
      setPrizeImage(null);
      setNotice('Prize details updated.');
    } else {
      setError(result.error);
    }
  }

  async function changeStatus(update: CompetitionStatusUpdate) {
    if (!competition) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await updateCompetitionStatus(competition.id, update);
    setBusy(false);
    if (result.data) {
      setCompetition(result.data);
      if (result.data.status === 'closed') {
        setPrizeDescription('');
        setPrizeImage(null);
      }
      setNotice(`Competition status changed to ${result.data.status}.`);
    } else {
      setError(result.error);
    }
  }

  function openVoting() {
    if (!votingStartsAt || !votingEndsAt) {
      setError('Enter both voting start and end times.');
      return;
    }
    void changeStatus({
      action: 'openVoting',
      votingStartsAt: new Date(votingStartsAt).toISOString(),
      votingEndsAt: new Date(votingEndsAt).toISOString(),
    });
  }

  if (loading) {
    return <p aria-live="polite">Loading competition administration…</p>;
  }

  const canCreate = !competition || competition.status === 'closed';

  return (
    <section
      className="competition-admin"
      aria-busy={busy}
      aria-labelledby="competition-admin-heading"
    >
      <h2 id="competition-admin-heading">Competition administration</h2>
      {error && <p role="alert" className="competition-message competition-message--error">{error}</p>}
      {notice && <p role="status" className="competition-message">{notice}</p>}

      {competition && (
        <div className="competition-admin__current">
          <h3>Current competition</h3>
          <CompetitionCard competition={competition} linkToDetails={false} />
        </div>
      )}

      {canCreate && (
        <form className="competition-form" onSubmit={handleCreate}>
          <fieldset disabled={busy}>
            <legend>Open a competition</legend>
            <label htmlFor="competition-name">
              Competition name
              <input
                id="competition-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label htmlFor="new-competition-prize-description">
              Prize description
              <textarea
                id="new-competition-prize-description"
                value={prizeDescription}
                onChange={(event) => setPrizeDescription(event.target.value)}
                required
              />
            </label>
            <label htmlFor="new-competition-prize-image">
              Prize image
              <input
                id="new-competition-prize-image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={(event) => setPrizeImage(event.target.files?.[0] ?? null)}
                required
              />
            </label>
            <button type="submit">{busy ? 'Opening…' : 'Open for submissions'}</button>
          </fieldset>
        </form>
      )}

      {competition && competition.status !== 'closed' && (
        <>
          <form className="competition-form" onSubmit={handlePrizeUpdate}>
            <fieldset disabled={busy}>
              <legend>Prize</legend>
              <label htmlFor="prize-description">
                Prize description
                <textarea
                  id="prize-description"
                  value={prizeDescription}
                  onChange={(event) => setPrizeDescription(event.target.value)}
                  required
                />
              </label>
              <label htmlFor="prize-image">
                New prize image
                <input
                  id="prize-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={(event) => setPrizeImage(event.target.files?.[0] ?? null)}
                  required
                />
              </label>
              <button type="submit">{busy ? 'Updating…' : 'Update prize'}</button>
            </fieldset>
          </form>

          <div className="competition-form">
            <fieldset disabled={busy}>
              <legend>Lifecycle controls</legend>
              {competition.status === 'submissions' && (
                <>
                  <div className="competition-form__dates">
                    <label htmlFor="voting-starts-at">
                      Voting starts
                      <input
                        id="voting-starts-at"
                        type="datetime-local"
                        value={votingStartsAt}
                        onChange={(event) => setVotingStartsAt(event.target.value)}
                      />
                    </label>
                    <label htmlFor="voting-ends-at">
                      Voting ends
                      <input
                        id="voting-ends-at"
                        type="datetime-local"
                        value={votingEndsAt}
                        onChange={(event) => setVotingEndsAt(event.target.value)}
                      />
                    </label>
                  </div>
                  <button type="button" onClick={openVoting}>
                    {busy ? 'Opening…' : 'Open voting'}
                  </button>
                </>
              )}
              {competition.status === 'voting' && (
                <button type="button" onClick={() => void changeStatus({ action: 'toTiebreak' })}>
                  {busy ? 'Updating…' : 'Move to tiebreak'}
                </button>
              )}
              {(competition.status === 'voting' || competition.status === 'tiebreak') && (
                <div className="competition-form__actions">
                  <button type="button" onClick={() => void changeStatus({ action: 'close' })}>
                    {busy ? 'Closing…' : 'Close competition'}
                  </button>
                  <button
                    className="competition-button--danger"
                    type="button"
                    onClick={() => void changeStatus({ action: 'forceClose' })}
                  >
                    {busy ? 'Closing…' : 'Force-close'}
                  </button>
                </div>
              )}
            </fieldset>
          </div>
        </>
      )}
    </section>
  );
}

function toDateTimeLocal(value: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
