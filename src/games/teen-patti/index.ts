/**
 * Teen Patti's GameModule — what makes Teen Patti a Tier 1 game. `npm run gen` finds this
 * file and adds a lazy loader for it to src/games/registry.generated.ts; the play shell
 * (/games/teen-patti/play) and the coached practice hand (/games/teen-patti/try) load it
 * from there. See src/games/blackjack/README.md for how the pieces fit together.
 */
import { type BotPersona, type GameModule } from '@/games/core/module';
import { type GameEngine } from '@/games/core/types';
import { t, type TKey } from '@/games/teen-patti/i18n';
import { TeenPattiBoard } from './Board';
import {
  DEFAULT_PLAYERS,
  MAX_LOSS_UNITS,
  teenPattiEngine,
  type TeenPattiMove,
  type TeenPattiMoveType,
  type TeenPattiState,
} from './engine';
import { teenPattiBots } from './personas';
import { TEENPATTI_SEEDS } from './seeds';

const BOTS = teenPattiBots(DEFAULT_PLAYERS);

/** "Player 2" → the seat's persona name (the controller does the same for moves and advice). */
function withNames(text: string, bots: readonly BotPersona[]): string {
  return text.replace(
    /\bPlayer (\d+)\b/g,
    (whole, n: string) => bots[Number(n) - 1]?.name ?? whole,
  );
}

/**
 * The engine, with the result summary spoken in persona names: the shell shows it as it is
 * on the result overlays and the practice summary ("…Bindiya Bioscope's Pair of Fours…").
 * Rules, moves and advice are untouched.
 */
const engine: GameEngine<TeenPattiState, TeenPattiMove> = {
  ...teenPattiEngine,
  result(state) {
    const result = teenPattiEngine.result(state);
    return { ...result, summary: withNames(result.summary, BOTS) };
  },
};

const MOVE_LABELS: Record<TeenPattiMoveType, TKey> = {
  see: 'teenPatti.actions.see',
  chaal: 'teenPatti.actions.chaal',
  raise: 'teenPatti.actions.raise',
  show: 'teenPatti.actions.show',
  pack: 'teenPatti.actions.pack',
};

export const teenPattiModule: GameModule<TeenPattiState, TeenPattiMove> = {
  slug: 'teen-patti',
  engine,
  Board: TeenPattiBoard,
  betting: {
    // docs/RULES_DECISIONS.md: stake = Jeet per boot (5/10/20), maxLossUnits 64.
    stakeOptions: [5, 10, 20],
    minStake: 5,
    maxStake: 20,
    // The pot can never pass the 64-boot limit, so the learner can never put in more than
    // 64 boots: that much is set aside, and the shell pays back the pot share minus the
    // boots put in (1 boot = 1 stake).
    maxLossUnits: MAX_LOSS_UNITS,
    describe:
      'Your stake is the Jeet value of one boot. The pot is capped at 64 boots, so 64 × your stake is set aside; win the pot, or lose only the boots you put in.',
  },
  // Seats 1–2: the learner plays against two bots (3 seats, the engine default).
  bots: BOTS,
  defaultConfig: { players: DEFAULT_PLAYERS },
  practice: {
    seed: TEENPATTI_SEEDS.practice,
    intro:
      'A coached hand of Teen Patti, with nothing at stake. Everyone has three secret cards ' +
      'and starts blind: blind bets cost half as much, and you can see your cards for free ' +
      'on your turn. Chaal to stay in, raise to push the stake up, pack to give up — and ' +
      'when just two of you are left, ask for a show. The glowing buttons are your options, ' +
      'the coach explains any move you try, and “What would a pro do?” shows the smart play.',
  },
  // Easy bots are cautious and never pack a pair or better; normal bots weigh their hand,
  // the betting and the price, and bluff now and then.
  difficulties: ['easy', 'normal'],
  moveLabel: (move) => t(MOVE_LABELS[move.type]),
};

export default teenPattiModule;
