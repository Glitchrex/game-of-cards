'use client';
import Link from 'next/link';
import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. Buttons only. */
  loading?: boolean;
  /** Extra screen-reader text while loading (e.g. "Sending…"). */
  loadingLabel?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export type ButtonAsButtonProps = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> & {
    href?: undefined;
    ref?: Ref<HTMLButtonElement>;
  };

export type ButtonAsLinkProps = ButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps | 'href'> & {
    /** Internal paths render a next/link; http(s)/mailto/tel render a plain <a>. */
    href: string;
    prefetch?: boolean;
    replace?: boolean;
    scroll?: boolean;
    ref?: Ref<HTMLAnchorElement>;
  };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

// Labels may wrap (never overflow a 375 px screen); min-heights keep every size ≥ 44 px.
const base =
  'group/btn relative inline-flex max-w-full select-none items-center justify-center gap-2 py-2 text-center font-semibold tracking-[0.01em] no-underline transition-[transform,background-color,border-color,color,box-shadow,filter,opacity] duration-150 ease-snap active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary:
    'text-ink bg-[linear-gradient(180deg,var(--color-gold-200)_0%,var(--color-gold-400)_52%,var(--color-gold-500)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(138_99_18/0.35),0_8px_20px_-10px_rgb(236_193_83/0.7)] hover:brightness-[1.06] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(138_99_18/0.35),0_10px_26px_-8px_rgb(245_215_122/0.75)]',
  secondary:
    'border border-gold-300/55 bg-felt-950/30 text-gold-200 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] hover:border-gold-300 hover:bg-gold-300/10 hover:text-gold-100',
  ghost: 'text-cream hover:bg-white/[0.07] hover:text-gold-200',
  danger:
    'border border-velvet-400/50 text-cream bg-[linear-gradient(180deg,var(--color-velvet-500)_0%,var(--color-velvet-600)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_8px_20px_-10px_rgb(194_47_71/0.7)] hover:brightness-110',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 min-w-11 rounded-lg px-3.5 text-sm',
  md: 'min-h-12 min-w-12 rounded-xl px-5 text-[0.9375rem]',
  lg: 'min-h-14 min-w-14 rounded-xl px-7 text-base sm:text-lg',
};

/** Class string for anything that should look like a Button (e.g. a <label>). */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className);
}

const isExternal = (href: string) => /^(https?:|mailto:|tel:|\/\/)/i.test(href);

function Content({
  leadingIcon,
  trailingIcon,
  children,
  loading,
  loadingLabel,
}: Pick<
  ButtonBaseProps,
  'leadingIcon' | 'trailingIcon' | 'children' | 'loading' | 'loadingLabel'
>) {
  return (
    <>
      <span
        className={cn(
          'inline-flex items-center justify-center gap-2 transition-opacity',
          loading && 'opacity-0',
        )}
      >
        {leadingIcon ? (
          <span className="-ml-0.5 inline-flex shrink-0" aria-hidden="true">
            {leadingIcon}
          </span>
        ) : null}
        {children}
        {trailingIcon ? (
          <span className="-mr-0.5 inline-flex shrink-0" aria-hidden="true">
            {trailingIcon}
          </span>
        ) : null}
      </span>
      {loading ? (
        <span className="absolute inset-0 inline-flex items-center justify-center">
          <Spinner size="sm" />
          {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
        </span>
      ) : null}
    </>
  );
}

/**
 * The house button. `primary` = gold, `secondary` = gold outline, `ghost`,
 * `danger` = velvet. Every size keeps a ≥ 44 px touch target. Pass `href` to
 * render a link styled as a button.
 */
export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const {
      variant,
      size,
      fullWidth,
      loading: _loading,
      loadingLabel: _loadingLabel,
      leadingIcon,
      trailingIcon,
      className,
      children,
      href,
      prefetch,
      replace,
      scroll,
      ref,
      ...rest
    } = props;
    const classes = buttonClasses({ variant, size, fullWidth, className });
    const content = (
      <Content leadingIcon={leadingIcon} trailingIcon={trailingIcon}>
        {children}
      </Content>
    );
    if (isExternal(href)) {
      return (
        <a ref={ref} href={href} className={classes} {...rest}>
          {content}
        </a>
      );
    }
    return (
      <Link
        ref={ref}
        href={href}
        prefetch={prefetch}
        replace={replace}
        scroll={scroll}
        className={classes}
        {...rest}
      >
        {content}
      </Link>
    );
  }

  const {
    variant,
    size,
    fullWidth,
    loading = false,
    loadingLabel,
    leadingIcon,
    trailingIcon,
    className,
    children,
    type = 'button',
    onClick,
    ref,
    href: _href,
    ...rest
  } = props;
  // While loading we use aria-disabled (not `disabled`) so keyboard focus stays
  // on the button instead of being dropped to <body>.
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      aria-disabled={loading || rest['aria-disabled'] || undefined}
      className={buttonClasses({
        variant,
        size,
        fullWidth,
        className: cn(loading && 'pointer-events-none opacity-100!', className),
      })}
      onClick={(e) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    >
      <Content
        leadingIcon={leadingIcon}
        trailingIcon={trailingIcon}
        loading={loading}
        loadingLabel={loadingLabel}
      >
        {children}
      </Content>
    </button>
  );
}
