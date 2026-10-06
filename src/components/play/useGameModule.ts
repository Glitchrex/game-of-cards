'use client';
/**
 * Lazily loads a Tier 1 GameModule from the generated registry (each game ships in
 * its own chunk). Loaded modules are cached for the session, so going from the
 * practice hand to the play page (or playing again) is instant.
 */
import { useCallback, useEffect, useState } from 'react';
import { type GameModule } from '@/games/core/module';
import { gameModuleLoaders } from '@/games/registry.generated';

const cache = new Map<string, GameModule>();

export type GameModuleStatus = 'loading' | 'ready' | 'error';

export interface GameModuleState {
  status: GameModuleStatus;
  module: GameModule | null;
  /** Try loading again after an error. */
  retry: () => void;
}

interface LoadState {
  slug: string;
  module: GameModule | null;
  failed: boolean;
}

export function useGameModule(slug: string): GameModuleState {
  const loader = gameModuleLoaders[slug];
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadState>(() => ({
    slug,
    module: cache.get(slug) ?? null,
    failed: false,
  }));
  const current: LoadState =
    loaded.slug === slug ? loaded : { slug, module: cache.get(slug) ?? null, failed: false };

  useEffect(() => {
    if (!loader || cache.has(slug)) return;
    let alive = true;
    loader().then(
      (mod) => {
        cache.set(slug, mod);
        if (alive) setLoaded({ slug, module: mod, failed: false });
      },
      (err: unknown) => {
        console.error(`Could not load the "${slug}" game module`, err);
        if (alive) setLoaded({ slug, module: null, failed: true });
      },
    );
    return () => {
      alive = false;
    };
  }, [slug, loader, attempt]);

  const retry = useCallback(() => {
    setLoaded({ slug, module: null, failed: false });
    setAttempt((n) => n + 1);
  }, [slug]);

  const mod = current.module ?? cache.get(slug) ?? null;
  const status: GameModuleStatus = mod ? 'ready' : !loader || current.failed ? 'error' : 'loading';
  return { status, module: mod, retry };
}

/** Test helper: forget cached modules. */
export function clearGameModuleCache(): void {
  cache.clear();
}
