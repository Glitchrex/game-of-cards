'use client';
import { useId, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';
import { type LogEntry } from './useGameController';

export interface MoveLogProps {
  log: readonly LogEntry[];
  /** How many recent entries the compact view shows (default 4). */
  recent?: number;
  className?: string;
}

/**
 * Compact move history: the last few moves, newest at the bottom, with a toggle for
 * the full log. Not a live region — the controller already announces every move.
 */
export function MoveLog({ log, recent = 4, className }: MoveLogProps) {
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const listId = useId();
  const shown = expanded ? log : log.slice(-recent);
  const hidden = log.length - shown.length;

  return (
    <section
      aria-labelledby={headingId}
      data-testid="move-log"
      className={cn('panel px-4 py-3', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-gold-200 text-sm font-bold tracking-wide">
          {t('play.log.title')}
        </h2>
        {log.length > recent ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((e) => !e)}
            className="text-gold-300 hover:text-gold-100 -mr-2 inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold underline-offset-2 hover:underline"
          >
            {expanded ? t('play.log.showLess') : t('play.log.showAll', { count: log.length })}
          </button>
        ) : null}
      </div>
      {log.length === 0 ? (
        <p className="text-mist mt-1 text-sm">{t('play.log.empty')}</p>
      ) : (
        <ol
          id={listId}
          start={hidden + 1}
          className={cn(
            'mt-1 space-y-1 text-sm leading-snug',
            expanded && 'max-h-64 overflow-y-auto overscroll-contain pr-1',
          )}
        >
          {shown.map((entry, i) => {
            const latest = i === shown.length - 1;
            return (
              <li
                key={entry.id}
                data-player={entry.player}
                className={cn('flex items-start gap-2', latest ? 'text-cream' : 'text-mist')}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                    entry.player === 0 ? 'bg-gold-300' : 'bg-mist/60',
                  )}
                />
                <span className={latest ? 'font-semibold' : undefined}>{entry.text}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
