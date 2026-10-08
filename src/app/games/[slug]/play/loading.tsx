import { RouteShell } from '@/components/learn/RouteShell';
import { TableSkeleton } from '@/components/play/TableFrame';

/** Instant felt placeholder while the (request-time) play page renders. */
export default function PlayLoading() {
  return (
    <RouteShell testId="play-page-loading">
      <div aria-hidden="true" className="bg-gold-300/10 h-11 w-56 animate-pulse rounded-lg" />
      <div
        aria-hidden="true"
        className="bg-gold-300/15 mt-2 h-12 w-72 max-w-full animate-pulse rounded-xl"
      />
      <TableSkeleton className="mt-8" />
    </RouteShell>
  );
}
