'use client';
/**
 * The Awards Shelf: every win title as a mini movie poster (foil Fraunces title,
 * film inspiration, game, Jeet won, date), newest first, each with a Share button
 * that renders the full 1200×630 poster PNG and opens the share sheet (or
 * downloads it). Render only after the stores have hydrated.
 *
 * The poster renderer (`@/lib/share-card`) is loaded on demand — it is prefetched once
 * the shelf has something to share, so it stays out of the page's first bundle.
 */
import { type CSSProperties, useEffect, useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { TrophyIcon } from '@/components/ui/icons';
import { CoinIcon, formatJeetDelta } from '@/components/ui/Jeet';
import { toast } from '@/components/ui/Toast';
import { siteConfig } from '@/config/site';
import { t } from '@/lib/i18n';
import { useStats, type Award } from '@/store/stats';
import {
  formatAwardDate,
  isAbortError,
  isValidTime,
  longestWord,
  nameFromSlug,
  shareFileName,
  sortAwards,
} from './stats-data';

const loadShareCard = () => import('@/lib/share-card');

/**
 * Title size in container units (the poster is a size container): the longest word
 * always fits the poster's width — no "Unbreakabl / e" splits on a 375 px phone — and
 * long titles shrink so they stay within about four lines, while short ones stay big.
 */
export function titleStyle(text: string): CSSProperties {
  const byWord = 145 / Math.max(6, longestWord(text));
  const byLength = 480 / Math.max(1, [...text].length);
  const fit = Math.min(16, byWord, byLength);
  return { fontSize: `clamp(0.875rem, ${fit.toFixed(2)}cqi, 1.375rem)` };
}

export interface AwardsShelfProps {
  /** slug → display name. */
  gameNames: Readonly<Record<string, string>>;
  /** titleId → one-line blurb, printed on the share card when known. */
  titleBlurbs?: Readonly<Record<string, string>>;
  className?: string;
}

/** Posters shown before "Show all". */
export const SHELF_INITIAL = 8;

/** Poster colourways, cycled along the shelf. */
const TONES = [
  'from-velvet-700 via-[#3d0b15] to-felt-950',
  'from-felt-500 via-felt-800 to-felt-950',
  'from-[#2a2338] via-[#15121d] to-felt-950',
  'from-[#5c420b] via-[#3b2a08] to-felt-950',
] as const;

function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 14.5V3.8M8 7.6l4-3.8 4 3.8M7.5 10.5H6a1.5 1.5 0 0 0-1.5 1.5v6.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5h-1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface PosterProps {
  award: Award;
  index: number;
  gameName: string;
  sharing: boolean;
  onShare: () => void;
}

function AwardPoster({ award, index, gameName, sharing, onShare }: PosterProps) {
  const titleId = useId();
  const date = formatAwardDate(award.at);
  return (
    <article
      aria-labelledby={titleId}
      data-testid={`award-${index}`}
      className={cn(
        'border-gold-300/55 @container relative flex h-full flex-col overflow-hidden rounded-xl border-2 bg-linear-to-b px-2.5 pt-5 pb-3 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_18px_32px_-20px_rgb(0_0_0/0.95)] sm:px-4',
        TONES[index % TONES.length],
      )}
    >
      <span
        aria-hidden="true"
        className="marquee-bulbs pointer-events-none absolute inset-x-3 top-1 h-2.5 [background-size:12px_10px] opacity-80"
      />
      <span
        aria-hidden="true"
        className="border-gold-300/25 pointer-events-none absolute inset-1.5 rounded-lg border"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(70%_100%_at_50%_0%,rgb(255_246_217/0.18),transparent_70%)]"
      />

      <p className="text-gold-200 relative text-[0.625rem] leading-snug font-bold tracking-[0.12em] uppercase min-[400px]:tracking-[0.2em] sm:tracking-[0.26em]">
        {t('stats.shelf.presents')}
      </p>
      <h3
        id={titleId}
        style={titleStyle(award.text)}
        // text-lg is the fallback for browsers without container query units.
        className="font-display text-foil relative mt-2 text-lg leading-[1.06] font-black tracking-[-0.01em] text-balance [overflow-wrap:anywhere] italic drop-shadow-[0_2px_6px_rgb(0_0_0/0.55)]"
      >
        {award.text}
      </h3>
      {award.film ? (
        <p className="font-display text-cream/90 relative mt-1.5 text-xs leading-snug italic">
          {t('stats.shelf.inspired', { film: award.film })}
        </p>
      ) : null}

      <span aria-hidden="true" className="relative my-3 flex items-center gap-2">
        <span className="via-gold-300/60 h-px flex-1 bg-linear-to-r from-transparent to-transparent" />
        <span className="bg-gold-300 size-1.5 rotate-45" />
        <span className="via-gold-300/60 h-px flex-1 bg-linear-to-r from-transparent to-transparent" />
      </span>

      <dl className="relative mt-auto flex flex-col items-center gap-1 text-xs">
        <div>
          <dt className="sr-only">{t('stats.shelf.gameLabel')}</dt>
          <dd className="text-cream font-semibold">{t('stats.shelf.wonAt', { game: gameName })}</dd>
        </div>
        <div>
          <dt className="sr-only">{t('stats.shelf.jeetLabel')}</dt>
          {/* The coin and amount never split; "Jeet" may drop to its own line. */}
          <dd className="text-gold-100 flex flex-wrap items-center justify-center gap-x-1 text-sm font-bold">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <CoinIcon size={16} className="shrink-0" />
              <span className="tabular">{formatJeetDelta(award.jeet)}</span>
            </span>{' '}
            <span>{t('wallet.currency')}</span>
          </dd>
        </div>
        {date ? (
          <div>
            <dt className="sr-only">{t('stats.shelf.dateLabel')}</dt>
            <dd className="text-mist">
              <time dateTime={isValidTime(award.at) ? new Date(award.at).toISOString() : undefined}>
                {date}
              </time>
            </dd>
          </div>
        ) : null}
      </dl>

      <Button
        size="sm"
        variant="secondary"
        fullWidth
        className="relative mt-3"
        data-testid={`share-award-${index}`}
        aria-label={t('stats.shelf.shareLabel', { title: award.text })}
        leadingIcon={<ShareIcon />}
        loading={sharing}
        loadingLabel={t('stats.shelf.sharing')}
        onClick={onShare}
      >
        {t('stats.shelf.share')}
      </Button>
    </article>
  );
}

export function AwardsShelf({ gameNames, titleBlurbs, className }: AwardsShelfProps) {
  const awards = useStats((s) => s.awards);
  const [expanded, setExpanded] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const headingId = useId();
  const listId = useId();

  const sorted = useMemo(() => sortAwards(awards), [awards]);
  const hasAwards = sorted.length > 0;
  const shown = expanded ? sorted : sorted.slice(0, SHELF_INITIAL);
  const nameOf = (slug: string) => gameNames[slug] ?? nameFromSlug(slug);

  // Warm up the poster renderer as soon as there is something to share, so a tap on
  // Share goes straight to drawing (and the share sheet keeps its user activation).
  useEffect(() => {
    if (hasAwards) void loadShareCard().catch(() => undefined);
  }, [hasAwards]);

  const share = async (award: Award) => {
    if (sharingId) return;
    setSharingId(award.id);
    const gameName = nameOf(award.gameSlug);
    try {
      const { createShareImage, shareOrDownload } = await loadShareCard();
      const blob = await createShareImage({
        title: award.text,
        film: award.film,
        blurb: titleBlurbs?.[award.titleId],
        gameName,
        jeet: award.jeet,
        dateLabel: formatAwardDate(award.at),
        siteUrl: siteConfig.url,
      });
      const how = await shareOrDownload(
        blob,
        shareFileName(award.text),
        t('stats.shelf.shareText', { title: award.text, game: gameName }),
      );
      toast(how === 'shared' ? t('stats.shelf.shared') : t('stats.shelf.downloaded'));
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Share card failed', error);
        toast({ message: t('stats.shelf.shareFailed'), tone: 'error' });
      }
    } finally {
      setSharingId(null);
    }
  };

  return (
    <section
      id="awards"
      aria-labelledby={headingId}
      data-testid="awards-shelf"
      className={cn(
        'border-gold-300/35 relative scroll-mt-24 overflow-hidden rounded-3xl border bg-[radial-gradient(120%_80%_at_50%_0%,rgb(116_22_40/0.55),rgb(6_36_23/0.9)_55%,rgb(3_17_11/0.95))] px-4 pt-6 pb-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_30px_60px_-30px_rgb(0_0_0/0.95)] sm:px-7 sm:pt-8 sm:pb-7',
        className,
      )}
    >
      {/* velvet curtain folds at the sides */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-[repeating-linear-gradient(90deg,rgb(116_22_40/0.9)_0_6px,rgb(158_32_54/0.75)_6px_12px)] opacity-70 sm:w-10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-[repeating-linear-gradient(90deg,rgb(158_32_54/0.75)_0_6px,rgb(116_22_40/0.9)_6px_12px)] opacity-70 sm:w-10"
      />

      <div className="relative flex flex-wrap items-end justify-between gap-3 px-3 sm:px-6">
        <div>
          <h2
            id={headingId}
            className="font-display text-foil flex items-center gap-2.5 text-3xl leading-tight font-black sm:text-4xl"
          >
            <TrophyIcon size={30} className="text-gold-300 shrink-0" />
            {t('stats.shelf.heading')}
          </h2>
          <p className="text-mist mt-1 text-sm">{t('stats.shelf.intro')}</p>
        </div>
        {sorted.length > 0 ? (
          <p
            data-testid="awards-count"
            className="border-gold-300/40 bg-felt-950/60 text-gold-200 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.16em] uppercase"
          >
            {sorted.length === 1
              ? t('stats.shelf.countOne')
              : t('stats.shelf.count', { n: sorted.length })}
          </p>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <div
          data-testid="awards-empty"
          className="relative mx-3 mt-6 flex flex-col items-center gap-4 px-2 pb-2 text-center sm:mx-6"
        >
          <div className="relative flex w-full max-w-md items-end justify-center gap-3 sm:gap-4">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  'bg-felt-950/40 flex aspect-[3/4] items-center justify-center rounded-lg border-2 border-dashed',
                  i === 1 ? 'border-gold-300/60 w-1/3' : 'border-gold-300/35 w-1/4',
                )}
              >
                {i === 1 ? <TrophyIcon size={34} className="text-gold-300/80" /> : null}
              </span>
            ))}
            <span
              aria-hidden="true"
              className="absolute inset-x-0 -bottom-2 h-2 rounded-full bg-[linear-gradient(180deg,var(--color-gold-400),var(--color-gold-700))] shadow-[0_6px_14px_-4px_rgb(0_0_0/0.8)]"
            />
          </div>
          <p className="font-display text-gold-100 mt-3 text-xl leading-snug font-bold text-balance sm:text-2xl">
            {t('stats.shelf.emptyTitle')}
          </p>
          <p className="text-mist max-w-md text-sm leading-relaxed">{t('stats.shelf.emptyBody')}</p>
          <Button href="/games?playable=1">{t('stats.shelf.emptyCta')}</Button>
        </div>
      ) : (
        <>
          <ol
            role="list"
            id={listId}
            aria-label={t('stats.shelf.listLabel')}
            className="relative mt-6 grid grid-cols-2 gap-x-3 gap-y-7 px-3 sm:grid-cols-3 sm:gap-x-5 sm:px-6 lg:grid-cols-4"
          >
            {shown.map((award, index) => (
              <li key={award.id} className="relative flex flex-col pb-3">
                <AwardPoster
                  award={award}
                  index={index}
                  gameName={nameOf(award.gameSlug)}
                  sharing={sharingId === award.id}
                  onShare={() => void share(award)}
                />
                {/* the brass shelf the poster stands on */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-[-6px] bottom-0 h-2 rounded-full bg-[linear-gradient(180deg,var(--color-gold-300),var(--color-gold-600)_60%,var(--color-gold-700))] shadow-[0_8px_14px_-6px_rgb(0_0_0/0.9)]"
                />
              </li>
            ))}
          </ol>
          {sorted.length > SHELF_INITIAL ? (
            <div className="relative mt-6 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={expanded}
                aria-controls={listId}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded
                  ? t('stats.shelf.showFewer')
                  : t('stats.shelf.showAll', { n: sorted.length })}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
