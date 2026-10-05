// Generates synthetic, already-scrubbed fixtures for the four YouTube page
// types from YouTube's known element structure. Used until real captures from
// tools/capture.js exist, and kept afterwards as a stable baseline.
//
// Usage: node tools/make-synthetic-fixtures.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'youtube');
const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

let seed = 7;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
const WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipisci', 'elit', 'sed', 'tempor', 'incidunt', 'labore', 'magna', 'aliqua', 'veniam', 'quis', 'nostrud', 'ullamco', 'nisi', 'commodo'];
function words(n) { return Array.from({ length: n }, () => WORDS[Math.floor(rnd() * WORDS.length)]).join(' '); }
function title() { const t = words(4 + Math.floor(rnd() * 6)); return t[0].toUpperCase() + t.slice(1); }
const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
function vid() { return Array.from({ length: 11 }, () => ALPHA[Math.floor(rnd() * ALPHA.length)]).join(''); }
function views() { const n = [12, 48, 120, 530, 1.2, 3.4, 8.9][Math.floor(rnd() * 7)]; return (n < 10 ? n + 'M' : n + 'K') + ' views'; }
function ago() { const u = ['hours', 'days', 'weeks', 'months'][Math.floor(rnd() * 4)]; return (1 + Math.floor(rnd() * 11)) + ' ' + u + ' ago'; }
function dur() { return (1 + Math.floor(rnd() * 40)) + ':' + String(Math.floor(rnd() * 60)).padStart(2, '0'); }

const CHANNELS = Array.from({ length: 10 }, (_, i) => ({ handle: '@channel' + (1000 + i), name: 'Channel ' + words(1) + ' ' + (i + 1) }));
function chan() { return CHANNELS[Math.floor(rnd() * CHANNELS.length)]; }

function masthead(badge = true) {
  return `
<div id="masthead-container"><ytd-masthead id="masthead" role="banner">
  <div id="container"><div id="start"><a id="logo" href="/">YouTube</a></div>
  <div id="center"><ytd-searchbox><form><input name="search_query" placeholder="Search"></form></ytd-searchbox></div>
  <div id="end"><div id="buttons">
    <ytd-notification-topbar-button-renderer><button aria-label="Notifications"><yt-icon-badge-shape>${badge ? '<div class="yt-spec-icon-badge-shape__badge">3</div>' : ''}</yt-icon-badge-shape></button></ytd-notification-topbar-button-renderer>
  </div></div></div>
</ytd-masthead></div>`;
}

function guide() {
  return `
<tp-yt-app-drawer id="guide"><ytd-guide-renderer><div id="sections">
  <ytd-guide-section-renderer><div id="items">
    <ytd-guide-entry-renderer><a href="/" title="Home"><yt-formatted-string>Home</yt-formatted-string></a></ytd-guide-entry-renderer>
    <ytd-guide-entry-renderer><a href="/shorts" title="Shorts"><yt-formatted-string>Shorts</yt-formatted-string></a></ytd-guide-entry-renderer>
    <ytd-guide-entry-renderer><a href="/feed/subscriptions" title="Subscriptions"><yt-formatted-string>Subscriptions</yt-formatted-string></a></ytd-guide-entry-renderer>
  </div></ytd-guide-section-renderer>
  <ytd-guide-section-renderer><div id="items">
    <ytd-guide-entry-renderer><a href="/feed/trending" title="Trending"><yt-formatted-string>Trending</yt-formatted-string></a></ytd-guide-entry-renderer>
    <ytd-guide-entry-renderer><a href="/feed/explore" title="Explore"><yt-formatted-string>Explore</yt-formatted-string></a></ytd-guide-entry-renderer>
  </div></ytd-guide-section-renderer>
</div></ytd-guide-renderer></tp-yt-app-drawer>`;
}

function richItem({ live = false, ad = false, lockup = false } = {}) {
  const id = vid(); const c = chan(); const t = title();
  if (ad) {
    return `
<ytd-rich-item-renderer><div id="content"><ytd-ad-slot-renderer><ytd-in-feed-ad-layout-renderer><div id="dismissible">
  <ytd-thumbnail><a id="thumbnail" href="/watch?v=${id}"><yt-image><img src="${GIF}" alt=""></yt-image></a></ytd-thumbnail>
  <div id="details"><h3><a id="video-title-link" href="/watch?v=${id}" title="${t}"><yt-formatted-string id="video-title">${t}</yt-formatted-string></a></h3>
  <ytd-channel-name id="channel-name"><div id="container"><div id="text-container"><yt-formatted-string id="text"><a href="/${c.handle}">${c.name}</a></yt-formatted-string></div></div></ytd-channel-name>
  <ytd-badge-supported-renderer><div class="badge badge-style-type-ad"><span>Sponsored</span></div></ytd-badge-supported-renderer></div>
</div></ytd-in-feed-ad-layout-renderer></ytd-ad-slot-renderer></div></ytd-rich-item-renderer>`;
  }
  if (lockup) {
    return `
<ytd-rich-item-renderer><div id="content"><yt-lockup-view-model class="ytLockupViewModelHost"><div class="yt-lockup-view-model-wiz">
  <a class="yt-lockup-view-model-wiz__content-image" href="/watch?v=${id}"><yt-thumbnail-view-model><img src="${GIF}" alt=""><yt-thumbnail-overlay-badge-view-model><div class="yt-badge-shape">${dur()}</div></yt-thumbnail-overlay-badge-view-model></yt-thumbnail-view-model></a>
  <div class="yt-lockup-metadata-view-model-wiz"><h3 class="yt-lockup-metadata-view-model-wiz__heading"><a class="yt-lockup-metadata-view-model-wiz__title" href="/watch?v=${id}" aria-label="${t} by ${c.name} ${ago()} ${views()}"><span class="yt-core-attributed-string" role="text">${t}</span></a></h3>
  <yt-content-metadata-view-model><div class="yt-content-metadata-view-model-wiz__metadata-row"><span class="yt-core-attributed-string"><a href="/${c.handle}">${c.name}</a></span></div>
  <div class="yt-content-metadata-view-model-wiz__metadata-row"><span class="yt-core-attributed-string">${views()}</span><span class="yt-core-attributed-string">${ago()}</span></div></yt-content-metadata-view-model></div>
</div></yt-lockup-view-model></div></ytd-rich-item-renderer>`;
  }
  const overlay = live
    ? `<ytd-thumbnail-overlay-time-status-renderer overlay-style="LIVE"><span id="text">LIVE</span></ytd-thumbnail-overlay-time-status-renderer>`
    : `<ytd-thumbnail-overlay-time-status-renderer overlay-style="DEFAULT"><span id="text">${dur()}</span></ytd-thumbnail-overlay-time-status-renderer>`;
  const meta = live
    ? `<span class="inline-metadata-item">4.1K watching</span>`
    : `<span class="inline-metadata-item">${views()}</span><span class="inline-metadata-item">${ago()}</span>`;
  const badge = live ? `<ytd-badge-supported-renderer><div class="badge badge-style-type-live-now-alternate"><span>LIVE</span></div></ytd-badge-supported-renderer>` : '';
  return `
<ytd-rich-item-renderer><div id="content"><ytd-rich-grid-media><div id="dismissible">
  <ytd-thumbnail><a id="thumbnail" href="/watch?v=${id}"><yt-image><img src="${GIF}" alt=""></yt-image><div id="overlays">${overlay}</div></a></ytd-thumbnail>
  <div id="details"><div id="meta"><h3><a id="video-title-link" href="/watch?v=${id}" title="${t}"><yt-formatted-string id="video-title">${t}</yt-formatted-string></a></h3>
    <ytd-video-meta-block><div id="metadata"><div id="byline-container"><ytd-channel-name id="channel-name"><div id="container"><div id="text-container"><yt-formatted-string id="text"><a href="/${c.handle}">${c.name}</a></yt-formatted-string></div></div></ytd-channel-name>${badge}</div>
    <div id="metadata-line">${meta}</div></div></ytd-video-meta-block></div></div>
</div></ytd-rich-grid-media></div></ytd-rich-item-renderer>`;
}

function shortsItem() {
  const id = vid(); const t = title();
  return `
<ytd-rich-item-renderer items-per-row="6"><div id="content"><ytm-shorts-lockup-view-model class="shortsLockupViewModelHost">
  <a href="/shorts/${id}" class="shortsLockupViewModelHostEndpoint"><img src="${GIF}" alt=""></a>
  <h3><a href="/shorts/${id}" title="${t}"><span>${t}</span></a></h3><div class="shortsLockupViewModelHostOutsideMetadataSubhead">${views()}</div>
</ytm-shorts-lockup-view-model></div></ytd-rich-item-renderer>`;
}

function shortsShelf() {
  return `
<ytd-rich-section-renderer><div id="content"><ytd-rich-shelf-renderer is-shorts><div id="dismissible">
  <div id="title-container"><h2 id="title">Shorts</h2></div>
  <div id="contents">${Array.from({ length: 6 }, shortsItem).join('')}</div>
</div></ytd-rich-shelf-renderer></div></ytd-rich-section-renderer>`;
}

function browsePage(subtype, items) {
  return `<!doctype html>
<html lang="en" data-feedoverlay-capture="synthetic ${subtype}">
<head><meta charset="utf-8"><title>YouTube</title></head>
<body>
<ytd-app>${masthead()}
<div id="content">${guide()}
<ytd-page-manager id="page-manager">
<ytd-browse page-subtype="${subtype}" role="main">
<ytd-two-column-browse-results-renderer><div id="primary">
<ytd-rich-grid-renderer><div id="contents">
${items}
</div></ytd-rich-grid-renderer>
</div></ytd-two-column-browse-results-renderer>
</ytd-browse>
</ytd-page-manager>
</div></ytd-app>
</body></html>`;
}

function compactItem() {
  const id = vid(); const c = chan(); const t = title();
  return `
<ytd-compact-video-renderer><div id="dismissible">
  <ytd-thumbnail><a id="thumbnail" href="/watch?v=${id}"><yt-image><img src="${GIF}" alt=""></yt-image><div id="overlays"><ytd-thumbnail-overlay-time-status-renderer overlay-style="DEFAULT"><span id="text">${dur()}</span></ytd-thumbnail-overlay-time-status-renderer></div></a></ytd-thumbnail>
  <div class="details"><div class="metadata"><a href="/watch?v=${id}"><h3><span id="video-title" title="${t}">${t}</span></h3>
  <ytd-video-meta-block><div id="metadata"><div id="byline-container"><ytd-channel-name id="channel-name"><div id="container"><div id="text-container"><yt-formatted-string id="text" title="${c.name}">${c.name}</yt-formatted-string></div></div></ytd-channel-name></div>
  <div id="metadata-line"><span class="inline-metadata-item">${views()}</span><span class="inline-metadata-item">${ago()}</span></div></div></ytd-video-meta-block></a></div></div>
</div></ytd-compact-video-renderer>`;
}

function watchPage() {
  const id = vid(); const c = chan(); const t = title();
  const stills = Array.from({ length: 8 }, () => `<a class="ytp-videowall-still" href="/watch?v=${vid()}"><span class="ytp-videowall-still-info-title">${title()}</span></a>`).join('');
  const reel = `<ytd-reel-shelf-renderer><div id="dismissible"><div id="title-container"><h2 id="title">Shorts</h2></div><div id="items">${Array.from({ length: 4 }, () => { const s = vid(); const st = title(); return `<ytm-shorts-lockup-view-model><a href="/shorts/${s}"><img src="${GIF}" alt=""></a><h3><a href="/shorts/${s}" title="${st}"><span>${st}</span></a></h3><div>${views()}</div></ytm-shorts-lockup-view-model>`; }).join('')}</div></div></ytd-reel-shelf-renderer>`;
  const comments = Array.from({ length: 3 }, () => `<ytd-comment-thread-renderer><ytd-comment-view-model><div id="body"><a id="author-text" href="/${chan().handle}"><span>${chan().handle}</span></a><yt-attributed-string id="content-text"><span>${words(12)}</span></yt-attributed-string></div></ytd-comment-view-model></ytd-comment-thread-renderer>`).join('');
  return `<!doctype html>
<html lang="en" data-feedoverlay-capture="synthetic watch">
<head><meta charset="utf-8"><title>YouTube</title></head>
<body>
<ytd-app>${masthead()}
<div id="content">
<ytd-page-manager id="page-manager">
<ytd-watch-flexy role="main" video-id="${id}">
<div id="columns">
<div id="primary"><div id="primary-inner">
  <div id="player"><ytd-player><div id="container"><div id="movie_player" class="html5-video-player">
    <div class="html5-video-container"></div>
    <div class="ytp-chrome-bottom"><div class="ytp-right-controls">
      <button class="ytp-button" data-tooltip-target-id="ytp-autonav-toggle-button"><div class="ytp-autonav-toggle-button-container"><div class="ytp-autonav-toggle-button" role="checkbox" aria-checked="true" aria-label="Autoplay is on"></div></div></button>
    </div></div>
    <div class="ytp-endscreen-content">${stills}</div>
    <div class="ytp-ce-element ytp-ce-video"><a href="/watch?v=${vid()}">${title()}</a></div>
  </div></div></ytd-player></div>
  <div id="below">
    <ytd-watch-metadata>
      <h1><yt-formatted-string>${t}</yt-formatted-string></h1>
      <div id="top-row">
        <ytd-video-owner-renderer><a href="/${c.handle}" id="avatar"><img src="${GIF}" alt=""></a>
          <div id="upload-info"><ytd-channel-name id="channel-name"><div id="container"><div id="text-container"><yt-formatted-string id="text"><a href="/${c.handle}">${c.name}</a></yt-formatted-string></div></div></ytd-channel-name>
          <yt-formatted-string id="owner-sub-count">1.5M subscribers</yt-formatted-string></div>
          <div id="subscribe-button"><button aria-label="Subscribe to ${c.name}">Subscribe</button></div>
        </ytd-video-owner-renderer>
        <div id="actions"><segmented-like-dislike-button-view-model><like-button-view-model><button aria-label="like this video along with 12,345 other people"><div class="yt-spec-button-shape-next__button-text-content">12K</div></button></like-button-view-model></segmented-like-dislike-button-view-model></div>
      </div>
      <div id="bottom-row"><div id="description"><div id="info"><span>1,234,567 views</span><span>${ago()}</span></div><div id="description-inline-expander"><span>${words(30)}</span></div></div></div>
    </ytd-watch-metadata>
    <ytd-comments id="comments"><ytd-item-section-renderer section-identifier="comment-item-section">
      <div id="header"><ytd-comments-header-renderer><h2 id="count"><yt-formatted-string>842 Comments</yt-formatted-string></h2></ytd-comments-header-renderer></div>
      <div id="contents">${comments}</div>
    </ytd-item-section-renderer></ytd-comments>
  </div>
</div></div>
<div id="secondary"><div id="secondary-inner"><div id="related">
  <ytd-watch-next-secondary-results-renderer><div id="items">
    ${reel}
    ${Array.from({ length: 12 }, compactItem).join('')}
  </div></ytd-watch-next-secondary-results-renderer>
</div></div></div>
</div>
</ytd-watch-flexy>
</ytd-page-manager>
</div></ytd-app>
<script>
// Synthetic only: mimic YouTube's player flipping the autoplay toggle on click.
document.querySelector('.ytp-autonav-toggle-button').closest('button').addEventListener('click', function () {
  var t = this.querySelector('.ytp-autonav-toggle-button');
  var on = t.getAttribute('aria-checked') === 'true';
  t.setAttribute('aria-checked', on ? 'false' : 'true');
  t.setAttribute('aria-label', on ? 'Autoplay is off' : 'Autoplay is on');
});
</script>
</body></html>`;
}

function shortsPage() {
  const reels = Array.from({ length: 3 }, (_, i) => {
    const c = chan(); const t = title();
    return `
<ytd-reel-video-renderer id="${i}" ${i === 0 ? 'is-active' : ''}><div id="player-container"><div class="html5-video-player"></div></div>
  <div id="overlay"><ytd-reel-player-overlay-renderer>
    <div id="metapanel"><yt-reel-metapanel-view-model>
      <yt-reel-channel-bar-view-model><a href="/${c.handle}"><span>${c.handle}</span></a><button>Subscribe</button></yt-reel-channel-bar-view-model>
      <yt-shorts-video-title-view-model><h2><span>${t}</span></h2></yt-shorts-video-title-view-model>
    </yt-reel-metapanel-view-model></div>
    <div id="actions"><ytd-like-button-renderer><yt-formatted-string id="text" aria-label="12K likes">12K</yt-formatted-string></ytd-like-button-renderer></div>
  </ytd-reel-player-overlay-renderer></div>
</ytd-reel-video-renderer>`;
  }).join('');
  return `<!doctype html>
<html lang="en" data-feedoverlay-capture="synthetic shorts">
<head><meta charset="utf-8"><title>YouTube</title></head>
<body>
<ytd-app>${masthead(false)}
<div id="content">${guide()}
<ytd-page-manager id="page-manager">
<ytd-shorts role="main"><div id="shorts-container"><div id="shorts-inner-container">${reels}</div></div></ytd-shorts>
</ytd-page-manager>
</div></ytd-app>
</body></html>`;
}

await mkdir(out, { recursive: true });

const homeItems = [
  richItem(), richItem(), richItem({ lockup: true }), richItem(),
  shortsShelf(),
  richItem({ live: true }), richItem(), richItem({ ad: true }), richItem({ lockup: true }),
  richItem(), richItem(), richItem(), richItem(), richItem(),
].join('');
await writeFile(path.join(out, 'home-synthetic.html'), browsePage('home', homeItems));

const subsItems = [
  richItem(), richItem(), richItem(), richItem({ live: true }), richItem(), richItem({ lockup: true }),
  shortsShelf(),
  richItem(), richItem(), richItem(), richItem(), richItem(), richItem(), richItem(),
].join('');
await writeFile(path.join(out, 'subscriptions-synthetic.html'), browsePage('subscriptions', subsItems));

await writeFile(path.join(out, 'watch-synthetic.html'), watchPage());
await writeFile(path.join(out, 'shorts-synthetic.html'), shortsPage());
console.log('wrote 4 synthetic fixtures to', out);
