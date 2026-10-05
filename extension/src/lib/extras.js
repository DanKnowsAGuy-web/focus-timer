// The one escape hatch: a small pill that reveals everything we hid for the
// current page view. Navigating (YouTube's SPA navigation included) hides
// things again.
import { showExtras, extrasShown } from './hide.js';

const ID = 'feedoverlay-extras';
const SHOW = "Show YouTube's extras";
const HIDE = 'Hide extras again';

export function mountExtrasToggle(doc) {
  if (doc.getElementById(ID)) return doc.getElementById(ID);
  const wrap = doc.createElement('div');
  wrap.id = ID;
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.textContent = SHOW;
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => {
    const next = !extrasShown(doc);
    showExtras(doc, next);
    btn.textContent = next ? HIDE : SHOW;
    btn.setAttribute('aria-pressed', String(next));
  });
  wrap.appendChild(btn);
  (doc.body || doc.documentElement).appendChild(wrap);
  return wrap;
}

export function resetExtras(doc) {
  showExtras(doc, false);
  const btn = doc.querySelector(`#${ID} button`);
  if (btn) { btn.textContent = SHOW; btn.setAttribute('aria-pressed', 'false'); }
}
