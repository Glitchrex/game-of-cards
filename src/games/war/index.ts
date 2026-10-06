/**
 * War's GameModule — what makes War a Tier 1 game. `npm run gen` finds this file and adds
 * a lazy loader for it to src/games/registry.generated.ts; the play shell (/games/war/play)
 * and the coached practice game (/games/war/try) load it from there. See
 * src/games/blackjack/README.md for how the pieces fit together.
 */
import { type GameModule } from '@/games/core/module';
import { t } from '@/lib/i18n';
import { WarBoard } from './Board';
import { MAX_LOSS_UNITS, SEATS, warEngine, type WarMove, type WarState } from './engine';
import { WAR_BOTS } from './personas';
import { WAR_PRACTICE_BATTLES, WAR_SEEDS } from './seeds';

export const warModule: GameModule<WarState, WarMove> = {
  slug: 'war',
  engine: warEngine,
  Board: WarBoard,
  betting: {
    stakeOptions: [10, 25, 50, 100, 250],
    minStake: 10,
    maxStake: 250,
    // docs/RULES_DECISIONS.md → War: ±1 unit. Nothing can be added once the cards are
    // dealt, so the one stake is all that is set aside.
    maxLossUnits: MAX_LOSS_UNITS,
    describe:
      'Win pays 1:1 and a loss costs your bet. If the piles are level after 60 battles, it’s a push and your bet comes back.',
  },
  // Seat 1: the only opponent. War has no choices, so this bot never has to think.
  bots: [...WAR_BOTS],
  // Exactly two players, the full game's 60-battle cap (the engine's default).
  defaultConfig: { players: SEATS },
  practice: {
    seed: WAR_SEEDS.practice,
    // A short practice game, so a coached run ends in a couple of minutes.
    config: { options: { maxBattles: WAR_PRACTICE_BATTLES } },
    intro:
      `A practice game of War with nothing at stake, just ${WAR_PRACTICE_BATTLES} battles long. ` +
      'You and Bugle Bhaskar each flip your top card, and the higher card wins both. If the ' +
      'cards tie, it’s war: you each lay 3 cards face down and flip one more, and the higher ' +
      'card takes everything in the middle. Nobody chooses a card in War, so there’s no wrong ' +
      'move. Press the glowing Flip button (or F, Space or Enter), ask “What would a pro do?” ' +
      'whenever you like, and enjoy the luck of the draw!',
  },
  // The opponent only ever flips — there is no bot difficulty to choose, so a single option
  // hides the picker in the bet panel.
  difficulties: ['normal'],
  moveLabel: () => t('war.actions.flip'),
};

export default warModule;
