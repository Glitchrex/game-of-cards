/**
 * Go Fish's GameModule — what makes Go Fish a Tier 1 game. `npm run gen` finds this file
 * and adds a lazy loader for it to src/games/registry.generated.ts; the play shell
 * (/games/go-fish/play) and the coached practice hand (/games/go-fish/try) load it from
 * there. See src/games/blackjack/README.md for how the pieces fit together.
 */
import { type GameModule } from '@/games/core/module';
import { GoFishBoard } from './Board';
import {
  askLabel,
  DEFAULT_PLAYERS,
  goFishEngine,
  MAX_LOSS_UNITS,
  type GoFishMove,
  type GoFishState,
} from './engine';
import { GO_FISH_BOTS } from './personas';
import { GOFISH_SEEDS } from './seeds';

export const goFishModule: GameModule<GoFishState, GoFishMove> = {
  slug: 'go-fish',
  engine: goFishEngine,
  Board: GoFishBoard,
  betting: {
    stakeOptions: [10, 25, 50, 100, 250],
    minStake: 10,
    maxStake: 250,
    // Winner takes the pot (docs/RULES_DECISIONS.md): everyone antes one stake, a loss costs
    // exactly that stake, so one stake is all that is set aside; with three players a sole
    // win pays +2, k tied winners (3 − k)/k each.
    maxLossUnits: MAX_LOSS_UNITS,
    describe:
      'Most books wins the pot: a sole win pays 2× your stake, a shared win splits it, otherwise you lose your stake.',
  },
  // The shell seats exactly these bots ("You vs …"), so list one per bot seat of the
  // default table. The Board falls back to the other regulars for bigger tables.
  bots: GO_FISH_BOTS.slice(0, DEFAULT_PLAYERS - 1),
  // The learner (seat 0, asks first) and two bots, 7 cards each.
  defaultConfig: { players: DEFAULT_PLAYERS },
  practice: {
    seed: GOFISH_SEEDS.practice,
    intro:
      'A coached game, with nothing at stake: collect books — all four cards of one rank. ' +
      'On your turn, pick a player and a rank you already hold, then press Ask. If they have ' +
      'any, they hand them all over and you go again; if not, it’s “Go Fish!” and you draw ' +
      'from the pond. Listen to what the others ask for — it tells you what they hold. The ' +
      'glowing seats and cards are the asks you can make; try anything and the coach will ' +
      'explain, or press “What would a pro do?” when you’re unsure.',
  },
  // Easy bots ask at random; normal bots remember every ask they hear.
  difficulties: ['easy', 'normal'],
  // "Ask Player 2 for Sevens" → "Ask Kanta Kaka for Sevens".
  moveLabel: (move) =>
    askLabel(move).replace(
      /\bPlayer (\d+)\b/g,
      (whole, n: string) => GO_FISH_BOTS[Number(n) - 1]?.name ?? whole,
    ),
};

export default goFishModule;
