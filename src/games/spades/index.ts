/**
 * Spades' GameModule — what makes Spades a Tier 1 game. `npm run gen` finds this file and
 * adds a lazy loader for it to src/games/registry.generated.ts; the play shell
 * (/games/spades/play) and the coached practice hand (/games/spades/try) load it from
 * there. See src/games/blackjack/README.md for how the pieces fit together.
 */
import { cardName } from '@/games/core/cards';
import { type GameModule } from '@/games/core/module';
import { t } from '@/games/spades/i18n';
import { SpadesBoard } from './Board';
import { spadesEngine, type SpadesMove, type SpadesState } from './engine';
import { SPADES_BOTS } from './personas';
import { SEATS } from './rules';
import { SPADES_SEEDS } from './seeds';
import { bidWords } from './board/shared';

export const spadesModule: GameModule<SpadesState, SpadesMove> = {
  slug: 'spades',
  engine: spadesEngine,
  Board: SpadesBoard,
  betting: {
    stakeOptions: [10, 25, 50, 100, 250],
    minStake: 10,
    maxStake: 250,
    // docs/RULES_DECISIONS.md: higher team score wins, a tie is a push; betting ±1 unit, so
    // a loss costs exactly one stake and one stake is all that is set aside.
    maxLossUnits: 1,
    describe:
      'Your team wins with the higher score: a win pays 1:1, a loss costs your stake, and a tie returns your bet.',
  },
  bots: [...SPADES_BOTS],
  // The learner (seat 0) partnered with seat 2, against seats 1 and 3; the seed picks the
  // dealer.
  defaultConfig: { players: SEATS },
  practice: {
    seed: SPADES_SEEDS.practice,
    intro:
      'A coached hand, with nothing at stake: you and your partner across the table are a ' +
      'team. Everyone first bids how many tricks they expect to win — your two bids add up ' +
      'to your team’s target — then you play one card to each trick, following suit ' +
      'whenever you can. Spades are trump and beat every other suit. Make your team’s bid ' +
      'to score 10 a trick; fall short and you lose them. The glowing choices are the ones ' +
      'you may make; try anything and the coach will explain, or press “What would a pro ' +
      'do?” when you’re unsure.',
  },
  // Easy bots bid roughly and play any sensible card; normal bots count sure tricks, cover
  // their partner and protect a Nil.
  difficulties: ['easy', 'normal'],
  moveLabel: (move) =>
    move.type === 'bid'
      ? t('spades.moveLabel.bid', { bid: bidWords(move.tricks) })
      : t('spades.moveLabel.play', { card: cardName(move.card) }),
};

export default spadesModule;
