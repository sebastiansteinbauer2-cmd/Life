import { useEffect, useState } from 'react';

// Jednoduchý hash router – funguje na GitHub Pages bez serverové konfigurace.
const current = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];

export function useRoute(): string {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const on = () => {
      setRoute(current());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const navigate = (path: string) => {
  location.hash = path;
};

export const href = (path: string) => `#${path}`;
