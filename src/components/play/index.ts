/**
 * Play experience: the generic shell every Tier 1 game plugs into, the coached
 * practice hand, result overlays, coach panel, rating prompt and the table pieces
 * (seats, avatars) that game Boards reuse.
 */
export { GameShell, RESULT_REVEAL_MS, type GameShellProps } from './GameShell';
export { PracticeHand, type PracticeHandProps } from './PracticeHand';
export { BetPanel, chipLabel, stakeChoices, type BetPanelProps } from './BetPanel';
export { CoachPanel, type CoachPanelProps } from './CoachPanel';
export { RatingPrompt, ratingStorageKey, type RatingPromptProps } from './RatingPrompt';
export {
  Celebration,
  CELEBRATION_FX_MS,
  celebrationPieces,
  type CelebrationProps,
} from './Celebration';
export { Roast, type RoastProps } from './Roast';
export { PushOverlay, type PushOverlayProps } from './PushOverlay';
export { OverlayShell, type OverlayShellProps, type OverlayTone } from './OverlayShell';
export {
  BotAvatar,
  AVATAR_ACCESSORIES,
  shade,
  type BotAvatarProps,
  type AvatarAccessory,
  type AvatarSize,
} from './BotAvatar';
export { ThinkingDots, type ThinkingDotsProps } from './ThinkingDots';
export { Seat, TurnIndicator, type SeatProps, type TurnIndicatorProps } from './Seat';
export { TableFrame, TableSkeleton, type TableFrameProps } from './TableFrame';
export { MoveLog, type MoveLogProps } from './MoveLog';
export {
  YOU_PERSONA,
  COACH_PERSONA,
  seatPersonas,
  personaForSeat,
  joinNames,
  stripTipPrefix,
} from './personas';
export { useGameModule, type GameModuleState, type GameModuleStatus } from './useGameModule';
export {
  useGameController,
  personalise,
  learnerSituation,
  HUMAN,
  type GameController,
  type ControllerOptions,
  type LogEntry,
} from './useGameController';
