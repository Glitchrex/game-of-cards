'use client';
/** Gear button in the header that opens the table-settings popover. */
import { GearIcon } from '@/components/ui/icons';
import { Popover } from '@/components/ui/Popover';
import { t } from '@/lib/i18n';
import { SettingsPanel } from './SettingsPanel';

export interface SettingsMenuProps {
  className?: string;
}

export function SettingsMenu({ className }: SettingsMenuProps) {
  return (
    <span className={className}>
      <Popover
        align="end"
        title={t('settings.title')}
        trigger={<GearIcon size={22} />}
        triggerLabel={t('settings.open')}
        triggerClassName="inline-flex size-11 items-center justify-center rounded-full text-mist transition-[background-color,color,transform] duration-300 hover:bg-white/[0.08] hover:text-gold-200 aria-expanded:rotate-45 aria-expanded:bg-gold-300/10 aria-expanded:text-gold-200"
        panelClassName="w-[min(21rem,calc(100vw-1.5rem))] p-5"
      >
        <SettingsPanel />
      </Popover>
    </span>
  );
}
