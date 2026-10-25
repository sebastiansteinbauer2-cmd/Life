import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { game, ProfileProvider, store, useQuery } from './app/context';
import { useRoute } from './app/router';
import { ensureSeed } from './app/seed';
import { GameFeedback } from './components/ui';
import type { Profile } from './data/types';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';

const Settings = lazy(() => import('./pages/Settings'));
const Achievements = lazy(() => import('./pages/Achievements'));
const MathModule = lazy(() => import('./modules/math/MathPages').then((m) => ({ default: m.MathRouter })));
const TrainingModule = lazy(() => import('./modules/training/TrainingPages'));
const ChessModule = lazy(() => import('./modules/chess/ChessPages'));
const DiscoverModule = lazy(() => import('./modules/discover/DiscoverPages'));

const NAV = [
  { path: '/', icon: '🏠', label: 'Domů' },
  { path: '/math', icon: '∑', label: 'Matika' },
  { path: '/training', icon: '🏋️', label: 'Trénink' },
  { path: '/chess', icon: '♞', label: 'Šachy' },
  { path: '/discover', icon: '🔭', label: 'Objevy' },
];

function page(route: string): ReactNode {
  if (route.startsWith('/math')) return <MathModule route={route} />;
  if (route.startsWith('/training')) return <TrainingModule route={route} />;
  if (route.startsWith('/chess')) return <ChessModule route={route} />;
  if (route.startsWith('/discover')) return <DiscoverModule route={route} />;
  if (route === '/settings') return <Settings />;
  if (route === '/achievements') return <Achievements />;
  return <Home />;
}

export default function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);
  const profile = useQuery<Profile>(() => game.getProfile());

  useEffect(() => {
    ensureSeed().then(() => setReady(true));
    // požádej prohlížeč, aby data v IndexedDB nemazal
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  if (!ready || !profile) return <div className="app center muted" style={{ paddingTop: '40vh' }}>Načítám…</div>;
  if (!profile.onboarded) return <Onboarding onDone={() => store.col('meta').put({ id: 'onboardedAt', value: Date.now() })} />;

  const active = NAV.slice(1).find((n) => route.startsWith(n.path))?.path ?? (route === '/' ? '/' : '');
  return (
    <ProfileProvider value={profile}>
      <div className="app">
        <header className="topbar">
          <a className="brand" href="#/">⚔ Questy života</a>
          <div className="row" style={{ gap: 2 }}>
            <a className="btn iconbtn" href="#/achievements" aria-label="Odznaky">🏅</a>
            <a className="btn iconbtn" href="#/settings" aria-label="Nastavení">⚙️</a>
          </div>
        </header>
        <main>
          <Suspense fallback={<div className="empty">Načítám…</div>}>{page(route)}</Suspense>
        </main>
      </div>
      <nav className="nav" aria-label="Hlavní navigace">
        {NAV.map((n) => (
          <a key={n.path} href={`#${n.path}`} className={active === n.path ? 'active' : ''}>
            <span className="ic" aria-hidden>{n.icon}</span>
            {n.label}
          </a>
        ))}
      </nav>
      <GameFeedback />
    </ProfileProvider>
  );
}
