'use client';
/**
 * Shared modal behaviour for <Dialog/> and <Sheet/>: a stack so nested modals
 * behave, focus trap (Tab / Shift+Tab cycle inside the panel), Escape to
 * close, focus restore to the opener, a reference-counted scroll lock, and
 * `inert` on everything behind the top-most modal (so touch screen readers
 * can't swipe out of it either).
 */
import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';

interface ModalEntry {
  id: symbol;
  panelRef: RefObject<HTMLElement | null>;
}

const stack: ModalEntry[] = [];
/** Elements this module made inert (so we never clear someone else's `inert`). */
const inerted = new Set<Element>();
let scrollLocks = 0;
let saved: { htmlOverflow: string; bodyOverflow: string; bodyPaddingRight: string } | null = null;

function lockScroll() {
  scrollLocks += 1;
  if (scrollLocks > 1) return;
  const html = document.documentElement;
  const body = document.body;
  const scrollbar = window.innerWidth - html.clientWidth;
  saved = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
  };
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks > 0 || !saved) return;
  document.documentElement.style.overflow = saved.htmlOverflow;
  document.body.style.overflow = saved.bodyOverflow;
  document.body.style.paddingRight = saved.bodyPaddingRight;
  saved = null;
}

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',');

/**
 * Tabbable elements inside `root`, in DOM order. Like the browser, a named
 * radio group contributes a single stop: its checked radio (or its first one).
 */
export function getTabbable(root: HTMLElement): HTMLElement[] {
  const radioStops = new Map<string, HTMLInputElement>();
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.tabIndex < 0) return false;
    if ((el as HTMLElement & { disabled?: boolean }).disabled === true) return false;
    if (el.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    const check = (el as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility;
    if (typeof check === 'function' && !check.call(el)) return false;
    if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
      const current = radioStops.get(el.name);
      if (!current || (!current.checked && el.checked)) radioStops.set(el.name, el);
    }
    return true;
  });
  return candidates.filter(
    (el) =>
      !(el instanceof HTMLInputElement && el.type === 'radio' && el.name) ||
      radioStops.get(el.name) === el,
  );
}

/** Body-level wrappers that must stay reachable while a modal is open. */
function staysInteractive(el: Element): boolean {
  // Toasts and screen-reader announcers must keep talking.
  if (el.hasAttribute('aria-live')) return true;
  // Custom elements: Next's route announcer, the dev overlay.
  if (el.tagName.includes('-')) return true;
  return ['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT'].includes(el.tagName);
}

/** The direct child of <body> that contains `el` (the modal's portal root). */
function bodyLevelAncestor(el: Element): Element | null {
  let node: Element = el;
  while (node.parentElement && node.parentElement !== document.body) node = node.parentElement;
  return node.parentElement === document.body ? node : null;
}

/** Make everything behind the top-most open modal inert; undo it when none is open. */
function syncInert() {
  const top = stack[stack.length - 1];
  const panel = top?.panelRef.current;
  const keep = panel?.isConnected ? bodyLevelAncestor(panel) : null;
  const wanted = new Set<Element>();
  if (keep) {
    for (const child of Array.from(document.body.children)) {
      if (child === keep || staysInteractive(child)) continue;
      if (child.hasAttribute('inert') && !inerted.has(child)) continue;
      wanted.add(child);
    }
  }
  for (const el of Array.from(inerted)) {
    if (wanted.has(el)) continue;
    el.removeAttribute('inert');
    inerted.delete(el);
  }
  for (const el of wanted) {
    if (inerted.has(el)) continue;
    el.setAttribute('inert', '');
    inerted.add(el);
  }
}

export interface UseModalOptions {
  open: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
  /** Element to focus when the modal opens (default: the panel itself). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Allow Escape / backdrop click to close (default true). */
  dismissible?: boolean;
}

export function useModal({
  open,
  onClose,
  panelRef,
  initialFocusRef,
  dismissible = true,
}: UseModalOptions) {
  const idRef = useRef<symbol | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const id = Symbol('modal');
    idRef.current = id;
    stack.push({ id, panelRef });
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockScroll();

    const focusInitial = () => {
      (initialFocusRef?.current ?? panelRef.current)?.focus({ preventScroll: true });
      syncInert();
    };
    let raf = 0;
    if (initialFocusRef?.current ?? panelRef.current) focusInitial();
    else raf = window.requestAnimationFrame(focusInitial);

    const onFocusIn = (e: FocusEvent) => {
      if (stack[stack.length - 1]?.id !== id) return;
      const p = panelRef.current;
      if (!p || !(e.target instanceof Node) || p.contains(e.target)) return;
      (getTabbable(p)[0] ?? p).focus({ preventScroll: true });
    };
    document.addEventListener('focusin', onFocusIn);

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('focusin', onFocusIn);
      const i = stack.findIndex((entry) => entry.id === id);
      if (i >= 0) stack.splice(i, 1);
      idRef.current = null;
      unlockScroll();
      syncInert();
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
    // initialFocusRef/panelRef are stable refs; only `open` drives the lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isTop = () => idRef.current !== null && stack[stack.length - 1]?.id === idRef.current;

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!isTop()) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (dismissible) {
        e.preventDefault();
        onCloseRef.current();
      }
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    e.stopPropagation();
    const items = getTabbable(panel);
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!first || !last) {
      e.preventDefault();
      panel.focus({ preventScroll: true });
      return;
    }
    if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  const onBackdropClick = () => {
    if (dismissible && isTop()) onCloseRef.current();
  };

  return { onKeyDown, onBackdropClick };
}
