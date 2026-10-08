'use client';
/** Small building blocks shared by the admin tab panels. */
import { useId, useState, type ReactNode } from 'react';
import { excerpt } from '@/components/community/format';
import { t } from '@/lib/i18n';

export function PanelHeading({
  id,
  count,
  children,
}: {
  id: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <h2
        id={id}
        tabIndex={-1}
        className="font-display text-gold-100 text-xl leading-tight font-bold outline-none sm:text-2xl"
      >
        {children}
      </h2>
      {count !== undefined ? (
        <span className="text-mist tabular text-sm font-semibold">
          {count.toLocaleString('en-US')}
        </span>
      ) : null}
    </div>
  );
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="border-gold-300/20 text-mist mt-4 rounded-2xl border border-dashed px-5 py-8 text-center">
      {children}
    </p>
  );
}

/** Plain text (line breaks kept) that collapses to an excerpt when it is long. */
export function ExpandableText({
  text,
  limit,
  className,
}: {
  text: string;
  limit: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const long = text.replace(/\s+/g, ' ').trim().length > limit;
  return (
    <div className={className}>
      <p
        id={id}
        className="text-cream/95 text-[0.9375rem] leading-relaxed break-words whitespace-pre-line"
      >
        {long && !open ? excerpt(text, limit) : text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="text-gold-200 hover:text-gold-100 -ml-1 inline-flex min-h-11 items-center rounded-md px-1 text-sm font-semibold underline underline-offset-4"
        >
          {open ? t('admin.posts.lessText') : t('admin.posts.fullText')}
        </button>
      ) : null}
    </div>
  );
}
