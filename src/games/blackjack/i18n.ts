/**
 * `t()` for this game: importing it registers the game's `blackjack.*` strings first. Files in
 * this folder import `t` from here (not '@/lib/i18n') so the strings only ship with the game.
 */
import { registerMessages } from '@/lib/i18n';
import { blackjack } from '@/lib/i18n/en/blackjack';

registerMessages({ blackjack });

export * from '@/lib/i18n';
