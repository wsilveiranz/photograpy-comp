import { useEffect, useState, type ReactNode } from 'react';
import { Link, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { AuthControls } from './components/AuthControls';
import { CompetitionAdmin } from './components/CompetitionAdmin';
import { CompetitionDetails } from './components/CompetitionDetails';
import { CompetitionList } from './components/CompetitionList';
import { Layout } from './components/Layout';
import { MyEntries } from './components/MyEntries';
import { RequireAdmin } from './components/RequireAdmin';
import { RequireAuth } from './components/RequireAuth';
import { ResultsAdmin } from './components/ResultsAdmin';
import { UploadForm } from './components/UploadForm';
import { VettingQueue } from './components/VettingQueue';
import { VotingGallery } from './components/VotingGallery';
import { WinnerPage } from './components/WinnerPage';
import { useAuth } from './context/AuthContext';
import { getCompetition, listCompetitions } from './services/competitions';
import type { Competition, CompetitionStatus } from './types';
import './App.css';

const SUBMISSION_STATUSES: CompetitionStatus[] = ['submissions'];
const RESULTS_STATUSES: CompetitionStatus[] = ['voting', 'tiebreak'];

function App() {
  const { isAdmin } = useAuth();
  const nav = [
    { label: 'Competitions', href: '/' },
    { label: 'Upload', href: '/upload' },
    ...(isAdmin
      ? [
          { label: 'Admin', href: '/admin' },
          { label: 'Vetting', href: '/admin/vetting' },
          { label: 'Results', href: '/admin/results' },
        ]
      : []),
  ];

  return (
    <Layout nav={nav} authControls={<AuthControls />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/competitions/:id" element={<CompetitionDetailsPage />} />
        <Route
          path="/competitions/:id/vote"
          element={
            <RequireAuth>
              <CompetitionIdRoute>{(competitionId) => <VotingGallery competitionId={competitionId} />}</CompetitionIdRoute>
            </RequireAuth>
          }
        />
        <Route path="/competitions/:id/winners" element={<WinnerPageRoute />} />
        <Route
          path="/upload"
          element={
            <RequireAuth>
              <SelectedCompetitionRoute statuses={SUBMISSION_STATUSES}>
                {(competitionId) => <UploadPage competitionId={competitionId} />}
              </SelectedCompetitionRoute>
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <CompetitionAdmin />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/vetting"
          element={
            <RequireAdmin>
              <SelectedCompetitionRoute statuses={SUBMISSION_STATUSES}>
                {(competitionId) => <VettingQueue competitionId={competitionId} />}
              </SelectedCompetitionRoute>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/results"
          element={
            <RequireAdmin>
              <SelectedCompetitionRoute statuses={RESULTS_STATUSES}>
                {(competitionId) => <ResultsAdmin competitionId={competitionId} />}
              </SelectedCompetitionRoute>
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

function HomePage() {
  return (
    <>
      <h1>Photography Competition</h1>
      <p>Upload up to 5 photos and vote for the best.</p>
      <CompetitionList />
    </>
  );
}

function CompetitionDetailsPage() {
  const { id } = useParams();

  if (!id) {
    return <NotFound />;
  }

  return (
    <>
      <CompetitionDetails competitionId={id} />
      <CompetitionActions competitionId={id} />
    </>
  );
}

function CompetitionActions({ competitionId }: { competitionId: string }) {
  const [competition, setCompetition] = useState<Competition | null>(null);

  useEffect(() => {
    let active = true;

    void getCompetition(competitionId).then((result) => {
      if (active && result.data) {
        setCompetition(result.data);
      }
    });

    return () => {
      active = false;
    };
  }, [competitionId]);

  if (!competition) {
    return null;
  }

  return (
    <nav aria-label="Competition actions">
      {competition.status === 'submissions' && (
        <Link to={`/upload?competitionId=${encodeURIComponent(competitionId)}`}>Upload photos</Link>
      )}
      {competition.status === 'voting' && (
        <Link to={`/competitions/${encodeURIComponent(competitionId)}/vote`}>Vote for photos</Link>
      )}
      {competition.status === 'closed' && (
        <Link to={`/competitions/${encodeURIComponent(competitionId)}/winners`}>View winners</Link>
      )}
    </nav>
  );
}

function CompetitionIdRoute({
  children,
}: {
  children: (competitionId: string) => ReactNode;
}) {
  const { id } = useParams();

  return id ? <>{children(id)}</> : <NotFound />;
}

function WinnerPageRoute() {
  return (
    <CompetitionIdRoute>
      {(competitionId) => <WinnerPage competitionId={competitionId} />}
    </CompetitionIdRoute>
  );
}

function UploadPage({ competitionId }: { competitionId: string }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <UploadForm competitionId={competitionId} onUploaded={() => setRefreshKey((key) => key + 1)} />
      <MyEntries competitionId={competitionId} refreshKey={refreshKey} />
    </>
  );
}

function SelectedCompetitionRoute({
  children,
  statuses,
}: {
  children: (competitionId: string) => ReactNode;
  statuses: CompetitionStatus[];
}) {
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('competitionId');
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void listCompetitions().then((result) => {
      if (!active) {
        return;
      }
      setLoading(false);
      if (!result.data) {
        setError(result.error);
        return;
      }

      const selected = result.data.find(
        (competition) =>
          competition.id === requestedId && statuses.includes(competition.status),
      ) ?? result.data.find((competition) => statuses.includes(competition.status));
      setCompetitionId(selected?.id ?? null);
    });

    return () => {
      active = false;
    };
  }, [requestedId, statuses]);

  if (error) {
    return <p role="alert">Unable to select a competition: {error}</p>;
  }
  if (loading) {
    return <p aria-live="polite">Selecting a competition…</p>;
  }
  if (competitionId === null) {
    return <p role="status">No eligible competition is available.</p>;
  }

  return <>{children(competitionId)}</>;
}

function NotFound() {
  return (
    <section aria-labelledby="not-found-heading">
      <h1 id="not-found-heading">Page not found</h1>
      <p>The page you requested is unavailable.</p>
      <Link to="/">Return to competitions</Link>
    </section>
  );
}

export default App;
