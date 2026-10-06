'use client';
/**
 * The stats page's "box office" card: Jeet balance, the Daily Udhaar when it can be
 * claimed, the latest ledger entries and the pretend-money notice. Render only after
 * the stores have hydrated.
 */
import { useId, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useNow } from '@/components/ui/hooks';
import { CardsIcon, ShieldNoticeIcon, SparkleIcon, TrophyIcon } from '@/components/ui/icons';
import { CoinIcon, formatJeet, formatJeetDelta } from '@/components/ui/Jeet';
import { UdhaarOffer } from '@/components/layout/UdhaarOffer';
import { relativeTime } from '@/components/layout/WalletDialog';
import { siteConfig } from '@/config/site';
import { t } from '@/lib/i18n';
import { udhaarStatus, useWallet, type LedgerEntry } from '@/store/wallet';
import { nameFromSlug } from './stats-data';

export interface WalletCardProps {
  /** slug → display name, for ledger rows. */
  gameNames: Readonly<Record<string, string>>;
  className?: string;
}

/** How many ledger entries the card lists. */
export const WALLET_LEDGER_ROWS = 5;

function ReasonIcon({ reason }: { reason: LedgerEntry['reason'] }) {
  if (reason === 'payout') return <TrophyIcon size={16} />;
  if (reason === 'udhaar') return <SparkleIcon size={16} />;
  if (reason === 'refund') return <CoinIcon size={16} />;
  return <CardsIcon size={16} />;
}

export function WalletCard({ gameNames, className }: WalletCardProps) {
  const balance = useWallet((s) => s.balance);
  const lastUdhaarAt = useWallet((s) => s.lastUdhaarAt);
  const ledger = useWallet((s) => s.ledger);
  const now = useNow(30_000);
  const headingId = useId();
  const recentId = useId();
  const balanceRef = useRef<HTMLParagraphElement>(null);
  const eligible = udhaarStatus(balance, lastUdhaarAt, now).eligible;
  const recent = ledger.slice(0, WALLET_LEDGER_ROWS);

  return (
    <section
      aria-labelledby={headingId}
      data-testid="stats-wallet"
      className={cn('panel relative flex flex-col gap-4 overflow-hidden p-5 sm:p-6', className)}
    >
      <span
        aria-hidden="true"
        className="marquee-bulbs pointer-events-none absolute inset-x-5 top-1.5 h-2 [background-size:14px_8px] [background-repeat:space_no-repeat] opacity-60"
      />
      <h2 id={headingId} className="font-display text-gold-100 text-2xl leading-tight font-bold">
        {t('stats.wallet.heading')}
      </h2>

      {/* Tablets get the full-width card as two columns (balance | activity). */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start md:gap-x-6 lg:flex lg:items-stretch">
        <div className="flex flex-col gap-4">
          <div className="border-gold-300/35 relative rounded-2xl border bg-[radial-gradient(120%_120%_at_50%_0%,rgb(245_215_122/0.16),rgb(3_17_11/0.6)_70%)] px-4 py-4 text-center">
            <p className="text-gold-300 text-xs font-bold tracking-[0.2em] uppercase">
              {t('stats.wallet.balance')}
            </p>
            <p
              ref={balanceRef}
              tabIndex={-1}
              className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg"
            >
              <CoinIcon size={40} className="shrink-0 drop-shadow-[0_4px_10px_rgb(0_0_0/0.5)]" />
              <span
                data-testid="stats-balance"
                className="tabular font-display text-foil min-w-0 text-4xl font-black break-all min-[400px]:text-5xl"
              >
                {formatJeet(balance)}
              </span>
              <span className="text-gold-200 self-end pb-1.5 text-sm font-bold">
                {t('wallet.currency')}
              </span>
            </p>
          </div>

          {eligible ? (
            <UdhaarOffer
              compact
              onClaimed={() => balanceRef.current?.focus({ preventScroll: true })}
            />
          ) : null}

          <p
            data-testid="stats-wallet-notice"
            className="border-gold-300/25 bg-felt-950/50 text-cream flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-snug font-semibold"
          >
            <ShieldNoticeIcon size={18} className="text-gold-300 mt-px shrink-0" />
            <span>{siteConfig.currency.notice}</span>
          </p>
        </div>

        <div>
          <h3 id={recentId} className="text-gold-300 text-xs font-bold tracking-[0.2em] uppercase">
            {t('stats.wallet.recent')}
          </h3>
          {recent.length === 0 ? (
            <p className="text-mist mt-2 text-sm">{t('stats.wallet.empty')}</p>
          ) : (
            <ul role="list" aria-labelledby={recentId} className="divide-gold-300/10 mt-1 divide-y">
              {recent.map((entry, i) => {
                const credit = entry.amount > 0;
                const game = entry.gameSlug
                  ? (gameNames[entry.gameSlug] ?? nameFromSlug(entry.gameSlug))
                  : null;
                return (
                  <li key={`${entry.at}-${i}`} className="flex items-center gap-3 py-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'inline-flex size-8 shrink-0 items-center justify-center rounded-full border',
                        credit
                          ? 'border-gold-300/40 bg-gold-300/10 text-gold-200'
                          : 'border-felt-500 bg-felt-900 text-mist',
                      )}
                    >
                      <ReasonIcon reason={entry.reason} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-cream block truncate text-sm font-semibold">
                        {t(`wallet.reasons.${entry.reason}`)}
                        {game ? <span className="text-mist font-normal"> · {game}</span> : null}
                      </span>
                      <span className="text-mist block text-xs">{relativeTime(entry.at, now)}</span>
                    </span>
                    <span
                      className={cn(
                        'tabular shrink-0 text-sm font-bold',
                        credit ? 'text-gold-200' : 'text-velvet-300',
                      )}
                    >
                      {formatJeetDelta(entry.amount)}
                      <span className="sr-only"> {t('wallet.currency')}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <Button href="/games" variant="secondary" size="sm" className="mt-auto self-start">
        {t('stats.wallet.findGame')}
      </Button>
    </section>
  );
}
