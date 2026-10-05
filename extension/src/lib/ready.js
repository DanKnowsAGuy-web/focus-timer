// Marks the document so tests and the settings page can tell the overlay is
// running, and on which site. Idempotent.
export function markReady(doc, site) {
  const html = doc.documentElement;
  if (html.dataset.feedoverlay === 'ready') return false;
  html.dataset.feedoverlay = 'ready';
  html.dataset.feedoverlaySite = site;
  return true;
}
