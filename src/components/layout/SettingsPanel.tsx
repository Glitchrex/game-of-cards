'use client';
/** The table-settings controls, shared by the header popover and the mobile menu. */
import { cn } from '@/components/ui/cn';
import { ClubIcon, DiamondIcon, HeartIcon, SpadeIcon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { t } from '@/lib/i18n';
import { playSound, unlockAudio } from '@/lib/sound';
import { type BotSpeed, type MotionPref, useSettings } from '@/store/settings';

export interface SettingsPanelProps {
  /** Include the sound on/off switch (the header has its own toggle). */
  includeSound?: boolean;
  className?: string;
}

function SuitPreview({ fourColor }: { fourColor: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="bg-ivory shadow-card inline-flex items-center gap-1 self-start rounded-md px-1.5 py-1"
    >
      <SpadeIcon size={14} className="text-suit-black" />
      <HeartIcon size={14} className="text-suit-red" />
      <DiamondIcon size={14} className={fourColor ? 'text-suit-blue' : 'text-suit-red'} />
      <ClubIcon size={14} className={fourColor ? 'text-suit-green' : 'text-suit-black'} />
    </span>
  );
}

export function SettingsPanel({ includeSound = false, className }: SettingsPanelProps) {
  const muted = useSettings((s) => s.muted);
  const setMuted = useSettings((s) => s.setMuted);
  const fourColor = useSettings((s) => s.fourColor);
  const setFourColor = useSettings((s) => s.setFourColor);
  const motion = useSettings((s) => s.motion);
  const setMotion = useSettings((s) => s.setMotion);
  const botSpeed = useSettings((s) => s.botSpeed);
  const setBotSpeed = useSettings((s) => s.setBotSpeed);

  const motionOptions: Array<{ value: MotionPref; label: string }> = [
    { value: 'system', label: t('settings.motion.system') },
    { value: 'reduce', label: t('settings.motion.reduce') },
    { value: 'full', label: t('settings.motion.full') },
  ];
  const speedOptions: Array<{ value: BotSpeed; label: string }> = [
    { value: 'relaxed', label: t('settings.botSpeed.relaxed') },
    { value: 'normal', label: t('settings.botSpeed.normal') },
    { value: 'fast', label: t('settings.botSpeed.fast') },
  ];

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {includeSound ? (
        <Switch
          checked={!muted}
          onCheckedChange={(on) => {
            setMuted(!on);
            if (on) {
              unlockAudio();
              playSound('click');
            }
          }}
          label={t('settings.sound.label')}
          hint={t('settings.sound.hint')}
        />
      ) : null}
      <div className="flex flex-col gap-2">
        <Switch
          checked={fourColor}
          onCheckedChange={setFourColor}
          label={t('settings.fourColor.label')}
          hint={t('settings.fourColor.hint')}
        />
        <SuitPreview fourColor={fourColor} />
      </div>
      <Segmented
        legend={t('settings.motion.label')}
        hint={t('settings.motion.hint')}
        value={motion}
        onValueChange={setMotion}
        options={motionOptions}
      />
      <Segmented
        legend={t('settings.botSpeed.label')}
        hint={t('settings.botSpeed.hint')}
        value={botSpeed}
        onValueChange={setBotSpeed}
        options={speedOptions}
      />
    </div>
  );
}
