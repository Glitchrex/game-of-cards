/**
 * Crazy Eights' GameModule — what makes Crazy Eights a Tier 1 game. `npm run gen` finds this
 * file and adds a lazy loader for it to src/games/registry.generated.ts; the play shell
 * (/games/crazy-eights/play) and the coached practice hand (/games/crazy-eights/try) load
 * it from there. See src/games/blackjack/README.md for how the pieces fit together.
 */
import { cardShort, SUIT_NAMES } from '@/games/core/cards';
import { type GameModule } from '@/games/core/module';
import { t } from '@/lib/i18n';
import { CrazyEightsBoard } from './Board';
import {
  crazyEightsEngine,
  DEFAULT_PLAYERS,
  MAX_LOSS_UNITS,
  type CrazyEightsMove,
  type CrazyEightsState,
} from './engine';
import { CRAZY_EIGHTS_BOTS } from './personas';
import { CRAZY_EIGHTS_SEEDS } from './seeds';

export const crazyEightsModule: GameModule<CrazyEightsState, CrazyEightsMove> = {
  slug: 'crazy-eights',
  engine: crazyEightsEngine,
  Board: CrazyEightsBoard,
  betting: {
    stakeOptions: [10, 25, 50, 100, 250],
    minStake: 10,
    maxStake: 250,
    // Winner takes the pot (docs/RULES_DECISIONS.md): a loss costs exactly one stake, so one
    // stake is all that is set aside; going out first pays +(players − 1) = +2 at the
    // default 3-player table, and tied winners of a blocked game share the pot.
    maxLossUnits: MAX_LOSS_UNITS,
    describe:
      'Winner takes the pot: empty your hand first to win 2× your stake, otherwise you lose your stake. If the game is blocked, the lowest card points win and ties share the pot.',
  },
  // Seat 1 Jugnu and seat 2 Madame Matinee (Chacha Chakri joins a 4-player table).
  bots: CRAZY_EIGHTS_BOTS.slice(0, DEFAULT_PLAYERS - 1),
  // The learner (seat 0, who plays first) and two bots: 5 cards each, no reshuffle.
  defaultConfig: { players: DEFAULT_PLAYERS },
  practice: {
    seed: CRAZY_EIGHTS_SEEDS.practice,
    intro:
      'A coached game, with nothing at stake: be the first to get rid of all your cards. ' +
      'Each card you play must match the top card of the pile by suit or by rank — and ' +
      'Eights are wild, so you can play one any time and name the next suit. Stuck? Draw ' +
      'from the stock. The glowing cards are the ones you can play; try any card and the ' +
      'coach will explain, or press “What would a pro do?” when you’re unsure.',
  },
  // Easy bots play the first card that fits; normal bots save their Eights and switch suits.
  difficulties: ['easy', 'normal'],
  moveLabel: (move) =>
    move.type === 'draw'
      ? t('crazyEights.moveLabel.draw')
      : move.type === 'pass'
        ? t('crazyEights.moveLabel.pass')
        : move.suit
          ? t('crazyEights.moveLabel.playEight', {
              card: cardShort(move.card),
              suit: SUIT_NAMES[move.suit],
            })
          : t('crazyEights.moveLabel.play', { card: cardShort(move.card) }),
};

export default crazyEightsModule;
