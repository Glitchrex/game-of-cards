/**
 * Indian Rummy's GameModule — what makes Indian Rummy a Tier 1 game. `npm run gen` finds this
 * file and adds a lazy loader for it to src/games/registry.generated.ts; the play shell
 * (/games/indian-rummy/play) and the coached practice hand (/games/indian-rummy/try) load it
 * from there. See ../blackjack/README.md for how the pieces fit together.
 */
import { personalise } from '@/components/play/useGameController';
import { cardShort } from '@/games/core/cards';
import { type GameModule } from '@/games/core/module';
import { type GameEngine } from '@/games/core/types';
import { t } from '@/games/indian-rummy/i18n';
import { IndianRummyBoard } from './Board';
import {
  DEFAULT_PLAYERS,
  indianRummyEngine,
  MAX_LOSS_UNITS,
  type IndianRummyMove,
  type IndianRummyState,
} from './engine';
import { INDIAN_RUMMY_BOTS } from './personas';
import { INDIAN_RUMMY_SEEDS } from './seeds';

function moveLabel(move: IndianRummyMove): string {
  switch (move.type) {
    case 'draw':
      return move.from === 'discard'
        ? t('indianRummy.actions.keyOpen')
        : move.from === 'stock'
          ? t('indianRummy.actions.keyStock')
          : t('indianRummy.caption.wild');
    case 'discard':
      return t('indianRummy.actions.discardCard', { card: cardShort(move.card) });
    case 'declare':
      return t('indianRummy.actions.declareCard', { card: cardShort(move.discard) });
    case 'drop':
      return t('indianRummy.actions.drop');
  }
}

/**
 * The engine with persona names in its result summary. The controller already turns
 * "Player 1" into "Dadi Diamond" in move descriptions and coach text, but the summary on
 * the celebration / roast overlays and the practice summary is shown as the engine wrote it.
 */
const engine: GameEngine<IndianRummyState, IndianRummyMove> = {
  ...indianRummyEngine,
  result(state) {
    const r = indianRummyEngine.result(state);
    return { ...r, summary: personalise(r.summary, INDIAN_RUMMY_BOTS) };
  },
};

export const indianRummyModule: GameModule<IndianRummyState, IndianRummyMove> = {
  slug: 'indian-rummy',
  engine,
  Board: IndianRummyBoard,
  betting: {
    // Points rummy: the stake is Jeet per point (docs/RULES_DECISIONS.md → Indian Rummy).
    stakeOptions: [1, 2, 5],
    minStake: 1,
    maxStake: 5,
    // A loser pays at most 80 points, so 80 stakes are set aside before the deal; a drop
    // (20 or 40 points) always fits inside that.
    maxLossUnits: MAX_LOSS_UNITS,
    describe:
      'Your stake is Jeet per point: the loser pays the winner their points (at most 80). Dropping costs 20 points before your first draw, 40 later.',
  },
  bots: [...INDIAN_RUMMY_BOTS],
  // One learner (seat 0) against one bot; the dealer is chosen by the seed.
  defaultConfig: { players: DEFAULT_PLAYERS },
  practice: {
    seed: INDIAN_RUMMY_SEEDS.practice,
    // The bot deals, so the learner takes the first turn of every coached hand.
    config: { options: { dealer: 1 } },
    intro:
      'A coached game, with nothing at stake: each turn, draw one card and throw one away, ' +
      'until all 13 of your cards sit in groups — at least two sequences, one of them pure ' +
      '(no jokers), and the rest sets or sequences. Your cards sort themselves into groups ' +
      'as you play. The glowing cards and piles are the moves you can make; try anything ' +
      'and the coach will explain, or press “What would a pro do?” when you’re unsure.',
  },
  difficulties: ['easy', 'normal'],
  moveLabel,
};

export default indianRummyModule;
