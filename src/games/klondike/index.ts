/**
 * Klondike Solitaire's GameModule — what makes Klondike a Tier 1 game. `npm run gen` finds
 * this file and adds a lazy loader for it to src/games/registry.generated.ts; the play shell
 * (/games/klondike/play) and the coached practice hand (/games/klondike/try) load it from
 * there. See ../blackjack/README.md for how the pieces fit together.
 */
import { type GameModule } from '@/games/core/module';
import { KlondikeBoard } from './Board';
import { klondikeEngine, klondikeMoveLabel, type KlondikeMove, type KlondikeState } from './engine';
import { KLONDIKE_BOTS } from './personas';
import { KLONDIKE_SEEDS } from './seeds';

export const klondikeModule: GameModule<KlondikeState, KlondikeMove> = {
  slug: 'klondike',
  engine: klondikeEngine,
  Board: KlondikeBoard,
  betting: {
    stakeOptions: [10, 25, 50, 100, 250],
    minStake: 10,
    maxStake: 250,
    // Vegas-style scoring (docs/RULES_DECISIONS.md): the stake buys the deal, and each card
    // home pays back 5/52 of it — so the most you can lose is the one stake.
    maxLossUnits: 1,
    describe:
      'Vegas-style: every card you get onto a foundation pays back 5/52 of your stake. 11 cards puts you ahead; clearing all 52 pays five times your stake.',
  },
  // Solitaire: no bot seats ("Just you and the deck").
  bots: [...KLONDIKE_BOTS],
  // One player (seat 0); Draw-1 with unlimited passes, no options.
  defaultConfig: { players: 1 },
  practice: {
    seed: KLONDIKE_SEEDS.practice,
    intro:
      'A coached game, with nothing at stake: move all 52 cards up to the four foundations, ' +
      'Ace to King in each suit. Build the columns down in alternating colours to uncover the ' +
      'face-down cards, and draw from the stock whenever you are stuck. The glowing cards are ' +
      'the ones that can move — try anything and the coach will explain, or press “What would ' +
      'a pro do?” when you’re unsure.',
  },
  // There is no opponent to make easier or harder, so a single option hides the picker.
  difficulties: ['normal'],
  moveLabel: klondikeMoveLabel,
};

export default klondikeModule;
