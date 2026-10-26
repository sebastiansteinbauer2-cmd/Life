import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { game, ProfileProvider, store, useQuery } from './app/context';
import { useRoute } from './app/router';
import { ensureSeed } from './app/seed';
import { GameFeedback } from './components/ui';
import { applyUpdate, onUpdateReady } from './app/updates';
import type { ModuleId, Profile } from './data/types';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';

const Settings = lazy(() => import('./pages/Settings'));
const Achievements = lazy(() => import('./pages/Achievements'));
const Report = lazy(() => import('./pages/Report'));
const Shop = lazy(() => import('./pages/Shop'));
const MathModule = lazy(() => import('./modules/math/MathPages').then((m) => ({ default: m.MathRouter })));
const TrainingModule = lazy(() => import('./modules/training/TrainingPages'));
const ChessModule = lazy(() => import('./modules/chess/ChessPages'));
const DiscoverModule = lazy(() => import('./modules/discover/DiscoverPages'));
const FinanceModule = lazy(() => import('./modules/finance/FinancePages'));
const IronmanModule = lazy(() => import('./modules/ironman/IronmanPages'));

/** Všechny sekce – do spodní lišty jdou 4 vybrané (Nastavení), zbytek je pod „Více“. */
const SECTIONS: { id: ModuleId; path: string; icon: string; label: string }[] = [
  { id: 'math', path: '/math', icon: '∑', label: 'Matika' },
  { id: 'training', path: '/training', icon: '🏋️', label: 'Trénink' },
  { id: 'ironman', path: '/ironman', icon: '🏊', label: 'Ironman' },
  { id: 'chess', path: '/chess', icon: '♞', label: 'Šachy' },
  { id: 'discover', path: '/discover', icon: '🔭', label: 'Objevy' },
  { id: 'finance', path: '/finance', icon: '💰', label: 'Finance' },
];
const EXTRA = [
  { path: '/report', icon: '📜', label: 'Deník hrdiny' },
  { path: '/shop', icon: '🏪', label: 'Obchod' },
  { path: '/achievements', icon: '🏅', label: 'Odznaky' },
  { path: '/settings', icon: '⚙️', label: 'Nastavení' },
];

function page(route: string): ReactNode {
  if (route.startsWith('/math')) return <MathModule route={route} />;
  if (route.startsWith('/training')) return <TrainingModule route={route} />;
  if (route.startsWith('/chess')) return <ChessModule route={route} />;
  if (route.startsWith('/discover')) return <DiscoverModule route={route} />;
  if (route.startsWith('/finance')) return <FinanceModule route={route} />;
  if (route.startsWith('/ironman')) return <IronmanModule route={route} />;
  if (route === '/settings') return <Settings />;
  if (route === '/achievements') return <Achievements />;
  if (route === '/report') return <Report />;
  if (route === '/shop') return <Shop />;
  return <Home />;
}

export default function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);
  const [more, setMore] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => onUpdateReady(setUpdateReady) as () => void, []);
  const profile = useQuery<Profile>(() => game.getProfile());

  useEffect(() => {
    ensureSeed().then(() => setReady(true));
    // požádej prohlížeč, aby data v IndexedDB nemazal
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  if (!ready || !profile) return <div className="app center muted" style={{ paddingTop: '40vh' }}>Načítám…</div>;
  if (!profile.onboarded) return <Onboarding onDone={() => store.col('meta').put({ id: 'onboardedAt', value: Date.now() })} />;

  const pinned = SECTIONS.filter((x) => profile.navPinned.includes(x.id)).slice(0, 4);
  const pinnedActive = pinned.find((n) => route.startsWith(n.path))?.path;
  const active = route === '/' ? '/' : pinnedActive ?? 'more';
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
        {updateReady && (
          <div className="update-bar" role="status">
            <span>🆕 Je tu nová verze aplikace.</span>
            <button className="btn-sm primary" onClick={() => applyUpdate()}>Aktualizovat</button>
          </div>
        )}
        <main>
          <Suspense fallback={<div className="empty">Načítám…</div>}>{page(route)}</Suspense>
        </main>
      </div>
      <nav className="nav" aria-label="Hlavní navigace">
        {[{ path: '/', icon: '🏠', label: 'Domů' }, ...pinned].map((n) => (
          <a key={n.path} href={`#${n.path}`} className={active === n.path ? 'active' : ''} onClick={() => setMore(false)}>
            <span className="ic" aria-hidden>{n.icon}</span>
            {n.label}
          </a>
        ))}
        <a href="#" className={active === 'more' || more ? 'active' : ''} onClick={(e) => { e.preventDefault(); setMore(!more); }} aria-expanded={more}>
          <span className="ic" aria-hidden>⋯</span>
          Více
        </a>
      </nav>
      {more && (
        <div className="more-back" onClick={() => setMore(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()} role="menu">
            <div className="more-grid">
              {[...SECTIONS, ...EXTRA].map((n) => (
                <a key={n.path} href={`#${n.path}`} className={route.startsWith(n.path) ? 'active' : ''} onClick={() => setMore(false)} role="menuitem">
                  <span className="ic" aria-hidden>{n.icon}</span>
                  {n.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
      <GameFeedback />
    </ProfileProvider>
  );
}
