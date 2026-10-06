/**
 * English strings of the Tier 1 games, one namespace per game. Not part of the core
 * dictionary: each game registers its namespace when its code loads
 * (src/games/<slug>/i18n.ts → `registerMessages`).
 */
import { baccarat } from './baccarat';
import { blackjack } from './blackjack';
import { crazyEights } from './crazyEights';
import { goFish } from './goFish';
import { hearts } from './hearts';
import { indianRummy } from './indianRummy';
import { spades } from './spades';
import { teenPatti } from './teenPatti';
import { texasHoldem } from './texasHoldem';
import { war } from './war';

export const enGames = {
  baccarat,
  blackjack,
  crazyEights,
  goFish,
  hearts,
  indianRummy,
  spades,
  teenPatti,
  texasHoldem,
  war,
};
