/**
 * Text clean-up for generated Open Graph images. The bundled image font has no
 * suit symbols or emoji, so suits are spelled out and pictographs dropped —
 * the renderer then never needs to fetch a fallback font over the network.
 */
const SUIT_WORDS: Record<string, string> = {
  '♠': ' of Spades',
  '♥': ' of Hearts',
  '♦': ' of Diamonds',
  '♣': ' of Clubs',
};

export function ogText(text: string): string {
  return text
    .replace(/[♠♥♦♣]/g, (s) => SUIT_WORDS[s] ?? '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
