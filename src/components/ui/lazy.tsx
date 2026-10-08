'use client';
/**
 * On-demand client components: keeps rarely used UI (sheets, dialogs) out of the first-load
 * bundle. `lazyComponent(() => import('./X').then((m) => m.X))` returns
 *  - `load()` — start (or reuse) the download; safe to call on hover/focus to warm it up.
 *    The chunk is fetched once; a failed fetch is forgotten so the next attempt retries.
 *  - `Render` — renders nothing until `wanted` is first true, then the real component with
 *    the remaining props once it has loaded. It stays mounted afterwards, so close
 *    animations still play. A failed download shows an error toast and calls `onLoadError`
 *    (e.g. to reset the caller's open state).
 */
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { t } from '@/lib/i18n';
import { toast } from './Toast';

export type LazyRenderProps<P> = P & {
  /** Load (if needed) and render the component. */
  wanted: boolean;
  onLoadError?: () => void;
};

export interface LazyComponent<P> {
  load: () => Promise<ComponentType<P>>;
  Render: ComponentType<LazyRenderProps<P>>;
}

export function lazyComponent<P extends object>(
  importer: () => Promise<ComponentType<P>>,
): LazyComponent<P> {
  let promise: Promise<ComponentType<P>> | null = null;
  let loaded: ComponentType<P> | null = null;

  const load = () => {
    promise ??= importer().then(
      (component) => {
        loaded = component;
        return component;
      },
      (err: unknown) => {
        promise = null;
        throw err;
      },
    );
    return promise;
  };

  function Render({ wanted, onLoadError, ...props }: LazyRenderProps<P>) {
    const [Component, setComponent] = useState<ComponentType<P> | null>(() => loaded);
    const onErrorRef = useRef(onLoadError);
    useEffect(() => {
      onErrorRef.current = onLoadError;
    });
    useEffect(() => {
      if (!wanted || Component) return;
      let cancelled = false;
      load().then(
        (c) => {
          if (!cancelled) setComponent(() => c);
        },
        () => {
          if (cancelled) return;
          toast({ message: t('common.errors.network'), tone: 'error' });
          onErrorRef.current?.();
        },
      );
      return () => {
        cancelled = true;
      };
    }, [wanted, Component]);
    return Component ? <Component {...(props as P)} /> : null;
  }

  return { load, Render };
}
