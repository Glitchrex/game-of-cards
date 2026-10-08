'use client';
import { useId } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { useNow } from '@/components/ui/hooks';
import { CardsIcon, ShieldNoticeIcon, SparkleIcon, TrophyIcon } from '@/components/ui/icons';
import { CoinIcon, formatJeet, formatJeetDelta } from '@/components/ui/Jeet';
import { siteConfig } from '@/config/site';
import { t } from '@/lib/i18n';
import { type LedgerEntry, useWallet } from '@/store/wallet';
import { UdhaarOffer } from './UdhaarOffer';

export interface WalletDialogProps {
  open: boolean;
  onClose: () => void;
}

const LEDGER_ROWS = 8;
const rtf =
  typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
    ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    : null;

/** "just now" · "5 minutes ago" · "yesterday". */
export function relativeTime(at: number, now: number): string {
  const s = Math.round((now - at) / 1000);
  if (s < 45 || !rtf) return t('wallet.justNow');
  const m = Math.round(s / 60);
  if (m < 60) return rtf.format(-m, 'minute');
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, 'hour');
  return rtf.format(-Math.round(h / 24), 'day');
}

/** "teen-patti" → "Teen Patti". */
export function prettySlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function ReasonIcon({ reason }: { reason: LedgerEntry['reason'] }) {
  if (reason === 'payout') return <TrophyIcon size={18} />;
  if (reason === 'udhaar') return <SparkleIcon size={18} />;
  if (reason === 'refund') return <CoinIcon size={18} />;
  return <CardsIcon size={18} />;
}

function LedgerRow({ entry, now }: { entry: LedgerEntry; now: number }) {
  const credit = entry.amount > 0;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-full border',
          credit
            ? 'border-gold-300/40 bg-gold-300/10 text-gold-200'
            : 'border-felt-500 bg-felt-900 text-mist',
        )}
      >
        <ReasonIcon reason={entry.reason} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-cream truncate text-sm font-semibold">
          {t(`wallet.reasons.${entry.reason}`)}
          {entry.gameSlug ? (
            <span className="text-mist font-normal"> · {prettySlug(entry.gameSlug)}</span>
          ) : null}
        </p>
        <p className="text-mist text-xs">{relativeTime(entry.at, now)}</p>
      </div>
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
}

/** Wallet details: balance, pretend-money notice, Daily Udhaar and recent ledger. */
export function WalletDialog({ open, onClose }: WalletDialogProps) {
  const balance = useWallet((s) => s.balance);
  const ledger = useWallet((s) => s.ledger);
  const now = useNow(30_000);
  const recent = ledger.slice(0, LEDGER_ROWS);
  const recentId = useId();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={t('wallet.eyebrow')}
      title={t('wallet.dialogTitle')}
      footer={
        <>
          <Button variant="ghost" size="sm" href="/stats" onClick={onClose}>
            {t('wallet.viewStats')}
          </Button>
          <Button size="sm" href="/games" onClick={onClose}>
            {t('wallet.findGame')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="border-gold-300/35 relative overflow-hidden rounded-2xl border bg-[radial-gradient(120%_120%_at_50%_0%,rgb(245_215_122/0.16),rgb(3_17_11/0.6)_70%)] px-5 py-5 text-center">
          <span
            aria-hidden="true"
            className="marquee-bulbs pointer-events-none absolute inset-x-4 top-1.5 h-2 [background-size:14px_8px] [background-repeat:space_no-repeat] opacity-60"
          />
          <p className="text-gold-300 text-xs font-bold tracking-[0.2em] uppercase">
            {t('wallet.balance')}
          </p>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <CoinIcon size={40} className="shrink-0 drop-shadow-[0_4px_10px_rgb(0_0_0/0.5)]" />
            <span className="tabular font-display text-foil min-w-0 text-4xl font-black break-all min-[400px]:text-5xl">
              {formatJeet(balance)}
            </span>
            <span className="text-gold-200 self-end pb-1.5 text-sm font-bold">
              {t('wallet.currency')}
            </span>
          </p>
        </div>

        <p
          className="border-gold-300/25 bg-felt-950/50 text-cream flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-snug font-semibold"
          data-testid="wallet-notice"
        >
          <ShieldNoticeIcon size={18} className="text-gold-300 mt-px shrink-0" />
          <span>{siteConfig.currency.notice}</span>
        </p>

        <UdhaarOffer />

        <section aria-labelledby={recentId}>
          <h3 id={recentId} className="text-gold-300 text-xs font-bold tracking-[0.2em] uppercase">
            {t('wallet.recent')}
          </h3>
          {recent.length === 0 ? (
            <p className="text-mist mt-2 text-sm">{t('wallet.empty')}</p>
          ) : (
            <ul className="divide-gold-300/10 mt-1 divide-y">
              {recent.map((e, i) => (
                <LedgerRow key={`${e.at}-${i}`} entry={e} now={now} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
}
