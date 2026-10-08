/**
 * `t()` for this game: importing it registers the game's `teenPatti.*` strings first. Files in
 * this folder import `t` from here (not '@/lib/i18n') so the strings only ship with the game.
 */
import { registerMessages } from '@/lib/i18n';
import { teenPatti } from '@/lib/i18n/en/teenPatti';

registerMessages({ teenPatti });

export * from '@/lib/i18n';
