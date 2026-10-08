import { type ElementType, type HTMLAttributes, type ReactNode } from 'react';

export interface VisuallyHiddenProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** Element to render (default `span`). */
  as?: ElementType;
}

/** Content that is read by screen readers but not shown on screen. */
export function VisuallyHidden({ as: Tag = 'span', className, ...rest }: VisuallyHiddenProps) {
  return <Tag className={className ? `sr-only ${className}` : 'sr-only'} {...rest} />;
}
