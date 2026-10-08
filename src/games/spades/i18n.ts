/**
 * `t()` for this game: importing it registers the game's `spades.*` strings first. Files in
 * this folder import `t` from here (not '@/lib/i18n') so the strings only ship with the game.
 */
import { registerMessages } from '@/lib/i18n';
import { spades } from '@/lib/i18n/en/spades';

registerMessages({ spades });

export * from '@/lib/i18n';
