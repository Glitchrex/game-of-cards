'use client';
import { cn } from '@/components/ui/cn';

const CHIP_COLOURS = [
  ['#c22f47', '#9e2036'],
  ['#1b5fc1', '#174f9f'],
  ['#12793a', '#0e5f2e'],
  ['#17161b', '#2e2c35'],
] as const;

/** One casino chip (decorative SVG). */
export function Chip({ tone = 0, className }: { tone?: number; className?: string }) {
  const [outer, inner] = CHIP_COLOURS[tone % CHIP_COLOURS.length] ?? CHIP_COLOURS[0];
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn('drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]', className)}
    >
      <circle cx={16} cy={16} r={15} fill={outer} />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <rect
          key={k}
          x={14}
          y={1.2}
          width={4}
          height={5}
          rx={0.8}
          fill="#fbf6ea"
          transform={`rotate(${k * 60} 16 16)`}
        />
      ))}
      <circle cx={16} cy={16} r={9.5} fill={inner} />
      <circle cx={16} cy={16} r={9.5} fill="none" stroke="#f5d77a" strokeOpacity={0.8} />
    </svg>
  );
}

/** How many chips to draw for an amount of boots (taller stacks for bigger amounts). */
export function chipCount(amount: number, max = 4): number {
  if (amount <= 0) return 0;
  const n =
    amount >= 40 ? 6 : amount >= 20 ? 5 : amount >= 10 ? 4 : amount >= 5 ? 3 : amount >= 2 ? 2 : 1;
  return Math.min(n, max);
}

/** A little stack of chips (decorative). */
export function ChipStack({
  amount,
  max = 4,
  className,
}: {
  amount: number;
  max?: number;
  className?: string;
}) {
  const count = Math.max(1, chipCount(amount, max));
  return (
    <span aria-hidden="true" className={cn('relative inline-flex size-5 shrink-0', className)}>
      {Array.from({ length: count }, (_, i) => (
        // Stacked upwards, a few pixels per chip.
        <span key={i} className="absolute inset-0" style={{ transform: `translateY(${-i * 3}px)` }}>
          <Chip tone={i} className="size-full" />
        </span>
      ))}
    </span>
  );
}
