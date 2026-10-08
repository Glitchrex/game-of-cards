'use client';
/** "Drop out of this game?" — confirms the 20 / 40-point cost before giving up the hand. */
import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { t } from '@/games/indian-rummy/i18n';
import { type DropKind } from '../engine';

export function DropDialog({
  open,
  kind,
  points,
  onConfirm,
  onClose,
}: {
  open: boolean;
  kind: DropKind;
  points: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      role="alertdialog"
      size="sm"
      title={t('indianRummy.drop.title')}
      description={kind === 'first' ? t('indianRummy.drop.first') : t('indianRummy.drop.middle')}
      initialFocusRef={keepRef}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={keepRef}
            variant="secondary"
            onClick={onClose}
            data-testid="rummy-drop-cancel"
          >
            {t('indianRummy.drop.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} data-testid="rummy-drop-confirm">
            {t('indianRummy.drop.confirm', { points })}
          </Button>
        </div>
      }
    />
  );
}
