// Runs at document_start so redirects happen before YouTube paints.
import { getSettings } from '../lib/settings.js';
import { redirectIfNeeded } from '../lib/declutter/youtube.js';

getSettings().then((s) => {
  const cfg = s.sites.youtube;
  if (!cfg.enabled) return;
  redirectIfNeeded(document, cfg);
}).catch(() => {});
