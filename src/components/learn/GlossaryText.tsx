'use client';
/**
 * Renders content rich text: paragraphs, **bold** and glossary terms. Each
 * known term becomes a dotted-underlined inline button that opens a small
 * popover with its definition (click/tap, or keyboard focus; Esc closes). The
 * definition is also wired up as the button's accessible description so screen
 * readers hear it straight away.
 */
import { Fragment, useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { Popover } from '@/components/ui/Popover';
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';
import { glossaryMap, parseRichText, type GlossaryEntry, type RichNode } from './rich-text';

export interface GlossaryTextProps {
  text: string;
  glossary: readonly GlossaryEntry[];
  className?: string;
  /** Class for each paragraph. */
  paragraphClassName?: string;
  /**
   * Render paragraphs as block-level <span>s instead of <p>, for places that
   * only accept phrasing content (e.g. inside another paragraph).
   */
  inline?: boolean;
}

const TRIGGER_CLASS =
  'cursor-help rounded-sm font-semibold text-gold-100 underline decoration-gold-300/75 decoration-dotted decoration-2 underline-offset-[5px] transition-colors duration-150 hover:text-gold-200 hover:decoration-gold-200 aria-expanded:bg-gold-300/15 aria-expanded:text-gold-200';

function GlossaryTerm({ shown, entry }: { shown: string; entry: GlossaryEntry }) {
  const descId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);

  // The UI-kit Popover owns its trigger button; point its accessible
  // description at the (hidden) definition so it is read on focus.
  useEffect(() => {
    const button = wrapRef.current?.querySelector('button');
    button?.setAttribute('aria-describedby', descId);
  }, [descId]);

  return (
    <span ref={wrapRef} data-glossary-term="">
      <Popover inline openOnFocus trigger={shown} triggerClassName={TRIGGER_CLASS}>
        <span className="text-gold-300 block text-[0.6875rem] font-bold tracking-[0.18em] uppercase">
          {t('learn.glossary.termLabel')}
        </span>
        <span className="font-display text-gold-100 mt-0.5 block text-lg leading-tight font-bold">
          {entry.term}
        </span>
        <span className="text-cream mt-1.5 block">{entry.definition}</span>
      </Popover>
      <span id={descId} hidden>
        {entry.definition}
      </span>
    </span>
  );
}

function renderNodes(
  nodes: readonly RichNode[],
  lookup: Map<string, GlossaryEntry>,
  keyPrefix: string,
): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (node.kind) {
      case 'text':
        return <Fragment key={key}>{node.text}</Fragment>;
      case 'break':
        return <br key={key} />;
      case 'bold':
        return (
          <strong key={key} className="text-cream font-bold">
            {renderNodes(node.children, lookup, key)}
          </strong>
        );
      case 'term': {
        const entry = lookup.get(node.term.toLowerCase());
        if (!entry) return <Fragment key={key}>{node.shown}</Fragment>;
        return <GlossaryTerm key={key} shown={node.shown} entry={entry} />;
      }
    }
  });
}

export function GlossaryText({
  text,
  glossary,
  className,
  paragraphClassName,
  inline = false,
}: GlossaryTextProps) {
  const paragraphs = useMemo(() => parseRichText(text), [text]);
  const lookup = useMemo(() => glossaryMap(glossary), [glossary]);
  const P = inline ? 'span' : 'p';
  const Wrapper = inline ? 'span' : 'div';
  return (
    <Wrapper className={cn(inline && 'block', 'space-y-3', className)}>
      {paragraphs.map((nodes, i) => (
        <P key={i} className={cn(inline && 'block', paragraphClassName)}>
          {renderNodes(nodes, lookup, String(i))}
        </P>
      ))}
    </Wrapper>
  );
}
