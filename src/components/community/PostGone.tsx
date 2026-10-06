/**
 * 404 state for a Community Board post that doesn't exist (or was removed):
 * used by /community/[id]/not-found.tsx and by PostDetail when a refresh 404s.
 */
import { CardBack, PlayingCard } from '@/components/cards/PlayingCard';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';
import { ArrowLeftIcon } from './icons';

export function PostGone({ className }: { className?: string }) {
  return (
    <div
      className={cn('panel relative overflow-hidden px-6 py-10 text-center sm:py-12', className)}
      data-testid="post-not-found"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_0%,rgb(245_215_122/0.14),transparent_70%)]"
      />
      <div aria-hidden="true" className="relative mx-auto flex h-28 w-48 items-end justify-center">
        <span className="absolute bottom-0 left-6 origin-bottom -rotate-[14deg]">
          <PlayingCard code="4S" size="sm" decorative />
        </span>
        <span className="animate-float relative z-10">
          <CardBack size="sm" />
        </span>
        <span className="absolute right-6 bottom-0 origin-bottom rotate-[14deg]">
          <PlayingCard code="4H" size="sm" decorative />
        </span>
      </div>
      <p className="text-gold-300 relative mt-6 text-xs font-bold tracking-[0.26em] uppercase">
        404
      </p>
      <h1 className="font-display text-foil relative mt-2 text-3xl font-black text-balance sm:text-4xl">
        {t('community.detail.goneTitle')}
      </h1>
      <p className="text-mist relative mx-auto mt-3 max-w-md leading-relaxed text-pretty">
        {t('community.detail.goneBody')}
      </p>
      <div className="relative mt-6">
        <Button href="/community" leadingIcon={<ArrowLeftIcon size={18} />}>
          {t('community.detail.back')}
        </Button>
      </div>
    </div>
  );
}
