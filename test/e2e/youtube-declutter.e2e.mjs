import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchWithExtension, routeOriginToFixture, youtubeFixturesFor, setSettings, yt, probes } from './harness.mjs';

const ORIGIN = 'https://www.youtube.com';
const URLS = { home: '/', subscriptions: '/feed/subscriptions', watch: '/watch?v=dQw4w9WgXcQ', shorts: '/shorts/dQw4w9WgXcQ' };

async function open(context, type, fixtureRel, { waitReady = true } = {}) {
  const page = await context.newPage();
  await routeOriginToFixture(page, ORIGIN, fixtureRel);
  await page.goto(ORIGIN + URLS[type], { waitUntil: 'domcontentloaded' });
  if (waitReady) await page.waitForSelector('html[data-feedoverlay="ready"]', { timeout: 10_000 });
  await page.evaluate(probes);
  return page;
}

async function first(type) {
  const files = await youtubeFixturesFor(type);
  assert.ok(files.length, `need a ${type} fixture`);
  return files;
}

test('home: defaults redirect to subscriptions before the overlay marks ready', async () => {
  const context = await launchWithExtension();
  try {
    await setSettings(context, yt({}));
    const [f] = await first('home');
    const page = await context.newPage();
    await routeOriginToFixture(page, ORIGIN, f);
    await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/feed/subscriptions', { timeout: 10_000 });
    await page.waitForSelector('html[data-feedoverlay="ready"]', { timeout: 10_000 });
    assert.equal(new URL(page.url()).pathname, '/feed/subscriptions');
  } finally { await context.close(); }
});

test('shorts: defaults redirect to the regular player', async () => {
  const context = await launchWithExtension();
  try {
    await setSettings(context, yt({}));
    const [f] = await first('shorts');
    const page = await context.newPage();
    await routeOriginToFixture(page, ORIGIN, f);
    await page.goto(ORIGIN + URLS.shorts, { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/watch?v=dQw4w9WgXcQ', { timeout: 10_000 });
  } finally { await context.close(); }
});

test('home with redirect off: feed, shorts shelf, nav extras and badge hidden', async () => {
  const context = await launchWithExtension();
  try {
    await setSettings(context, yt({ redirectHomeToSubscriptions: false }));
    for (const f of await first('home')) {
      const page = await open(context, 'home', f);
      const r = await page.evaluate(() => ({
        feedHidden: __hid(__q('ytd-rich-grid-renderer #contents')),
        shelfHidden: __hid(__q('ytd-rich-shelf-renderer[is-shorts]')),
        trendingHidden: __hid(__q('a[href="/feed/trending"]')),
        exploreHidden: __hid(__q('a[href="/feed/explore"]')),
        shortsNavHidden: __hid(__q('a[href="/shorts"]')),
        subsNavVisible: __vis(__q('a[href="/feed/subscriptions"]')),
        badgeHidden: __hid(__q('ytd-notification-topbar-button-renderer .yt-spec-icon-badge-shape__badge')),
        extrasButton: Boolean(__q('#feedoverlay-extras button')),
        page: document.documentElement.dataset.feedoverlayPage,
      }));
      assert.equal(r.page, 'home', f);
      assert.ok(r.feedHidden, `${f}: home feed hidden`);
      assert.ok(r.shelfHidden, `${f}: shorts shelf hidden`);
      assert.ok(r.trendingHidden && r.exploreHidden, `${f}: trending/explore hidden`);
      assert.ok(r.shortsNavHidden, `${f}: shorts nav hidden`);
      assert.ok(r.subsNavVisible, `${f}: subscriptions nav still visible`);
      assert.ok(r.badgeHidden, `${f}: notification badge hidden`);
      assert.ok(r.extrasButton, `${f}: extras button mounted`);
      await page.close();
    }
  } finally { await context.close(); }
});

test('subscriptions with defaults: items visible, shorts and metrics hidden, titles and channels visible', async () => {
  const context = await launchWithExtension();
  try {
    await setSettings(context, yt({}));
    for (const f of await first('subscriptions')) {
      const page = await open(context, 'subscriptions', f);
      const r = await page.evaluate(() => {
        const items = __qa('ytd-rich-item-renderer');
        const shorts = items.filter((i) => i.querySelector('a[href^="/shorts/"]'));
        const normal = items.filter((i) => !i.querySelector('a[href^="/shorts/"]'));
        const metricSpans = __qa('#metadata-line .inline-metadata-item').filter((s) => /views|watching/.test(s.textContent));
        const agoSpans = __qa('#metadata-line .inline-metadata-item').filter((s) => /ago/.test(s.textContent));
        return {
          feedVisible: __vis(__q('ytd-rich-grid-renderer #contents')),
          shortsCount: shorts.length,
          shortsHidden: shorts.every(__hid),
          normalCount: normal.length,
          normalVisible: normal.every(__vis),
          titlesVisible: normal.every((i) => __vis(i.querySelector('#video-title, h3'))),
          channelsVisible: normal.every((i) => __vis(i.querySelector('a[href^="/@"]'))),
          metricCount: metricSpans.length,
          metricsHidden: metricSpans.every(__hid),
          agoVisible: agoSpans.filter((s) => !s.closest('[data-feedoverlay-hidden]')).every(__vis),
        };
      });
      assert.ok(r.feedVisible, `${f}: feed visible on subscriptions`);
      assert.ok(r.shortsCount >= 1 && r.shortsHidden, `${f}: shorts items hidden (${r.shortsCount})`);
      assert.ok(r.normalCount >= 12 && r.normalVisible, `${f}: normal items visible (${r.normalCount})`);
      assert.ok(r.titlesVisible, `${f}: titles visible`);
      assert.ok(r.channelsVisible, `${f}: channel names visible`);
      assert.ok(r.metricCount >= 12 && r.metricsHidden, `${f}: metrics hidden (${r.metricCount})`);
      assert.ok(r.agoVisible, `${f}: time-ago text untouched`);
      await page.close();
    }
  } finally { await context.close(); }
});

test('watch with defaults: sidebar, end screen, reel shelf, metrics hidden; autoplay off; comments visible', async () => {
  const context = await launchWithExtension();
  try {
    await setSettings(context, yt({}));
    for (const f of await first('watch')) {
      const page = await open(context, 'watch', f);
      const r = await page.evaluate(() => ({
        sidebarHidden: __hid(__q('ytd-watch-next-secondary-results-renderer')),
        endScreenHidden: __hid(__q('.ytp-endscreen-content')),
        reelHidden: !__q('ytd-reel-shelf-renderer') || __hid(__q('ytd-reel-shelf-renderer')),
        autoplayChecked: __q('.ytp-autonav-toggle-button').getAttribute('aria-checked'),
        autoplayState: document.documentElement.dataset.feedoverlayAutoplay,
        commentsVisible: __vis(__q('ytd-comments')),
        subCountHidden: __hid(__q('#owner-sub-count')),
        viewsHidden: __qa('ytd-watch-metadata #info span').filter((s) => /views/.test(s.textContent)).every(__hid),
        likesHidden: __hid(__q('like-button-view-model .yt-spec-button-shape-next__button-text-content')),
        titleVisible: __vis(__q('ytd-watch-metadata h1')),
        channelVisible: __vis(__q('ytd-video-owner-renderer ytd-channel-name a')),
        synthetic: /synthetic/.test(document.documentElement.getAttribute('data-feedoverlay-capture') || ''),
      }));
      assert.ok(r.sidebarHidden, `${f}: sidebar hidden`);
      assert.ok(r.endScreenHidden, `${f}: end screen hidden`);
      assert.ok(r.reelHidden, `${f}: reel shelf hidden`);
      assert.ok(['off', 'clicked'].includes(r.autoplayState), `${f}: autoplay handled (${r.autoplayState})`);
      if (r.synthetic) assert.equal(r.autoplayChecked, 'false', `${f}: autoplay toggled off`);
      assert.ok(r.commentsVisible, `${f}: comments visible by default`);
      assert.ok(r.subCountHidden, `${f}: subscriber count hidden`);
      assert.ok(r.viewsHidden, `${f}: view count hidden`);
      assert.ok(r.likesHidden, `${f}: like count hidden`);
      assert.ok(r.titleVisible && r.channelVisible, `${f}: title and channel visible`);
      await page.close();
    }
  } finally { await context.close(); }
});

test('extras button reveals everything; SPA navigation hides it again', async () => {
  const context = await launchWithExtension();
  try {
    await setSettings(context, yt({}));
    const [f] = await first('subscriptions');
    const page = await open(context, 'subscriptions', f);
    const shelf = 'ytd-rich-shelf-renderer[is-shorts]';
    assert.ok(await page.evaluate((s) => __hid(__q(s)), shelf), 'shelf hidden before');
    await page.click('#feedoverlay-extras button');
    assert.ok(await page.evaluate((s) => __vis(__q(s)), shelf), 'shelf visible after click');
    assert.equal(await page.textContent('#feedoverlay-extras button'), 'Hide extras again');
    await page.evaluate(() => {
      history.pushState({}, '', '/feed/subscriptions?flow=1');
      document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    assert.ok(await page.evaluate((s) => __hid(__q(s)), shelf), 'shelf hidden after navigation');
    assert.equal(await page.textContent('#feedoverlay-extras button'), "Show YouTube's extras");
  } finally { await context.close(); }
});

const TOGGLE_CASES = [
  { patch: { hideHomeFeed: false, redirectHomeToSubscriptions: false }, type: 'home', visible: 'ytd-rich-grid-renderer #contents' },
  { patch: { hideShorts: false }, type: 'subscriptions', visible: 'ytd-rich-shelf-renderer[is-shorts]' },
  { patch: { hideShorts: false }, type: 'subscriptions', visible: 'a[href="/shorts"]' },
  { patch: { hideRecommendedSidebar: false }, type: 'watch', visible: 'ytd-watch-next-secondary-results-renderer' },
  { patch: { hideEndScreens: false }, type: 'watch', visible: '.ytp-endscreen-content' },
  { patch: { hideMetrics: false }, type: 'subscriptions', visible: '#metadata-line .inline-metadata-item' },
  { patch: { hideMetrics: false }, type: 'watch', visible: 'like-button-view-model .yt-spec-button-shape-next__button-text-content' },
  { patch: { hideSubscriberCounts: false }, type: 'watch', visible: '#owner-sub-count' },
  { patch: { hideNotificationCount: false }, type: 'subscriptions', visible: 'ytd-notification-topbar-button-renderer .yt-spec-icon-badge-shape__badge' },
  { patch: { hideTrendingExplore: false }, type: 'subscriptions', visible: 'a[href="/feed/trending"]' },
  { patch: { hideComments: true }, type: 'watch', hidden: 'ytd-comments' },
  { patch: { enabled: false }, type: 'watch', visible: 'ytd-watch-next-secondary-results-renderer', noExtras: true },
];

test('each toggle off leaves its element visible (and hideComments on hides comments)', async () => {
  const context = await launchWithExtension();
  try {
    for (const c of TOGGLE_CASES) {
      await setSettings(context, yt(c.patch));
      const [f] = await first(c.type);
      const page = await open(context, c.type, f);
      const r = await page.evaluate(({ visible, hidden }) => ({
        visible: visible ? __vis(__q(visible)) : null,
        hidden: hidden ? __hid(__q(hidden)) : null,
        extras: Boolean(__q('#feedoverlay-extras')),
        checked: __q('.ytp-autonav-toggle-button') ? __q('.ytp-autonav-toggle-button').getAttribute('aria-checked') : null,
      }), c);
      const label = JSON.stringify(c.patch);
      if (c.visible) assert.ok(r.visible, `${label}: ${c.visible} visible`);
      if (c.hidden) assert.ok(r.hidden, `${label}: ${c.hidden} hidden`);
      if (c.noExtras) assert.equal(r.extras, false, `${label}: no extras button`);
      await page.close();
    }
    // disableAutoplay off leaves the toggle alone
    await setSettings(context, yt({ disableAutoplay: false }));
    const [w] = await first('watch');
    const page = await open(context, 'watch', w);
    assert.equal(await page.getAttribute('.ytp-autonav-toggle-button', 'aria-checked'), 'true');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.feedoverlayAutoplay || null), null);
  } finally { await context.close(); }
});

test('toggle flipped in storage applies live without reload', async () => {
  const context = await launchWithExtension();
  try {
    await setSettings(context, yt({}));
    const [f] = await first('subscriptions');
    const page = await open(context, 'subscriptions', f);
    await page.evaluate(() => { window.__marker = 42; });
    const sel = '#metadata-line .inline-metadata-item';
    assert.ok(await page.evaluate((s) => __qa(s).filter((e) => /views/.test(e.textContent)).every(__hid), sel), 'metrics hidden before');
    await setSettings(context, yt({ hideMetrics: false }));
    await page.waitForFunction((s) => __qa(s).filter((e) => /views/.test(e.textContent)).every(__vis), sel, { timeout: 5_000 });
    assert.equal(await page.evaluate(() => window.__marker), 42, 'no reload happened');
    await setSettings(context, yt({ hideMetrics: true }));
    await page.waitForFunction((s) => __qa(s).filter((e) => /views/.test(e.textContent)).every(__hid), sel, { timeout: 5_000 });
  } finally { await context.close(); }
});

test('50 items appended in one tick are processed within two frames', async () => {
  const context = await launchWithExtension();
  try {
    await setSettings(context, yt({}));
    const [f] = await first('subscriptions');
    const page = await open(context, 'subscriptions', f);
    const r = await page.evaluate(async () => {
      const contents = __q('ytd-rich-grid-renderer #contents');
      const items = __qa('ytd-rich-item-renderer', contents);
      const normal = items.find((i) => !i.querySelector('a[href^="/shorts/"]') && !i.hasAttribute('data-feedoverlay-hidden'));
      const short = items.find((i) => i.querySelector('a[href^="/shorts/"]'));
      const added = [];
      for (let i = 0; i < 50; i++) {
        const src = i % 5 === 0 ? short : normal;
        const clone = src.cloneNode(true);
        for (const el of clone.querySelectorAll('[data-feedoverlay-hidden]')) el.removeAttribute('data-feedoverlay-hidden');
        clone.removeAttribute('data-feedoverlay-hidden');
        clone.dataset.burst = String(i);
        contents.appendChild(clone);
        added.push(clone);
      }
      await __twoFrames();
      const shorts = added.filter((c) => c.querySelector('a[href^="/shorts/"]'));
      const normals = added.filter((c) => !c.querySelector('a[href^="/shorts/"]'));
      const metricSpans = normals.flatMap((c) => __qa('#metadata-line .inline-metadata-item', c).filter((s) => /views|watching/.test(s.textContent)));
      return {
        shorts: shorts.length,
        shortsHidden: shorts.every(__hid),
        normals: normals.length,
        normalsVisible: normals.every(__vis),
        metrics: metricSpans.length,
        metricsHidden: metricSpans.every(__hid),
      };
    });
    assert.equal(r.shorts, 10);
    assert.ok(r.shortsHidden, 'appended shorts hidden');
    assert.equal(r.normals, 40);
    assert.ok(r.normalsVisible, 'appended normal items visible');
    assert.ok(r.metrics >= 40 && r.metricsHidden, `appended metrics hidden (${r.metrics})`);
  } finally { await context.close(); }
});
