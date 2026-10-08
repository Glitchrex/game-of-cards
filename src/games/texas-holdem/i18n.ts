/**
 * `t()` for this game: importing it registers the game's `texasHoldem.*` strings first. Files in
 * this folder import `t` from here (not '@/lib/i18n') so the strings only ship with the game.
 */
import { registerMessages } from '@/lib/i18n';
import { texasHoldem } from '@/lib/i18n/en/texasHoldem';

registerMessages({ texasHoldem });

export * from '@/lib/i18n';
