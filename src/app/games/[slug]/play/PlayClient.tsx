'use client';
import { GameShell, type GameShellProps } from '@/components/play/GameShell';

/** Client boundary for the play route: the whole table is interactive. */
export function PlayClient(props: GameShellProps) {
  return <GameShell {...props} />;
}
