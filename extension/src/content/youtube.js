// Overlay entry for youtube.com (document_idle).
import { markReady } from '../lib/ready.js';
import { pageType, healthCheck } from '../lib/selectors/youtube.js';
import { getSettings, onSettingsChange } from '../lib/settings.js';
import { applyAll, processAdded, applyToggleChange, redirectIfNeeded } from '../lib/declutter/youtube.js';
import { createPipeline } from '../lib/pipeline.js';
import { mountExtrasToggle, resetExtras } from '../lib/extras.js';

function record() {
  const html = document.documentElement;
  html.dataset.feedoverlayPage = pageType();
  try {
    html.dataset.feedoverlayHealth = JSON.stringify(healthCheck(document));
  } catch (err) {
    html.dataset.feedoverlayHealth = JSON.stringify({ ok: false, error: String(err) });
  }
}

async function main() {
  let cfg = (await getSettings()).sites.youtube;
  record();

  if (cfg.enabled) {
    if (redirectIfNeeded(document, cfg)) return;
    applyAll(document, cfg);
    mountExtrasToggle(document);

    const target = document.querySelector('ytd-app') || document.body;
    createPipeline(target, (nodes) => processAdded(nodes, cfg, document), {
      ignore: (n) => n.id === 'feedoverlay-extras' || n.id === 'feedoverlay-style',
    });

    onSettingsChange((s) => {
      const next = s.sites.youtube;
      applyToggleChange(document, cfg, next);
      cfg = next;
    });

    const onNavigate = () => {
      record();
      resetExtras(document);
      if (redirectIfNeeded(document, cfg)) return;
      applyAll(document, cfg);
    };
    document.addEventListener('yt-navigate-finish', onNavigate);
    window.addEventListener('popstate', onNavigate);
  }

  markReady(document, 'youtube');
}

main();
