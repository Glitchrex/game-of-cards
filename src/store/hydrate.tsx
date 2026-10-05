'use client';
/**
 * Rehydrates all persisted stores once on the client (stores use skipHydration
 * to avoid SSR/client mismatches). Components that render persisted values
 * should gate on `useHydrated()`.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { useWallet } from './wallet';
import { useStats } from './stats';
import { useProgress } from './progress';
import { useSettings } from './settings';

const useHydratedStore = create<{ hydrated: boolean }>(() => ({ hydrated: false }));

export function useHydrated(): boolean {
  return useHydratedStore((s) => s.hydrated);
}

export function StoreHydrator() {
  useEffect(() => {
    void Promise.all([
      useWallet.persist.rehydrate(),
      useStats.persist.rehydrate(),
      useProgress.persist.rehydrate(),
      useSettings.persist.rehydrate(),
    ]).then(() => useHydratedStore.setState({ hydrated: true }));
  }, []);
  return null;
}
