'use client';
/**
 * "Start over": a danger button with a confirmation dialog that resets the wallet,
 * the stats (and Awards Shelf) and the learning progress. Settings are kept.
 */
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { AlertIcon } from '@/components/ui/icons';
import { formatJeet } from '@/components/ui/Jeet';
import { toast } from '@/components/ui/Toast';
import { t } from '@/lib/i18n';
import { useProgress } from '@/store/progress';
import { useStats } from '@/store/stats';
import { STARTING_BALANCE, useWallet } from '@/store/wallet';

/** Reset every learner store except settings. */
export function resetAllProgress(): void {
  useWallet.getState().reset();
  useStats.getState().reset();
  useProgress.getState().reset();
}

export function ResetProgress({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const amount = formatJeet(STARTING_BALANCE);

  const confirm = () => {
    resetAllProgress();
    setOpen(false);
    toast(t('stats.reset.done', { amount }));
  };

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'border-velvet-400/40 flex flex-col gap-4 rounded-2xl border bg-[linear-gradient(120deg,rgb(116_22_40/0.35),rgb(3_17_11/0.5))] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="border-velvet-400/50 bg-velvet-700/60 text-velvet-300 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border"
        >
          <AlertIcon size={20} />
        </span>
        <div>
          <h2 id={headingId} className="font-display text-cream text-xl leading-tight font-bold">
            {t('stats.reset.heading')}
          </h2>
          <p className="text-mist mt-1 max-w-xl text-sm leading-relaxed">
            {t('stats.reset.body', { amount })}
          </p>
        </div>
      </div>
      <Button
        variant="danger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-testid="reset-progress"
        className="shrink-0 max-sm:w-full"
      >
        {t('stats.reset.button')}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        role="alertdialog"
        size="sm"
        eyebrow={t('stats.reset.dialogEyebrow')}
        title={t('stats.reset.dialogTitle')}
        description={t('stats.reset.dialogBody', { amount })}
        initialFocusRef={cancelRef}
        footer={
          <>
            <Button ref={cancelRef} variant="secondary" size="sm" onClick={() => setOpen(false)}>
              {t('stats.reset.cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={confirm} data-testid="reset-confirm">
              {t('stats.reset.confirm')}
            </Button>
          </>
        }
      />
    </section>
  );
}
