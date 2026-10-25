import { createContext, useContext, useEffect, useRef, useState, type DependencyList } from 'react';
import { DexieStore } from '../data/dexieStore';
import type { Profile } from '../data/types';
import { GameEngine, defaultProfile } from '../game/engine';

// Jediná instance úložiště a herního jádra pro celou aplikaci.
export const store = new DexieStore();
export const game = new GameEngine(store);

/**
 * Načte data a znovu je načte po každé změně v úložišti.
 * Nezávislé na konkrétní databázi (funguje s jakoukoli implementací DataStore).
 */
export function useQuery<T>(fn: () => Promise<T>, deps: DependencyList = []): T | undefined {
  const [value, setValue] = useState<T>();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    let scheduled = false;
    const load = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        fnRef.current().then((v) => alive && setValue(() => v));
      });
    };
    load();
    const unsub = store.subscribe(load);
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

const ProfileCtx = createContext<Profile>(defaultProfile());
export const ProfileProvider = ProfileCtx.Provider;
export const useProfile = () => useContext(ProfileCtx);
