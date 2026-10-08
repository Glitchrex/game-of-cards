/** Page frame for the learn / try / quiz routes: spotlit felt and a centred column. */
import { type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

export function RouteShell({
  children,
  width = 'wide',
  testId,
}: {
  children: ReactNode;
  /** `narrow` for the quiz, `wide` for lesson and example screens. */
  width?: 'narrow' | 'wide';
  testId?: string;
}) {
  return (
    <div className="felt-deep relative min-h-full overflow-x-clip" data-testid={testId}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(245_215_122/0.12),transparent)]"
      />
      <div
        className={cn(
          'relative mx-auto px-4 pt-5 pb-14 sm:px-6 sm:pt-8 lg:px-8',
          width === 'narrow' ? 'max-w-3xl' : 'max-w-6xl',
        )}
      >
        {children}
      </div>
    </div>
  );
}
