import { common } from './common';
import { nav } from './nav';
import { landing } from './landing';
import { primer } from './primer';
import { learn } from './learn';
import { play } from './play';
import { wallet } from './wallet';
import { settings } from './settings';
import { community } from './community';
import { contact } from './contact';
import { admin } from './admin';
import { stats } from './stats';
import { journey } from './journey';
import { catalog } from './catalog';

/**
 * Core English namespaces (bundled wherever `t()` is used). Each Tier 1 game's namespace
 * lives in ./games.ts and is registered by that game's own code (src/games/<slug>/i18n.ts),
 * so a page only ships the strings of the games it actually loads.
 */
export const en = {
  common,
  nav,
  landing,
  primer,
  learn,
  play,
  wallet,
  settings,
  community,
  contact,
  admin,
  stats,
  journey,
  catalog,
};
