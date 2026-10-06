/** Keyboard helpers shared by the lesson player and quiz. */

/** Widgets that use the arrow (and digit) keys themselves. */
const KEY_WIDGETS = [
  'toolbar',
  'listbox',
  'slider',
  'tablist',
  'radiogroup',
  'menu',
  'menubar',
  'grid',
  'tree',
]
  .map((role) => `[role="${role}"]`)
  .join(',');

const OVERLAYS = 'dialog,[role="dialog"],[role="alertdialog"],[aria-modal="true"]';

/**
 * True when a page-level shortcut should leave the key alone because focus is
 * in a text field, inside a dialog/sheet, on a glossary popover, or inside a
 * widget that handles arrow keys itself.
 */
export function focusOwnsKeys(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
  if (el.closest(OVERLAYS)) return true;
  if (el.closest('[data-glossary-term]')) return true;
  return Boolean(el.closest(KEY_WIDGETS));
}

/** True when any modifier key is held (shortcuts never fire with modifiers). */
export function hasModifier(e: KeyboardEvent): boolean {
  return e.altKey || e.ctrlKey || e.metaKey || e.shiftKey;
}
