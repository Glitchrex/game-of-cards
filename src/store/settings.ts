'use client';
/** User preferences. Persisted under "goc:settings". */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type MotionPref = 'system' | 'reduce' | 'full';
export type BotSpeed = 'relaxed' | 'normal' | 'fast';
export type Locale = 'en';

export interface SettingsState {
  /** Sound is muted on first load until the user turns it on. */
  muted: boolean;
  /** Four-colour deck: ♠ black, ♥ red, ♦ blue, ♣ green. */
  fourColor: boolean;
  motion: MotionPref;
  botSpeed: BotSpeed;
  primerSeen: boolean;
  locale: Locale;
  /** Random per-browser token used for one-vote-per-browser on the Community Board. */
  voterToken: string | null;
  setMuted: (m: boolean) => void;
  setFourColor: (v: boolean) => void;
  setMotion: (m: MotionPref) => void;
  setBotSpeed: (s: BotSpeed) => void;
  setPrimerSeen: (v: boolean) => void;
  ensureVoterToken: () => string;
}

/** Bot "thinking" delay in ms for each speed setting. */
export const BOT_DELAY_MS: Record<BotSpeed, number> = { relaxed: 1100, normal: 700, fast: 250 };

function makeToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      muted: true,
      fourColor: false,
      motion: 'system',
      botSpeed: 'normal',
      primerSeen: false,
      locale: 'en',
      voterToken: null,
      setMuted: (muted) => set({ muted }),
      setFourColor: (fourColor) => set({ fourColor }),
      setMotion: (motion) => set({ motion }),
      setBotSpeed: (botSpeed) => set({ botSpeed }),
      setPrimerSeen: (primerSeen) => set({ primerSeen }),
      ensureVoterToken: () => {
        const existing = get().voterToken;
        if (existing) return existing;
        const t = makeToken();
        set({ voterToken: t });
        return t;
      },
    }),
    {
      name: 'goc:settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ muted, fourColor, motion, botSpeed, primerSeen, locale, voterToken }) => ({
        muted,
        fourColor,
        motion,
        botSpeed,
        primerSeen,
        locale,
        voterToken,
      }),
    },
  ),
);
