// Overlay entry for youtube.com.
// Phase 1: mark ready, record page type and selector health on <html> so
// tests and the settings page can read them. Later phases add declutter,
// tabs, controls and the jar through this entry.
import { markReady } from '../lib/ready.js';
import { pageType, healthCheck } from '../lib/selectors/youtube.js';

function record() {
  const html = document.documentElement;
  html.dataset.feedoverlayPage = pageType();
  try {
    html.dataset.feedoverlayHealth = JSON.stringify(healthCheck(document));
  } catch (err) {
    html.dataset.feedoverlayHealth = JSON.stringify({ ok: false, error: String(err) });
  }
}

markReady(document, 'youtube');
record();
// YouTube is a single-page app; re-record after its own navigation event.
document.addEventListener('yt-navigate-finish', record);
window.addEventListener('popstate', record);
