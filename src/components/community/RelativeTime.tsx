'use client';
import { useSyncExternalStore } from 'react';
import { useIsClient } from '@/components/ui/hooks';
import { absoluteDate, absoluteDateTime, relativeTime } from './format';

/*
 * One shared minute clock for every <RelativeTime/> on the page (the admin
 * view can show thousands of dates — they must not each own a timer).
 */
const TICK_MS = 60_000;
let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      for (const l of listeners) l();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getNow(): number {
  // While nobody is subscribed the clock is paused; catch up on the next render.
  if (!timer && Date.now() - now > TICK_MS / 2) now = Date.now();
  return now;
}

export interface RelativeTimeProps {
  /** ISO 8601 timestamp. */
  iso: string;
  className?: string;
}

/**
 * `<time>` that reads "5 minutes ago" in the browser (refreshing every
 * minute) and a fixed calendar date during SSR/hydration, so server and
 * client markup always match. The full date and time is in the tooltip.
 */
export function RelativeTime({ iso, className }: RelativeTimeProps) {
  const isClient = useIsClient();
  return (
    <time dateTime={iso} title={absoluteDateTime(iso)} className={className}>
      {isClient ? <LiveRelative iso={iso} /> : absoluteDate(iso)}
    </time>
  );
}

function LiveRelative({ iso }: { iso: string }) {
  const current = useSyncExternalStore(subscribe, getNow, getNow);
  return <>{relativeTime(iso, current)}</>;
}
