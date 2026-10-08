/**
 * Andar Bahar's GameModule — what makes Andar Bahar a Tier 1 game. `npm run gen` finds this
 * file and adds a lazy loader for it to src/games/registry.generated.ts; the play shell
 * (/games/andar-bahar/play) and the coached practice hand (/games/andar-bahar/try) load it
 * from there. See src/games/blackjack/README.md for how the pieces fit together.
 */
import { type GameModule } from '@/games/core/module';
import { AndarBaharBoard } from './Board';
import {
  andarBaharEngine,
  MAX_LOSS_UNITS,
  SEATS,
  type AndarBaharMove,
  type AndarBaharState,
} from './engine';
import { ANDARBAHAR_BOTS } from './personas';
import { ANDARBAHAR_SEEDS } from './seeds';
import { abt } from './board/strings';

export const andarBaharModule: GameModule<AndarBaharState, AndarBaharMove> = {
  slug: 'andar-bahar',
  engine: andarBaharEngine,
  Board: AndarBaharBoard,
  betting: {
    // docs/RULES_DECISIONS.md → Andar Bahar: stake 10/25/50/100/250, maxLossUnits 1.
    stakeOptions: [10, 25, 50, 100, 250],
    minStake: 10,
    maxStake: 250,
    // One bet of one stake, nothing else can be added: that stake is all that is set aside.
    maxLossUnits: MAX_LOSS_UNITS,
    describe:
      'Andar pays 0.9:1 and Bahar pays 1:1 — Andar gets the first card, so it wins slightly more often.',
  },
  // Seat 1: the dealer, who deals one card per (forced) move.
  bots: [...ANDARBAHAR_BOTS],
  // One learner (seat 0) betting against the dealer (seat 1), one 52-card deck.
  defaultConfig: { players: SEATS },
  practice: {
    seed: ANDARBAHAR_SEEDS.practice,
    intro:
      'A coached deal of Andar Bahar, with nothing at stake. The face-up card in the middle ' +
      'is the joker. Bet on Andar (inside) or Bahar (outside) with the glowing buttons, then ' +
      'watch the dealer deal one card at a time to each side in turn: the side that gets the ' +
      'next card of the joker’s rank — any suit — wins. Unsure? Press “What would a pro ' +
      'do?” to hear why the two sides pay a little differently.',
  },
  // The dealer follows fixed rules (alternate until a match), so there is no bot difficulty
  // to choose — a single option hides the picker in the bet panel.
  difficulties: ['normal'],
  moveLabel: (move) =>
    move.type === 'bet'
      ? abt(move.side === 'andar' ? 'andarBahar.bet.andar' : 'andarBahar.bet.bahar')
      : abt('andarBahar.move.deal'),
};

export default andarBaharModule;
