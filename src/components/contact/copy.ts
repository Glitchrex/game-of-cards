/**
 * Copy text to the clipboard: async Clipboard API first, then a hidden
 * <textarea> + execCommand('copy') fallback (older browsers / non-secure
 * contexts). Restores focus afterwards. Resolves to true on success.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or insecure context — fall through to the legacy path.
    }
  }
  if (typeof document === 'undefined') return false;
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  ta.style.left = '0';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
    previous?.focus({ preventScroll: true });
  }
}
