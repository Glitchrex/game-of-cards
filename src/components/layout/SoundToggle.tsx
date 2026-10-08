'use client';
/**
 * Header sound switch. Sound is muted on first load (settings default); turning
 * it on unlocks WebAudio inside the click gesture and plays a confirmation tick.
 */
import { cn } from '@/components/ui/cn';
import { SpeakerOffIcon, SpeakerOnIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { playSound, unlockAudio } from '@/lib/sound';
import { useSettings } from '@/store/settings';

export interface SoundToggleProps {
  className?: string;
}

export function SoundToggle({ className }: SoundToggleProps) {
  const muted = useSettings((s) => s.muted);
  const setMuted = useSettings((s) => s.setMuted);

  const toggle = () => {
    if (muted) {
      setMuted(false);
      unlockAudio();
      playSound('click');
    } else {
      setMuted(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!muted}
      aria-label={t('settings.sound.label')}
      title={muted ? t('settings.sound.off') : t('settings.sound.on')}
      data-testid="sound-toggle"
      className={cn(
        'relative inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition-[background-color,color,border-color,box-shadow] duration-200',
        muted
          ? 'text-mist hover:text-cream border-transparent hover:bg-white/[0.08]'
          : 'border-gold-300/50 bg-gold-300/10 text-gold-200 hover:bg-gold-300/15 shadow-[0_0_14px_-2px_rgb(245_215_122/0.45)]',
        className,
      )}
    >
      {muted ? <SpeakerOffIcon size={22} /> : <SpeakerOnIcon size={22} />}
    </button>
  );
}
