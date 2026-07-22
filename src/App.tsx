import { CompetitionList } from './components/CompetitionList';
import './App.css';

function App() {
  return (
    <main className="app-shell">
      <header>
        <h1>Photography Competition</h1>
        <p>Upload up to 5 photos and vote for the best.</p>
      </header>
      <CompetitionList />
    </main>
  );
}

export default App;
