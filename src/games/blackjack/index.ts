/**
 * Blackjack's GameModule — what makes Blackjack a Tier 1 game. `npm run gen` finds this
 * file and adds a lazy loader for it to src/games/registry.generated.ts; the play shell
 * (/games/blackjack/play) and the coached practice hand (/games/blackjack/try) load it
 * from there. See ./README.md for how the pieces fit together.
 */
import { type GameModule } from '@/games/core/module';
import { t, type TKey } from '@/games/blackjack/i18n';
import { BlackjackBoard } from './Board';
import {
  blackjackEngine,
  DEFAULT_DECKS,
  SEATS,
  type BlackjackMove,
  type BlackjackState,
} from './engine';
import { BLACKJACK_BOTS } from './personas';
import { BLACKJACK_SEEDS } from './seeds';

const MOVE_LABELS: Record<BlackjackMove['type'], TKey> = {
  hit: 'blackjack.actions.hit',
  stand: 'blackjack.actions.stand',
  double: 'blackjack.actions.double',
  split: 'blackjack.actions.split',
  reveal: 'blackjack.actions.reveal',
  'dealer-hit': 'blackjack.actions.dealerHit',
  'dealer-stand': 'blackjack.actions.dealerStand',
};

export const blackjackModule: GameModule<BlackjackState, BlackjackMove> = {
  slug: 'blackjack',
  engine: blackjackEngine,
  Board: BlackjackBoard,
  betting: {
    stakeOptions: [10, 25, 50, 100, 250],
    minStake: 10,
    maxStake: 250,
    // Only the first bet is set aside; doubles and splits are debited at settlement and are
    // only offered while the wallet can cover them (the shell passes `affordableUnits`).
    maxLossUnits: 1,
    describe:
      'Win pays 1:1, Blackjack pays 3:2, a tie (push) returns your bet. Doubles and splits need extra Jeet.',
  },
  bots: [...BLACKJACK_BOTS],
  // One learner (seat 0) against the dealer (seat 1), dealt from a 6-deck shoe.
  defaultConfig: { players: SEATS, options: { decks: DEFAULT_DECKS } },
  practice: {
    seed: BLACKJACK_SEEDS.practice,
    intro:
      'A coached hand, with nothing at stake: get closer to 21 than the dealer without going ' +
      'over. The glowing buttons are the moves you can make — try any of them and the coach ' +
      'will explain, or press “What would a pro do?” when you’re unsure.',
  },
  // The dealer follows fixed house rules (hit 16 or less, stand on every 17), so there is
  // no bot difficulty to choose — a single option hides the picker in the bet panel.
  difficulties: ['normal'],
  moveLabel: (move) => t(MOVE_LABELS[move.type]),
};

export default blackjackModule;
