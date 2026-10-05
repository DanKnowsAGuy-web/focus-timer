// Declutter rules for youtube.com. Pure functions over a document and a
// settings object; the content script decides when to call them.
import * as S from '../selectors/youtube.js';
import { hide, hideAll, unhideReason, ensureStyle } from '../hide.js';

// toggle name -> reason recorded on hidden elements
export const TOGGLE_REASON = {
  hideHomeFeed: 'homeFeed',
  hideShorts: 'shorts',
  hideRecommendedSidebar: 'sidebar',
  hideEndScreens: 'endScreens',
  hideComments: 'comments',
  hideMetrics: 'metrics',
  hideSubscriberCounts: 'subs',
  hideNotificationCount: 'notif',
  hideTrendingExplore: 'nav',
};

const ITEM_SELECTOR = 'ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-video-renderer, ytm-shorts-lockup-view-model';

/**
 * Redirects that must happen before anything renders. Returns true when a
 * navigation was issued and the caller should stop.
 */
export function redirectIfNeeded(doc, cfg, loc = doc.location) {
  const type = S.pageType(loc);
  if (type === 'home' && cfg.redirectHomeToSubscriptions) {
    loc.replace('/feed/subscriptions');
    return true;
  }
  if (type === 'shorts' && cfg.hideShorts) {
    const id = S.videoIdFromHref(loc.pathname);
    if (id) { loc.replace('/watch?v=' + id); return true; }
  }
  return false;
}

export function processItems(items, cfg) {
  let hidden = 0;
  for (const el of items) {
    if (cfg.hideShorts) {
      const p = S.parseItem(el);
      if (p.isShort && hide(el, 'shorts')) hidden++;
    }
    if (cfg.hideMetrics) hidden += hideAll(S.findMetrics(el), 'metrics');
  }
  return hidden;
}

function navEntries(doc) {
  const out = { shorts: [], trending: [] };
  for (const a of S.findNavLinks(doc) || []) {
    const entry = a.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer') || a;
    if (a.getAttribute('href') === '/shorts') out.shorts.push(entry);
    else out.trending.push(entry);
  }
  return out;
}

const autoplayState = { lastClick: 0 };

function turnOffAutoplay(doc) {
  const toggle = S.findAutoplayToggle(doc);
  const html = doc.documentElement;
  if (!toggle) return;
  if (toggle.getAttribute('aria-checked') === 'false') { html.dataset.feedoverlayAutoplay = 'off'; return; }
  const now = Date.now();
  if (now - autoplayState.lastClick < 2000) return;
  autoplayState.lastClick = now;
  (toggle.closest('button') || toggle).click();
  html.dataset.feedoverlayAutoplay = 'clicked';
  setTimeout(() => {
    if (toggle.getAttribute('aria-checked') === 'false') html.dataset.feedoverlayAutoplay = 'off';
  }, 250);
}

/** Landmarks: the big blocks whose presence is page-level, not per item. */
export function applyLandmarks(doc, cfg) {
  ensureStyle(doc);
  const type = S.pageType(doc.location);
  const nav = navEntries(doc);
  if (cfg.hideShorts) hideAll(nav.shorts, 'shorts');
  if (cfg.hideTrendingExplore) hideAll(nav.trending, 'nav');
  if (cfg.hideNotificationCount) hide(S.findNotificationBadge(doc), 'notif');
  if (cfg.hideShorts) hide(S.findShortsShelf(doc), 'shorts');
  if (type === 'home' && cfg.hideHomeFeed) hide(S.findFeed(doc), 'homeFeed');
  if (type === 'watch') {
    if (cfg.hideRecommendedSidebar) hide(S.findRecommendedSidebar(doc), 'sidebar');
    if (cfg.hideEndScreens) hide(S.findEndScreen(doc), 'endScreens');
    if (cfg.hideComments) hide(S.findComments(doc), 'comments');
    if (cfg.hideSubscriberCounts) hide(S.findSubscriberCount(doc), 'subs');
    if (cfg.hideMetrics) {
      const meta = doc.querySelector('ytd-watch-metadata');
      if (meta) hideAll(S.findMetrics(meta), 'metrics');
    }
    if (cfg.disableAutoplay) turnOffAutoplay(doc);
  }
}

/** Full pass: landmarks plus every item currently on the page. */
export function applyAll(doc, cfg) {
  applyLandmarks(doc, cfg);
  const items = [...doc.querySelectorAll(ITEM_SELECTOR)];
  processItems(items, cfg);
}

/** Incremental pass over nodes added since the last frame. */
export function processAdded(nodes, cfg, doc) {
  const items = new Set();
  let landmarkCandidate = false;
  for (const n of nodes) {
    if (n.matches && n.matches(ITEM_SELECTOR)) items.add(n);
    if (n.querySelectorAll) for (const i of n.querySelectorAll(ITEM_SELECTOR)) items.add(i);
    if (!landmarkCandidate && n.tagName && /^(YTD|YTM|YT)-/.test(n.tagName) && !n.matches(ITEM_SELECTOR)) landmarkCandidate = true;
  }
  processItems([...items], cfg);
  if (landmarkCandidate) applyLandmarks(doc, cfg);
}

/** A toggle flipped: release what it hid, then re-apply the new config. */
export function applyToggleChange(doc, oldCfg, newCfg) {
  for (const [toggle, reason] of Object.entries(TOGGLE_REASON)) {
    if (oldCfg[toggle] && !newCfg[toggle]) unhideReason(doc, reason);
  }
  applyAll(doc, newCfg);
}
