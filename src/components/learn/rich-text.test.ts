import { describe, expect, it } from 'vitest';
import { glossaryMap, parseInline, parseRichText, richTextToPlain } from './rich-text';

describe('parseRichText', () => {
  it('parses [[term]] and [[shown|term]] links', () => {
    expect(parseInline('Play a [[trump]] or [[packs|pack]].')).toEqual([
      { kind: 'text', text: 'Play a ' },
      { kind: 'term', shown: 'trump', term: 'trump' },
      { kind: 'text', text: ' or ' },
      { kind: 'term', shown: 'packs', term: 'pack' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('parses **bold**, including glossary terms inside bold', () => {
    expect(parseInline('**Never** lead a **[[trump]] early**!')).toEqual([
      { kind: 'bold', children: [{ kind: 'text', text: 'Never' }] },
      { kind: 'text', text: ' lead a ' },
      {
        kind: 'bold',
        children: [
          { kind: 'term', shown: 'trump', term: 'trump' },
          { kind: 'text', text: ' early' },
        ],
      },
      { kind: 'text', text: '!' },
    ]);
  });

  it('splits paragraphs on blank lines and keeps single line breaks', () => {
    const paras = parseRichText('First line\nsecond line\n\n  \nNext paragraph\r\n\r\nLast');
    expect(paras).toHaveLength(3);
    expect(paras[0]).toEqual([
      { kind: 'text', text: 'First line' },
      { kind: 'break' },
      { kind: 'text', text: 'second line' },
    ]);
    expect(paras[1]).toEqual([{ kind: 'text', text: 'Next paragraph' }]);
    expect(paras[2]).toEqual([{ kind: 'text', text: 'Last' }]);
  });

  it('leaves unmatched markup as plain text', () => {
    expect(parseInline('a ** b [[ c')).toEqual([{ kind: 'text', text: 'a ** b [[ c' }]);
  });

  it('strips markup to plain text', () => {
    expect(richTextToPlain('A **big** [[packs|pack]].\n\nThen [[show]].')).toBe(
      'A big packs. Then show.',
    );
  });

  it('looks glossary terms up case-insensitively', () => {
    const map = glossaryMap([{ term: 'Trump', definition: 'Boss suit' }]);
    expect(map.get('trump')?.definition).toBe('Boss suit');
  });
});
