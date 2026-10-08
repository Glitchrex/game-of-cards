'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CheckIcon, CopyIcon } from '@/components/ui/icons';
import { toast } from '@/components/ui/Toast';
import { siteConfig } from '@/config/site';
import { t } from '@/lib/i18n';
import { playSound } from '@/lib/sound';
import { copyText } from './copy';

export interface CopyEmailButtonProps {
  /** Defaults to the creator email from siteConfig. */
  email?: string;
  className?: string;
}

/** "Copy email" button with a toast confirmation and a brief "Copied!" state. */
export function CopyEmailButton({
  email = siteConfig.creator.email,
  className,
}: CopyEmailButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopy = async () => {
    const ok = await copyText(email);
    if (!ok) {
      toast({ message: t('contact.email.failed', { email }), tone: 'error', durationMs: 7000 });
      return;
    }
    playSound('click');
    toast(t('contact.email.toast'));
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onCopy}
      data-testid="copy-email"
      className={className}
      leadingIcon={copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
    >
      {copied ? t('contact.email.copied') : t('contact.email.copy')}
    </Button>
  );
}
