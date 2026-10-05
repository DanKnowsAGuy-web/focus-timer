// Selector module for youtube.com.
//
// Every finder tries strategies in order and records which one hit, so
// healthCheck() can say exactly how close we are to a layout change breaking
// us. Primary strategies use YouTube's custom element tag names and aria
// attributes. Fallbacks are structural: they reason from hrefs and ancestry
// and never depend on generated class names.

const WATCH_RE = /[?&]v=([\w-]{11})/;
const SHORTS_RE = /\/shorts\/([\w-]{11})/;
const HANDLE_RE = /^\/(@[\w.-]+)/;
const CHANNEL_RE = /^\/channel\/(UC[\w-]{22})/;
const LEGACY_CHANNEL_RE = /^\/(?:c|user)\/([\w.-]+)/;
const METRIC_RE = /^[\d.,]+\s?[KMB]?\+?\s+(views?|watching|subscribers?|likes?)$/i;
const AD_TEXT_RE = /^(ad|ads|sponsored|promoted)$/i;

let health = {};

export function pageType(loc = globalThis.location) {
  const p = (loc && loc.pathname) || '/';
  if (p === '/' || p === '') return 'home';
  if (p.startsWith('/watch')) return 'watch';
  if (p.startsWith('/shorts')) return 'shorts';
  if (p.startsWith('/feed/subscriptions')) return 'subscriptions';
  if (p.startsWith('/feed/channels')) return 'channels';
  return 'other';
}

export function videoIdFromHref(href) {
  if (!href) return null;
  const w = href.match(WATCH_RE);
  if (w) return w[1];
  const s = href.match(SHORTS_RE);
  if (s) return s[1];
  return null;
}

export function channelIdFromHref(href) {
  if (!href) return null;
  const h = href.match(HANDLE_RE);
  if (h) return h[1];
  const c = href.match(CHANNEL_RE);
  if (c) return c[1];
  const l = href.match(LEGACY_CHANNEL_RE);
  if (l) return l[1];
  return null;
}

function text(el) {
  return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
}

function nonEmpty(list) {
  return list && list.length ? list : null;
}

/** Deepest element that contains every element in the list. */
function commonAncestor(els) {
  if (!els.length) return null;
  let anc = els[0];
  for (const el of els.slice(1)) {
    while (anc && !anc.contains(el)) anc = anc.parentElement;
    if (!anc) return null;
  }
  return anc;
}

function distinctVideoIds(el) {
  const ids = new Set();
  for (const a of el.querySelectorAll('a[href]')) {
    const id = videoIdFromHref(a.getAttribute('href'));
    if (id) ids.add(id);
  }
  return ids.size;
}

/**
 * Structural item discovery: start from each video anchor and climb while the
 * ancestor still contains exactly one distinct video id. The last such
 * ancestor is the item card.
 */
function itemsStructural(root) {
  const seen = new Map();
  for (const a of root.querySelectorAll('a[href]')) {
    const id = videoIdFromHref(a.getAttribute('href'));
    if (!id || seen.has(id)) continue;
    let el = a;
    while (el.parentElement && el.parentElement !== root && distinctVideoIds(el.parentElement) === 1) {
      el = el.parentElement;
    }
    seen.set(id, el);
  }
  return nonEmpty([...new Set(seen.values())]);
}

function makeFinder(name, strategies) {
  return function find(root = globalThis.document) {
    for (const s of strategies) {
      let result = null;
      try { result = s.fn(root); } catch { result = null; }
      if (result && (!Array.isArray(result) || result.length)) {
        health[name] = s.name;
        return result;
      }
    }
    health[name] = 'none';
    return null;
  };
}

function mainRegion(root) {
  return root.querySelector('ytd-browse[role="main"], ytd-browse, [role="main"]') || root;
}

export const findFeed = makeFinder('feed', [
  { name: 'rich-grid', fn: (r) => mainRegion(r).querySelector('ytd-rich-grid-renderer > #contents, ytd-rich-grid-renderer #contents') },
  { name: 'section-list', fn: (r) => mainRegion(r).querySelector('ytd-section-list-renderer #contents') },
  { name: 'structural', fn: (r) => {
      const items = itemsStructural(mainRegion(r));
      if (!items || items.length < 2) return null;
      return commonAncestor(items);
    } },
]);

export const findItems = makeFinder('items', [
  { name: 'rich-item', fn: (r) => nonEmpty([...mainRegion(r).querySelectorAll('ytd-rich-item-renderer')]) },
  { name: 'grid-video', fn: (r) => nonEmpty([...mainRegion(r).querySelectorAll('ytd-grid-video-renderer, ytd-video-renderer')]) },
  { name: 'structural', fn: (r) => itemsStructural(mainRegion(r)) },
]);

export const findShortsShelf = makeFinder('shortsShelf', [
  { name: 'rich-shelf', fn: (r) => r.querySelector('ytd-rich-shelf-renderer[is-shorts], ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])') },
  { name: 'reel-shelf', fn: (r) => r.querySelector('ytd-reel-shelf-renderer') },
  { name: 'structural', fn: (r) => {
      const anchors = [...r.querySelectorAll('a[href^="/shorts/"]')];
      if (anchors.length < 3) return null;
      let anc = commonAncestor(anchors);
      // Climb to the section wrapper when the shelf sits inside a grid row.
      while (anc && anc.parentElement && distinctVideoIds(anc.parentElement) === distinctVideoIds(anc)) anc = anc.parentElement;
      return anc;
    } },
]);

export const findRecommendedSidebar = makeFinder('recommendedSidebar', [
  { name: 'watch-next', fn: (r) => r.querySelector('ytd-watch-next-secondary-results-renderer') },
  { name: 'related', fn: (r) => r.querySelector('#secondary #related, #secondary-inner') },
  { name: 'structural', fn: (r) => {
      const flexy = r.querySelector('ytd-watch-flexy') || r;
      const items = itemsStructural(flexy);
      if (!items || items.length < 3) return null;
      return commonAncestor(items);
    } },
]);

export const findEndScreen = makeFinder('endScreen', [
  { name: 'endscreen-content', fn: (r) => r.querySelector('#movie_player .ytp-endscreen-content, .ytp-endscreen-content') },
  { name: 'ce-elements', fn: (r) => {
      const els = [...r.querySelectorAll('#movie_player [class*="ytp-ce-"]')];
      return els.length ? commonAncestor(els) : null;
    } },
  { name: 'structural', fn: (r) => {
      const player = r.querySelector('#movie_player, ytd-player');
      if (!player) return null;
      const items = itemsStructural(player);
      return items && items.length >= 2 ? commonAncestor(items) : null;
    } },
]);

export const findAutoplayToggle = makeFinder('autoplayToggle', [
  { name: 'autonav-toggle', fn: (r) => r.querySelector('.ytp-autonav-toggle-button') },
  { name: 'aria', fn: (r) => r.querySelector('#movie_player [aria-label*="utoplay"][role="checkbox"], #movie_player [aria-label*="utoplay"]') },
]);

export const findComments = makeFinder('comments', [
  { name: 'ytd-comments', fn: (r) => r.querySelector('ytd-comments#comments, ytd-comments') },
  { name: 'section', fn: (r) => r.querySelector('[section-identifier="comment-item-section"], #comments') },
]);

export const findSubscriberCount = makeFinder('subscriberCount', [
  { name: 'owner-sub-count', fn: (r) => r.querySelector('#owner-sub-count') },
  { name: 'text', fn: (r) => {
      const owner = r.querySelector('ytd-video-owner-renderer, ytd-watch-metadata') || r;
      for (const el of owner.querySelectorAll('span, yt-formatted-string, div')) {
        if (/subscribers?$/i.test(text(el)) && METRIC_RE.test(text(el))) return el;
      }
      return null;
    } },
]);

export const findNotificationBadge = makeFinder('notificationBadge', [
  { name: 'topbar-badge', fn: (r) => r.querySelector('ytd-notification-topbar-button-renderer .yt-spec-icon-badge-shape__badge, ytd-notification-topbar-button-renderer [class*="badge"]') },
  { name: 'structural', fn: (r) => {
      const btn = r.querySelector('ytd-notification-topbar-button-renderer, ytd-masthead [aria-label*="otification"]');
      if (!btn) return null;
      for (const el of btn.querySelectorAll('*')) {
        if (/^\d+\+?$/.test(text(el)) && el.children.length === 0) return el;
      }
      return null;
    } },
]);

export const findNavLinks = makeFinder('navLinks', [
  { name: 'guide-entries', fn: (r) => nonEmpty([...r.querySelectorAll('ytd-guide-entry-renderer a[href="/feed/trending"], ytd-guide-entry-renderer a[href="/feed/explore"], ytd-guide-entry-renderer a[href="/shorts"], ytd-mini-guide-entry-renderer a[href="/shorts"]')]) },
  { name: 'any-anchor', fn: (r) => nonEmpty([...r.querySelectorAll('a[href="/feed/trending"], a[href="/feed/explore"], a[href="/shorts"]')]) },
]);

export const findShortsContainer = makeFinder('shortsContainer', [
  { name: 'ytd-shorts', fn: (r) => r.querySelector('ytd-shorts #shorts-container, ytd-shorts') },
  { name: 'structural', fn: (r) => {
      const reels = [...r.querySelectorAll('ytd-reel-video-renderer')];
      return reels.length ? commonAncestor(reels) : null;
    } },
]);

export const findShortsItems = makeFinder('shortsItems', [
  { name: 'reel-video', fn: (r) => nonEmpty([...r.querySelectorAll('ytd-reel-video-renderer')]) },
  { name: 'structural', fn: (r) => {
      const c = r.querySelector('#shorts-container, #shorts-inner-container');
      return c ? nonEmpty([...c.children]) : null;
    } },
]);

/**
 * Metric elements inside a scope: view counts, watching counts, like counts,
 * subscriber counts. Time-ago text is not a metric and is left alone.
 */
const SUBS_RE = /subscribers?$/i;

export function findMetrics(scope) {
  const out = new Set();
  const direct = scope.querySelectorAll(
    '#metadata-line .inline-metadata-item, like-button-view-model .yt-spec-button-shape-next__button-text-content, ytd-watch-metadata #info span, ytd-like-button-renderer #text'
  );
  for (const el of direct) {
    const t = text(el);
    if (SUBS_RE.test(t)) continue; // subscriber counts have their own finder and toggle
    if (METRIC_RE.test(t) || /^[\d.,]+[KMB]?$/.test(t)) out.add(el);
  }
  if (out.size) { health.metrics = 'ids'; return [...out]; }
  for (const el of scope.querySelectorAll('span, div, yt-formatted-string')) {
    const t = text(el);
    if (el.children.length === 0 && METRIC_RE.test(t) && !SUBS_RE.test(t)) out.add(el);
  }
  health.metrics = out.size ? 'text' : 'none';
  return [...out];
}

function badgeTexts(el) {
  return [...el.querySelectorAll('ytd-badge-supported-renderer, [class*="badge"], ytd-thumbnail-overlay-time-status-renderer')].map(text);
}

export function parseItem(el) {
  const anchors = [...el.querySelectorAll('a[href]')];
  let id = null;
  let url = null;
  let isShort = false;
  for (const a of anchors) {
    const href = a.getAttribute('href');
    const vid = videoIdFromHref(href);
    if (vid) { id = vid; url = href; isShort = SHORTS_RE.test(href); break; }
  }
  if (!isShort) {
    isShort = Boolean(el.querySelector('ytm-shorts-lockup-view-model, ytd-rich-grid-slim-media, ytd-reel-item-renderer'));
  }

  let title = text(el.querySelector('#video-title, #video-title-link, [id*="video-title"]'));
  if (!title) title = text(el.querySelector('h3, h2'));
  if (!title) {
    const titled = el.querySelector('a[title], [aria-label][href]');
    title = titled ? (titled.getAttribute('title') || '') : '';
  }
  if (!title) {
    let best = '';
    for (const a of anchors) if (videoIdFromHref(a.getAttribute('href')) && text(a).length > best.length) best = text(a);
    title = best;
  }

  let channelName = null;
  let channelId = null;
  const chanAnchor = el.querySelector('ytd-channel-name a[href], a[href^="/@"], a[href^="/channel/"], a[href^="/c/"], a[href^="/user/"]');
  if (chanAnchor) {
    channelId = channelIdFromHref(chanAnchor.getAttribute('href'));
    channelName = text(chanAnchor) || chanAnchor.getAttribute('title') || chanAnchor.getAttribute('aria-label') || null;
  }
  if (!channelName) {
    const nameEl = el.querySelector('ytd-channel-name #text, ytd-channel-name yt-formatted-string, #channel-name');
    if (nameEl) channelName = text(nameEl) || nameEl.getAttribute('title') || null;
  }

  const badges = badgeTexts(el);
  const isAd = Boolean(
    el.querySelector('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-promoted-video-renderer, ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer')
  ) || badges.some((b) => AD_TEXT_RE.test(b));
  const isLive = Boolean(
    el.querySelector('[overlay-style="LIVE"], .badge-style-type-live-now-alternate, .badge-style-type-live-now')
  ) || badges.some((b) => /^live$/i.test(b)) || /\bwatching$/i.test(text(el.querySelector('#metadata-line')));

  return { id, channelId, channelName, title: title || null, isShort, isAd, isLive, url };
}

const REQUIRED_BY_PAGE = {
  home: ['feed', 'items', 'shortsShelf', 'navLinks'],
  subscriptions: ['feed', 'items', 'navLinks'],
  watch: ['recommendedSidebar', 'endScreen', 'autoplayToggle', 'comments', 'subscriberCount'],
  shorts: ['shortsContainer', 'shortsItems'],
  channels: ['navLinks'],
  other: ['navLinks'],
};

const FINDERS = {
  feed: findFeed,
  items: findItems,
  shortsShelf: findShortsShelf,
  recommendedSidebar: findRecommendedSidebar,
  endScreen: findEndScreen,
  autoplayToggle: findAutoplayToggle,
  comments: findComments,
  subscriberCount: findSubscriberCount,
  notificationBadge: findNotificationBadge,
  navLinks: findNavLinks,
  shortsContainer: findShortsContainer,
  shortsItems: findShortsItems,
};

/**
 * Runs the finders that matter for the current page and reports which
 * strategy each one matched with. "none" on a required finder means the
 * layout moved under us.
 */
export function healthCheck(root = globalThis.document, type = pageType()) {
  health = {};
  const required = REQUIRED_BY_PAGE[type] || REQUIRED_BY_PAGE.other;
  const report = { page: type, required: {}, optional: {}, ok: true };
  for (const name of required) {
    FINDERS[name](root);
    report.required[name] = health[name];
    if (health[name] === 'none') report.ok = false;
  }
  for (const name of Object.keys(FINDERS)) {
    if (required.includes(name)) continue;
    FINDERS[name](root);
    report.optional[name] = health[name];
  }
  return report;
}
