// Hiding is one attribute plus one stylesheet rule. Each hidden element
// records why it is hidden, so turning a toggle off can release exactly its
// elements, and "Show extras" flips a single attribute on <html> to reveal
// everything at once without touching the DOM again.

export const HIDDEN_ATTR = 'data-feedoverlay-hidden';
export const EXTRAS_ATTR = 'data-feedoverlay-extras';
const STYLE_ID = 'feedoverlay-style';

export const STYLE_TEXT = `
html:not([${EXTRAS_ATTR}="shown"]) [${HIDDEN_ATTR}] { display: none !important; }
#feedoverlay-extras { position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; font: 500 12px/1 system-ui, sans-serif; }
#feedoverlay-extras button { font: inherit; color: #8a7b6e; background: rgba(246,242,236,.92); border: 1px solid #e3d9cc; border-radius: 999px; padding: 8px 12px; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
#feedoverlay-extras button:hover { color: #2a211b; }
@media (prefers-color-scheme: dark) {
  #feedoverlay-extras button { color: #9d8f80; background: rgba(23,19,16,.9); border-color: #342b24; }
  #feedoverlay-extras button:hover { color: #f1e8dc; }
}
`;

export function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = STYLE_ID;
  st.textContent = STYLE_TEXT;
  (doc.head || doc.documentElement).appendChild(st);
}

export function hide(el, reason) {
  if (!el || el.nodeType !== 1) return false;
  const cur = el.getAttribute(HIDDEN_ATTR);
  if (!cur) { el.setAttribute(HIDDEN_ATTR, reason); return true; }
  const reasons = cur.split(' ');
  if (reasons.includes(reason)) return false;
  el.setAttribute(HIDDEN_ATTR, cur + ' ' + reason);
  return true;
}

export function hideAll(els, reason) {
  let n = 0;
  for (const el of els || []) if (hide(el, reason)) n++;
  return n;
}

/** Release every element hidden for this reason (keeping other reasons). */
export function unhideReason(root, reason) {
  let n = 0;
  for (const el of root.querySelectorAll(`[${HIDDEN_ATTR}~="${reason}"]`)) {
    const rest = el.getAttribute(HIDDEN_ATTR).split(' ').filter((r) => r !== reason);
    if (rest.length) el.setAttribute(HIDDEN_ATTR, rest.join(' '));
    else el.removeAttribute(HIDDEN_ATTR);
    n++;
  }
  return n;
}

export function showExtras(doc, shown) {
  if (shown) doc.documentElement.setAttribute(EXTRAS_ATTR, 'shown');
  else doc.documentElement.removeAttribute(EXTRAS_ATTR);
}

export function extrasShown(doc) {
  return doc.documentElement.getAttribute(EXTRAS_ATTR) === 'shown';
}
