import { useId } from 'react';
import { t } from '@/lib/i18n';
import { cn } from './cn';

/** "1,000" — Jeet amounts always use digits with thousands separators. */
export function formatJeet(amount: number): string {
  const n = Math.round(amount);
  // Plain digit grouping (same output as toLocaleString('en-US') for whole numbers) — it runs
  // every frame of the wallet count-up, and toLocaleString builds an Intl formatter per call.
  if (!Number.isSafeInteger(n)) return n.toLocaleString('en-US');
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? `-${digits}` : digits;
}

/** "+500" / "−120" with a real minus sign. */
export function formatJeetDelta(amount: number): string {
  const r = Math.round(amount);
  if (r > 0) return `+${formatJeet(r)}`;
  if (r < 0) return `−${formatJeet(-r)}`;
  return '0';
}

/** Gradient ids must be valid in url(#…) references. */
function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export interface CoinIconProps {
  size?: number;
  className?: string;
  /** Accessible name; decorative when omitted. */
  title?: string;
}

/** Original gold Jeet coin: milled rim, embossed spade, specular shine. */
export function CoinIcon({ size = 20, className, title }: CoinIconProps) {
  const face = useSvgId('coin-face-');
  const rim = useSvgId('coin-rim-');
  const a11y = title
    ? ({ role: 'img', 'aria-label': title } as const)
    : ({ 'aria-hidden': true, focusable: 'false' } as const);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...a11y}>
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6d9" />
          <stop offset="0.45" stopColor="#ecc153" />
          <stop offset="1" stopColor="#8a6312" />
        </linearGradient>
        <radialGradient id={face} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#fbe8a6" />
          <stop offset="0.55" stopColor="#ecc153" />
          <stop offset="1" stopColor="#b4841a" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11.2" fill={`url(#${rim})`} />
      <circle
        cx="12"
        cy="12"
        r="10.2"
        fill="none"
        stroke="#8a6312"
        strokeOpacity="0.55"
        strokeWidth="1"
        strokeDasharray="1 1.2"
      />
      <circle cx="12" cy="12" r="8.4" fill={`url(#${face})`} stroke="#b4841a" strokeWidth="0.8" />
      <g transform="translate(7.3 6.9) scale(0.39)">
        <path
          transform="translate(0.9 0.9)"
          fill="#fff6d9"
          fillOpacity="0.55"
          d="M12 2.5c-.4 0-.8.2-1 .5C8.6 6 4 9.1 4 13.1 4 15.8 6 17.6 8.3 17.6c1.2 0 2.2-.4 2.9-1.1-.2 1.9-.9 3.3-2.2 4.1-.4.3-.2.9.3.9h5.4c.5 0 .7-.6.3-.9-1.3-.8-2-2.2-2.2-4.1.7.7 1.7 1.1 2.9 1.1 2.3 0 4.3-1.8 4.3-4.5 0-4-4.6-7.1-7-10.1-.2-.3-.6-.5-1-.5Z"
        />
        <path
          fill="#8a6312"
          d="M12 2.5c-.4 0-.8.2-1 .5C8.6 6 4 9.1 4 13.1 4 15.8 6 17.6 8.3 17.6c1.2 0 2.2-.4 2.9-1.1-.2 1.9-.9 3.3-2.2 4.1-.4.3-.2.9.3.9h5.4c.5 0 .7-.6.3-.9-1.3-.8-2-2.2-2.2-4.1.7.7 1.7 1.1 2.9 1.1 2.3 0 4.3-1.8 4.3-4.5 0-4-4.6-7.1-7-10.1-.2-.3-.6-.5-1-.5Z"
        />
      </g>
      <ellipse
        cx="8.2"
        cy="6.6"
        rx="3.2"
        ry="1.6"
        fill="#ffffff"
        fillOpacity="0.45"
        transform="rotate(-30 8.2 6.6)"
      />
    </svg>
  );
}

export interface JeetAmountProps {
  amount: number;
  /** Prefix + / − (for ledger rows and payouts). */
  signed?: boolean;
  /** Show the word "Jeet" visibly; otherwise it is screen-reader only. */
  showUnit?: boolean;
  coinSize?: number;
  className?: string;
}

/** Coin + tabular amount, e.g. ⓙ 1,000. Always reads "1,000 Jeet" to screen readers. */
export function JeetAmount({
  amount,
  signed = false,
  showUnit = false,
  coinSize = 18,
  className,
}: JeetAmountProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-bold', className)}>
      <CoinIcon size={coinSize} className="shrink-0" />
      <span className="tabular">{signed ? formatJeetDelta(amount) : formatJeet(amount)}</span>
      {showUnit ? (
        <span>{t('wallet.currency')}</span>
      ) : (
        <span className="sr-only"> {t('wallet.currency')}</span>
      )}
    </span>
  );
}
