/**
 * Hearts' GameModule — what makes Hearts a Tier 1 game. `npm run gen` finds this file and
 * adds a lazy loader for it to src/games/registry.generated.ts; the play shell
 * (/games/hearts/play) and the coached practice hand (/games/hearts/try) load it from
 * there. See src/games/blackjack/README.md for how the pieces fit together.
 */
import { cardName } from '@/games/core/cards';
import { type GameModule } from '@/games/core/module';
import { t } from '@/lib/i18n';
import { HeartsBoard } from './Board';
import { heartsEngine, type HeartsMove, type HeartsState } from './engine';
import { HEARTS_BOTS } from './personas';
import { SEATS } from './rules';
import { HEARTS_SEEDS } from './seeds';
import { cardList } from './board/shared';

export const heartsModule: GameModule<HeartsState, HeartsMove> = {
  slug: 'hearts',
  engine: heartsEngine,
  Board: HeartsBoard,
  betting: {
    stakeOptions: [10, 25, 50, 100, 250],
    minStake: 10,
    maxStake: 250,
    // Winner takes the pot (docs/RULES_DECISIONS.md): a loss costs exactly one stake, so
    // one stake is all that is set aside; a sole win pays +3, k tied winners +(4 − k)/k.
    maxLossUnits: 1,
    describe:
      'Lowest score wins the pot: a sole win pays 3× your stake, a shared win splits it, otherwise you lose your stake.',
  },
  bots: [...HEARTS_BOTS],
  // The learner (seat 0) and three bots, passing 3 cards to the left.
  defaultConfig: { players: SEATS },
  practice: {
    seed: HEARTS_SEEDS.practice,
    intro:
      'A coached hand, with nothing at stake: in Hearts every Heart you win costs a point ' +
      'and the Queen of Spades costs 13, so the lowest score wins. First you pass 3 cards ' +
      'to the player on your left, then you play one card to each trick — following suit ' +
      'whenever you can. The glowing cards are the ones you may play; try any card and the ' +
      'coach will explain, or press “What would a pro do?” when you’re unsure.',
  },
  // Easy bots play any legal card; normal bots pass and duck like real players.
  difficulties: ['easy', 'normal'],
  moveLabel: (move) =>
    move.type === 'pass'
      ? t('hearts.moveLabel.pass', { cards: cardList(move.cards) })
      : t('hearts.moveLabel.play', { card: cardName(move.card) }),
};

export default heartsModule;
