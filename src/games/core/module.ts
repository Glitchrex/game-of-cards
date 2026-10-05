/**
 * UI-facing game module contract. A game is "Tier 1" (fully playable vs bot)
 * iff `src/games/<slug>/index.ts` default-exports a GameModule.
 */
import type { ComponentType } from 'react';
import type { CoachAdvice, Difficulty, GameConfig, GameEngine, PlayerId } from './types';

export interface BotPersona {
  /** Original, invented character. */
  name: string;
  /** One-line personality shown under the avatar. */
  tagline: string;
  /** Avatar spec rendered by <BotAvatar/> (pure SVG, no images). */
  avatar: {
    /** Background colour (hex). */
    bg: string;
    /** Face/skin tone (hex). */
    skin: string;
    /** Accessory drawn on the avatar. */
    accessory: 'turban' | 'cap' | 'shades' | 'bow' | 'crown' | 'headphones' | 'monocle' | 'flower' | 'beret' | 'none';
    /** Accessory colour (hex). */
    accent: string;
  };
}

export interface BoardProps<S, M> {
  state: S;
  /** Seat controlled by the learner (always 0). */
  human: PlayerId;
  /** Legal moves for the human right now (empty if not their turn). */
  legalMoves: M[];
  /**
   * Submit a move. The controller validates it with engine.checkMove and, if it
   * is illegal, shows the "why" in the coach panel / a toast instead of applying it.
   * Boards should therefore let the learner *attempt* any reasonable move.
   */
  onMove: (move: M) => void;
  /** True while a bot is thinking or an animation is running — disable inputs. */
  busy: boolean;
  /** Seat currently "thinking" (for the thinking-dots indicator), or null. */
  thinking: PlayerId | null;
  /** Practice/coach mode: highlight legal moves and the suggested move. */
  coachMode: boolean;
  /** moveKey()s of moves to highlight (legal moves in coach mode). */
  highlight: ReadonlySet<string>;
  /** moveKey() of the coach's suggestion when the learner asked for a hint. */
  suggestedKey: string | null;
  /** Personas for seats 1..n-1 (index 0 is unused / the human). */
  personas: BotPersona[];
  /** Whether the game has ended (Board may reveal hidden cards). */
  over: boolean;
}

export interface BettingSpec {
  /** Chip choices offered in the bet panel (Jeet). */
  stakeOptions: number[];
  minStake: number;
  maxStake: number;
  /**
   * Worst-case loss in stake units for the *initial* commitment
   * (the wallet must cover stake × maxLossUnits before the game starts).
   */
  maxLossUnits: number;
  /** One-line explanation of how the bet pays, shown in the bet panel. */
  describe: string;
}

export interface PracticeSpec {
  /** Seed for the curated coached hand (chosen to show an interesting situation). */
  seed: number;
  /** Overrides for the practice config. */
  config?: Partial<GameConfig>;
  /** Intro shown by the coach before the first move. */
  intro: string;
}

export interface GameModule<S = unknown, M = unknown> {
  slug: string;
  engine: GameEngine<S, M>;
  Board: ComponentType<BoardProps<S, M>>;
  betting: BettingSpec;
  /** Personas for bot seats; index i is used for seat i+1. */
  bots: BotPersona[];
  defaultConfig: GameConfig;
  practice: PracticeSpec;
  /** Default bot difficulty choices shown in the UI. */
  difficulties?: Difficulty[];
  /** Optional: human-readable label for a move (used by generic move lists). */
  moveLabel?: (move: M, state: S) => string;
  /** Optional custom coach text renderer. */
  formatAdvice?: (advice: CoachAdvice, state: S) => string;
}
