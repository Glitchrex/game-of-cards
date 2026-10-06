/**
 * Baccarat's GameModule — what makes Baccarat (Punto Banco) a Tier 1 game. `npm run gen`
 * finds this file and adds a lazy loader for it to src/games/registry.generated.ts; the play
 * shell (/games/baccarat/play) and the coached practice coup (/games/baccarat/try) load it
 * from there. See src/games/blackjack/README.md for how the pieces fit together.
 */
import { type GameModule } from '@/games/core/module';
import { t } from '@/games/baccarat/i18n';
import { BaccaratBoard } from './Board';
import {
  baccaratEngine,
  BET_NAMES,
  DEFAULT_DECKS,
  MAX_LOSS_UNITS,
  SEATS,
  type BaccaratMove,
  type BaccaratState,
} from './engine';
import { BACCARAT_BOTS } from './personas';
import { BACCARAT_SEEDS } from './seeds';

export const baccaratModule: GameModule<BaccaratState, BaccaratMove> = {
  slug: 'baccarat',
  engine: baccaratEngine,
  Board: BaccaratBoard,
  betting: {
    stakeOptions: [10, 25, 50, 100, 250],
    minStake: 10,
    maxStake: 250,
    // One bet on one spot, and nothing can be added once the cards are dealt.
    maxLossUnits: MAX_LOSS_UNITS,
    describe:
      'Player pays 1:1, Banker pays 0.95:1 (5% commission), Tie pays 8:1. Player and Banker bets push on a tie.',
  },
  bots: [...BACCARAT_BOTS],
  // One learner (seat 0) betting while the croupier (seat 1) deals from an 8-deck shoe.
  defaultConfig: { players: SEATS, options: { decks: DEFAULT_DECKS } },
  practice: {
    seed: BACCARAT_SEEDS.practice,
    intro:
      'A coached coup, with nothing at stake: two hands are dealt, Player and Banker, and the ' +
      'one closer to 9 wins. Your only choice is the bet — the glowing spots are where you can ' +
      'put your chip, and “What would a pro do?” shows the smartest one. After that the ' +
      'croupier deals every card by fixed rules, and the table explains each one as it lands.',
  },
  // The croupier deals by fixed rules, so there is no bot difficulty to choose — a single
  // option hides the picker in the bet panel.
  difficulties: ['normal'],
  moveLabel: (move) =>
    move.type === 'bet'
      ? t('baccarat.moves.bet', { name: BET_NAMES[move.on] })
      : t('baccarat.moves.deal'),
};

export default baccaratModule;
