/**
 * Tiny parser for the rich text used in game content: paragraphs separated by
 * blank lines, single line breaks, **bold** and glossary links written as
 * [[term]] or [[shown text|term]]. Pure and framework-free so both the client
 * GlossaryText and server-rendered hub pages share one implementation.
 */

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export type RichNode =
  | { kind: 'text'; text: string }
  | { kind: 'term'; shown: string; term: string }
  | { kind: 'bold'; children: RichNode[] }
  | { kind: 'break' };

export type RichParagraph = RichNode[];

const TERM_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const INLINE_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*\*([\s\S]+?)\*\*/g;

function pushText(out: RichNode[], text: string) {
  if (!text) return;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) out.push({ kind: 'break' });
    if (line) out.push({ kind: 'text', text: line });
  });
}

function parseTerms(text: string): RichNode[] {
  const out: RichNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TERM_RE)) {
    const index = m.index ?? 0;
    pushText(out, text.slice(last, index));
    const first = (m[1] ?? '').trim();
    const second = m[2]?.trim();
    out.push({ kind: 'term', shown: first, term: second ?? first });
    last = index + m[0].length;
  }
  pushText(out, text.slice(last));
  return out;
}

/** Parse one paragraph (no blank lines) into inline nodes. */
export function parseInline(text: string): RichNode[] {
  const out: RichNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const index = m.index ?? 0;
    pushText(out, text.slice(last, index));
    if (m[3] !== undefined) {
      out.push({ kind: 'bold', children: parseTerms(m[3]) });
    } else {
      const first = (m[1] ?? '').trim();
      const second = m[2]?.trim();
      out.push({ kind: 'term', shown: first, term: second ?? first });
    }
    last = index + m[0].length;
  }
  pushText(out, text.slice(last));
  return out;
}

/** Split on blank lines and parse every paragraph. Empty paragraphs are dropped. */
export function parseRichText(text: string): RichParagraph[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(parseInline);
}

/** Case-insensitive glossary lookup table. */
export function glossaryMap(glossary: readonly GlossaryEntry[]): Map<string, GlossaryEntry> {
  return new Map(glossary.map((g) => [g.term.trim().toLowerCase(), g]));
}

function nodeText(node: RichNode): string {
  switch (node.kind) {
    case 'text':
      return node.text;
    case 'term':
      return node.shown;
    case 'bold':
      return node.children.map(nodeText).join('');
    case 'break':
      return ' ';
  }
}

/** Plain text with all markup removed (paragraphs joined by a space). */
export function richTextToPlain(text: string): string {
  return parseRichText(text)
    .map((p) => p.map(nodeText).join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
