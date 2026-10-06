'use client';
import { motion } from 'motion/react';
import { cn } from '@/components/ui/cn';
import { useReducedMotionPref } from '@/lib/motion';

export interface ThinkingDotsProps {
  size?: 'sm' | 'md';
  className?: string;
}

const DOT: Record<NonNullable<ThinkingDotsProps['size']>, string> = {
  sm: 'size-1.5',
  md: 'size-2',
};

/**
 * Three bouncing gold dots ("the bot is thinking"). Purely decorative — the
 * thinking state is always also given in text. Reduced motion: a static ellipsis.
 */
export function ThinkingDots({ size = 'md', className }: ThinkingDotsProps) {
  const reduce = useReducedMotionPref();
  if (reduce) {
    return (
      <span
        aria-hidden="true"
        data-testid="thinking-dots"
        data-static=""
        className={cn('text-gold-300 inline-block leading-none font-bold', className)}
      >
        …
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-testid="thinking-dots"
      className={cn('inline-flex h-3 items-end gap-1', className)}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={cn(
            'bg-gold-300 block rounded-full shadow-[0_0_6px_rgb(245_215_122/0.7)]',
            DOT[size],
          )}
          animate={{ y: [0, -5, 0], opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}
