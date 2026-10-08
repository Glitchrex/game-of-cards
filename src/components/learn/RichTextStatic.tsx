/**
 * Server-renderable rich text for indexable pages: paragraphs, line breaks and
 * **bold**, with glossary terms shown in bold (no popovers, no client JS).
 */
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { parseRichText, type RichNode } from './rich-text';

function render(nodes: readonly RichNode[], prefix: string): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${prefix}-${i}`;
    switch (node.kind) {
      case 'text':
        return <Fragment key={key}>{node.text}</Fragment>;
      case 'break':
        return <br key={key} />;
      case 'term':
        return (
          <strong key={key} className="text-gold-100 font-semibold">
            {node.shown}
          </strong>
        );
      case 'bold':
        return (
          <strong key={key} className="text-cream font-bold">
            {render(node.children, key)}
          </strong>
        );
    }
  });
}

export function RichTextStatic({
  text,
  className,
  paragraphClassName,
}: {
  text: string;
  className?: string;
  paragraphClassName?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {parseRichText(text).map((nodes, i) => (
        <p key={i} className={paragraphClassName}>
          {render(nodes, String(i))}
        </p>
      ))}
    </div>
  );
}
