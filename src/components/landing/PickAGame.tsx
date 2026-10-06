'use client';
/**
 * "Pick a game for me" trigger: a small client island. The dialog's code is fetched on
 * demand (warmed up on pointer-enter/focus, loaded on click) so it stays out of the landing
 * page's initial bundle.
 */
import { useState, type ComponentType } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/Button';
import { TicketIcon } from '@/components/ui/icons';
import { toast } from '@/components/ui/Toast';
import { t } from '@/lib/i18n';
import { type PickableGame, type PickAGameDialogProps } from './pick-data';

type DialogComponent = ComponentType<PickAGameDialogProps>;

let dialogPromise: Promise<DialogComponent> | null = null;
/** Fetch the dialog chunk once; a failed fetch is forgotten so the next try can retry. */
function loadDialog(): Promise<DialogComponent> {
  dialogPromise ??= import('./PickAGameDialog').then(
    (m) => m.PickAGameDialog,
    (err: unknown) => {
      dialogPromise = null;
      throw err;
    },
  );
  return dialogPromise;
}

export interface PickAGameProps {
  /** Slim catalog records for the recommender (see `toPickableGame`). */
  games: readonly PickableGame[];
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  'data-testid'?: string;
}

export function PickAGame({
  games,
  label = t('landing.hero.ctaPick'),
  variant = 'secondary',
  size = 'lg',
  className,
  'data-testid': testId = 'cta-pick',
}: PickAGameProps) {
  const [Dialog, setDialog] = useState<DialogComponent | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const warmUp = () => {
    loadDialog().catch(() => {
      /* retried on click */
    });
  };

  const openDialog = async () => {
    if (Dialog) {
      setOpen(true);
      return;
    }
    setLoading(true);
    try {
      const C = await loadDialog();
      setDialog(() => C);
      setOpen(true);
    } catch {
      toast({ message: t('common.errors.network'), tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        data-testid={testId}
        aria-haspopup="dialog"
        loading={loading}
        loadingLabel={t('landing.pick.loading')}
        leadingIcon={<TicketIcon size={20} />}
        onPointerEnter={warmUp}
        onFocus={warmUp}
        onClick={() => void openDialog()}
      >
        {label}
      </Button>
      {Dialog ? <Dialog open={open} onClose={() => setOpen(false)} games={games} /> : null}
    </>
  );
}
