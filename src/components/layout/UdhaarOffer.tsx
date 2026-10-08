'use client';
/**
 * The Daily Udhaar: a free 500 Jeet top-up once a day when the learner is
 * nearly broke (balance < 100). Pretend money only — there is no way to buy,
 * sell or withdraw Jeet. Reused by the wallet dialog and the bet panel.
 */
import { useId, useRef } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useNow } from '@/components/ui/hooks';
import { ClockIcon, InfoIcon } from '@/components/ui/icons';
import { CoinIcon, formatJeet } from '@/components/ui/Jeet';
import { toast } from '@/components/ui/Toast';
import { t } from '@/lib/i18n';
import { playSound } from '@/lib/sound';
import { useHydrated } from '@/store/hydrate';
import { UDHAAR_AMOUNT, UDHAAR_THRESHOLD, udhaarStatus, useWallet } from '@/store/wallet';

export interface UdhaarOfferProps {
  /** One-line strip (for the bet panel) instead of the full ticket card. */
  compact?: boolean;
  /** Called after a successful claim. */
  onClaimed?: () => void;
  className?: string;
}

/** "5h 12m" / "12m" / "under a minute". */
export function formatCooldown(ms: number): string {
  if (ms < 60_000) return t('wallet.udhaar.underMinute');
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? t('wallet.udhaar.hoursMinutes', { h, m }) : t('wallet.udhaar.minutes', { m });
}

/** Claim the udhaar with feedback (toast + coin chime). Returns success. */
export function useClaimUdhaar(onClaimed?: () => void) {
  const claimUdhaar = useWallet((s) => s.claimUdhaar);
  return () => {
    if (!claimUdhaar()) return false;
    playSound('coin');
    toast(t('wallet.udhaar.claimed', { amount: formatJeet(UDHAAR_AMOUNT) }));
    onClaimed?.();
    return true;
  };
}

export function UdhaarOffer({ compact = false, onClaimed, className }: UdhaarOfferProps) {
  const hydrated = useHydrated();
  const balance = useWallet((s) => s.balance);
  const lastUdhaarAt = useWallet((s) => s.lastUdhaarAt);
  const now = useNow(15_000);
  const rootRef = useRef<HTMLElement>(null);
  // The claim button disappears once the udhaar is granted; park focus on the
  // offer itself (instead of dropping it to <body>) before `onClaimed` runs,
  // so a caller can still move it somewhere more useful.
  const claim = useClaimUdhaar(() => {
    rootRef.current?.focus({ preventScroll: true });
    onClaimed?.();
  });
  const titleId = useId();
  if (!hydrated) return null;

  const status = udhaarStatus(balance, lastUdhaarAt, now);
  const claimLabel = t('wallet.udhaar.claim', { amount: formatJeet(UDHAAR_AMOUNT) });
  const threshold = formatJeet(UDHAAR_THRESHOLD);

  if (compact) {
    return (
      <div
        ref={(el) => {
          rootRef.current = el;
        }}
        tabIndex={-1}
        data-testid="udhaar-offer"
        data-state={status.reason}
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 text-sm',
          status.eligible
            ? 'border-gold-300/60 bg-[linear-gradient(100deg,rgb(116_22_40/0.85),rgb(10_53_36/0.9))]'
            : 'border-gold-300/20 bg-felt-950/40',
          className,
        )}
      >
        {status.eligible ? (
          <>
            <CoinIcon size={22} className="shrink-0" />
            <p className="text-cream min-w-0 flex-1 leading-snug font-medium">
              {t('wallet.udhaar.offer')}
            </p>
            <Button size="sm" onClick={claim} className="max-sm:w-full">
              {claimLabel}
            </Button>
          </>
        ) : status.reason === 'cooldown' ? (
          <p className="text-mist flex items-center gap-2">
            <ClockIcon size={18} className="text-gold-300 shrink-0" />
            <span>{t('wallet.udhaar.cooldown', { time: formatCooldown(status.msUntilNext) })}</span>
          </p>
        ) : (
          <p className="text-mist flex items-center gap-2">
            <InfoIcon size={18} className="text-gold-300 shrink-0" />
            <span>{t('wallet.udhaar.notBrokeShort', { threshold })}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <section
      ref={(el) => {
        rootRef.current = el;
      }}
      tabIndex={-1}
      aria-labelledby={titleId}
      data-testid="udhaar-offer"
      data-state={status.reason}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4 sm:p-5',
        status.eligible
          ? 'border-gold-300/70 bg-[radial-gradient(120%_100%_at_0%_0%,rgb(158_32_54/0.95),rgb(116_22_40/0.9)_45%,rgb(10_53_36/0.95))] shadow-[0_14px_40px_-18px_rgb(194_47_71/0.9)]'
          : 'border-gold-300/20 bg-felt-950/45',
        className,
      )}
    >
      {/* ticket-stub perforation */}
      <span
        aria-hidden="true"
        className="border-gold-300/30 pointer-events-none absolute inset-y-3 right-16 hidden border-r border-dashed sm:block"
      />
      <div className="flex items-center gap-2">
        <h3 id={titleId} className="font-display text-gold-100 text-lg font-bold">
          {t('wallet.udhaar.title')}
        </h3>
        {status.eligible ? (
          <Badge tone="gold" size="sm" pulse>
            {t('wallet.udhaar.available')}
          </Badge>
        ) : null}
      </div>

      {status.eligible ? (
        <div className="mt-2 flex flex-col gap-3 sm:pr-20">
          <p className="font-display text-cream text-[1.0625rem] leading-snug italic">
            {t('wallet.udhaar.offer')}
          </p>
          <Button
            onClick={claim}
            leadingIcon={<CoinIcon size={20} />}
            className="self-start max-sm:w-full"
          >
            {claimLabel}
          </Button>
        </div>
      ) : status.reason === 'cooldown' ? (
        <div className="mt-2 flex items-start gap-3">
          <ClockIcon size={22} className="text-gold-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-cream font-semibold">
              {t('wallet.udhaar.cooldown', { time: formatCooldown(status.msUntilNext) })}
            </p>
            <p className="text-mist mt-0.5 text-sm">{t('wallet.udhaar.cooldownHint')}</p>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-start gap-3">
          <InfoIcon size={22} className="text-gold-300 mt-0.5 shrink-0" />
          <p className="text-mist text-sm leading-relaxed">
            {t('wallet.udhaar.notBroke', { threshold })}
          </p>
        </div>
      )}
      {status.eligible ? (
        <CoinIcon
          size={64}
          className="pointer-events-none absolute -right-2 -bottom-3 hidden rotate-12 opacity-90 drop-shadow-[0_6px_14px_rgb(0_0_0/0.5)] sm:block"
        />
      ) : null}
    </section>
  );
}
