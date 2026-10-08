/**
 * `t()` for this game: importing it registers the game's `war.*` strings first. Files in
 * this folder import `t` from here (not '@/lib/i18n') so the strings only ship with the game.
 */
import { registerMessages } from '@/lib/i18n';
import { war } from '@/lib/i18n/en/war';

registerMessages({ war });

export * from '@/lib/i18n';
