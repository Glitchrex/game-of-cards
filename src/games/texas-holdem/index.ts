/**
 * Texas Hold'em's GameModule — what makes Hold'em a Tier 1 game. `npm run gen` finds this
 * file and adds a lazy loader for it to src/games/registry.generated.ts; the play shell
 * (/games/texas-holdem/play) and the coached practice hand (/games/texas-holdem/try) load
 * it from there. See src/games/blackjack/README.md for how the pieces fit together.
 */
import { type BotPersona, type GameModule } from '@/games/core/module';
import { type GameEngine } from '@/games/core/types';
import { t } from '@/games/texas-holdem/i18n';
import { TexasHoldemBoard } from './Board';
import {
  DEFAULT_PLAYERS,
  MAX_LOSS_UNITS,
  texasHoldemEngine,
  type TexasHoldemMove,
  type TexasHoldemState,
} from './engine';
import { holdemBots } from './personas';
import { TEXASHOLDEM_SEEDS } from './seeds';

const BOTS = holdemBots(DEFAULT_PLAYERS);

/** "Player 2" → the seat's persona name (the controller does the same for moves and advice). */
function withNames(text: string, bots: readonly BotPersona[]): string {
  return text.replace(
    /\bPlayer (\d+)\b/g,
    (whole, n: string) => bots[Number(n) - 1]?.name ?? whole,
  );
}

/**
 * The engine, with the result summary spoken in persona names: it is shown on the result
 * overlays and the practice summary ("…beat Maestro Moti's Two Pair…"), which the shell
 * displays as it is. Rules, moves and advice are untouched.
 */
const engine: GameEngine<TexasHoldemState, TexasHoldemMove> = {
  ...texasHoldemEngine,
  result(state) {
    const result = texasHoldemEngine.result(state);
    return { ...result, summary: withNames(result.summary, BOTS) };
  },
};

function moveLabel(move: TexasHoldemMove): string {
  switch (move.type) {
    case 'fold':
      return t('texasHoldem.actions.fold');
    case 'check':
      return t('texasHoldem.actions.check');
    case 'call':
      return t('texasHoldem.actions.call');
    case 'bet':
      return t('texasHoldem.actions.betN', { n: move.amount });
    case 'raise':
      return t('texasHoldem.actions.raiseN', { n: move.to });
    case 'all-in':
      return t('texasHoldem.actions.allIn');
  }
}

export const texasHoldemModule: GameModule<TexasHoldemState, TexasHoldemMove> = {
  slug: 'texas-holdem',
  engine,
  Board: TexasHoldemBoard,
  betting: {
    // docs/RULES_DECISIONS.md: stake = Jeet per chip (1/2/5), maxLossUnits 100.
    stakeOptions: [1, 2, 5],
    minStake: 1,
    maxStake: 5,
    // The learner buys in for a 100-chip stack, so up to 100 stakes are set aside; the
    // shell pays back the final stack (1 chip = 1 stake).
    maxLossUnits: MAX_LOSS_UNITS,
    describe:
      'Your stake is the Jeet value of one chip. You sit down with 100 chips (100 × your stake is set aside) and get back whatever chips you finish with, turned into Jeet.',
  },
  // Seats 1–3: the learner plays against three bots (4 seats, the engine default).
  bots: BOTS,
  defaultConfig: { players: DEFAULT_PLAYERS },
  practice: {
    seed: TEXASHOLDEM_SEEDS.practice,
    intro:
      'A coached hand of poker, with nothing at stake. You get two secret cards, five shared ' +
      'cards arrive in the middle, and your best five out of seven make your hand. Fold, ' +
      'check, call or raise — the glowing buttons are your options, the coach explains any ' +
      'move you try, and “What would a pro do?” shows how a strong player would bet.',
  },
  // Easy bots call a lot and rarely raise; normal bots read position, pot odds and betting.
  difficulties: ['easy', 'normal'],
  moveLabel,
};

export default texasHoldemModule;
