export const settings = {
  title: 'Table settings',
  open: 'Settings',
  sound: {
    label: 'Sound',
    hint: 'Card flicks, coin chimes and the odd fanfare.',
    on: 'Sound on',
    off: 'Sound off',
  },
  fourColor: {
    label: 'Four-colour deck',
    hint: '♠ black · ♥ red · ♦ blue · ♣ green — easier to tell suits apart.',
  },
  motion: {
    label: 'Motion',
    hint: 'System follows your device’s reduced-motion setting.',
    system: 'System',
    reduce: 'Reduce',
    full: 'Full',
  },
  botSpeed: {
    label: 'Bot speed',
    hint: 'How long bots “think” before they play.',
    relaxed: 'Relaxed',
    normal: 'Normal',
    fast: 'Fast',
  },
} as const;
