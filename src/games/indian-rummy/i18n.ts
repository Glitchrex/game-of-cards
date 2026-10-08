/**
 * `t()` for this game: importing it registers the game's `indianRummy.*` strings first. Files in
 * this folder import `t` from here (not '@/lib/i18n') so the strings only ship with the game.
 */
import { registerMessages } from '@/lib/i18n';
import { indianRummy } from '@/lib/i18n/en/indianRummy';

registerMessages({ indianRummy });

export * from '@/lib/i18n';
