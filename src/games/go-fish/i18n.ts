/**
 * `t()` for this game: importing it registers the game's `goFish.*` strings first. Files in
 * this folder import `t` from here (not '@/lib/i18n') so the strings only ship with the game.
 */
import { registerMessages } from '@/lib/i18n';
import { goFish } from '@/lib/i18n/en/goFish';

registerMessages({ goFish });

export * from '@/lib/i18n';
