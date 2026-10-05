import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { launchWithExtension, routeOriginToFixture, bundleForPage, youtubeFixturesFor, fixtures } from './harness.mjs';

const ORIGIN = 'https://www.youtube.com';
const URLS = {
  home: '/',
  subscriptions: '/feed/subscriptions',
  watch: '/watch?v=dQw4w9WgXcQ',
  shorts: '/shorts/dQw4w9WgXcQ',
};

let selectorsBundle;
before(async () => {
  selectorsBundle = await bundleForPage('lib/selectors/youtube.js', 'YTSel');
});

async function openFixture(context, type, fixtureRel) {
  const page = await context.newPage();
  await routeOriginToFixture(page, ORIGIN, fixtureRel);
  await page.goto(ORIGIN + URLS[type], { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('html[data-feedoverlay="ready"]', { timeout: 10_000 });
  await page.addScriptTag({ content: selectorsBundle });
  return page;
}

function feedProbe() {
  const feed = YTSel.findFeed(document);
  const items = YTSel.findItems(document) || [];
  const parsed = items.map((el) => YTSel.parseItem(el));
  return {
    hasFeed: Boolean(feed),
    count: items.length,
    parsed,
    shelf: Boolean(YTSel.findShortsShelf(document)),
    metricsCount: items.reduce((n, el) => n + YTSel.findMetrics(el).length, 0),
    health: YTSel.healthCheck(document),
  };
}

for (const type of ['home', 'subscriptions']) {
  test(`${type} fixtures: feed, items, parse, shelf, health`, async () => {
    const files = await youtubeFixturesFor(type);
    assert.ok(files.length >= 1, `need at least one ${type}-*.html fixture`);
    const context = await launchWithExtension();
    try {
      for (const f of files) {
        const page = await openFixture(context, type, f);
        const r = await page.evaluate(feedProbe);
        assert.ok(r.hasFeed, `${f}: feed container`);
        assert.ok(r.count >= 12, `${f}: expected >= 12 items, got ${r.count}`);
        for (const p of r.parsed) {
          assert.ok(p.id, `${f}: item without id: ${JSON.stringify(p)}`);
          assert.ok(p.title, `${f}: item without title: ${JSON.stringify(p)}`);
          if (!p.isShort) assert.ok(p.channelName, `${f}: non-short item without channel: ${JSON.stringify(p)}`);
        }
        const ids = new Set(r.parsed.map((p) => p.id));
        assert.equal(ids.size, r.parsed.length, `${f}: duplicate item ids`);
        assert.ok(r.parsed.some((p) => p.isShort), `${f}: expected some shorts items`);
        assert.ok(r.parsed.some((p) => p.isLive), `${f}: expected a live item`);
        if (type === 'home') {
          assert.ok(r.shelf, `${f}: shorts shelf`);
          assert.ok(r.parsed.some((p) => p.isAd), `${f}: expected an ad item flagged`);
        }
        assert.ok(r.metricsCount >= 12, `${f}: metrics found in items (${r.metricsCount})`);
        assert.equal(r.health.page, type);
        assert.ok(r.health.ok, `${f}: health ${JSON.stringify(r.health)}`);
        for (const [k, v] of Object.entries(r.health.required)) assert.notEqual(v, 'none', `${f}: ${k} = none`);
        const fromContentScript = JSON.parse(await page.getAttribute('html', 'data-feedoverlay-health'));
        assert.equal(fromContentScript.ok, true, `${f}: content script health`);
        await page.close();
      }
    } finally {
      await context.close();
    }
  });
}

test('watch fixtures: sidebar, end screen, autoplay, comments, metrics, health', async () => {
  const files = await youtubeFixturesFor('watch');
  assert.ok(files.length >= 1);
  const context = await launchWithExtension();
  try {
    for (const f of files) {
      const page = await openFixture(context, 'watch', f);
      const r = await page.evaluate(() => {
        const side = YTSel.findRecommendedSidebar(document);
        return {
          sidebar: Boolean(side),
          sidebarItems: side ? (YTSel.findItems(side) || []).length : 0,
          endScreen: Boolean(YTSel.findEndScreen(document)),
          autoplay: (() => { const t = YTSel.findAutoplayToggle(document); return t ? t.getAttribute('aria-checked') : null; })(),
          comments: Boolean(YTSel.findComments(document)),
          subCount: (() => { const s = YTSel.findSubscriberCount(document); return s ? s.textContent.trim() : null; })(),
          metrics: YTSel.findMetrics(document.querySelector('ytd-watch-metadata')).map((e) => e.textContent.trim()),
          health: YTSel.healthCheck(document),
        };
      });
      assert.ok(r.sidebar, `${f}: recommended sidebar`);
      assert.ok(r.endScreen, `${f}: end screen`);
      assert.equal(r.autoplay, 'true', `${f}: autoplay toggle readable`);
      assert.ok(r.comments, `${f}: comments`);
      assert.match(r.subCount || '', /subscribers/i, `${f}: subscriber count`);
      assert.ok(r.metrics.some((m) => /views/.test(m)), `${f}: view count metric ${JSON.stringify(r.metrics)}`);
      assert.ok(r.health.ok, `${f}: health ${JSON.stringify(r.health)}`);
      await page.close();
    }
  } finally {
    await context.close();
  }
});

test('shorts fixtures: container and reel items, health', async () => {
  const files = await youtubeFixturesFor('shorts');
  assert.ok(files.length >= 1);
  const context = await launchWithExtension();
  try {
    for (const f of files) {
      const page = await openFixture(context, 'shorts', f);
      const r = await page.evaluate(() => ({
        container: Boolean(YTSel.findShortsContainer(document)),
        items: (YTSel.findShortsItems(document) || []).length,
        health: YTSel.healthCheck(document),
      }));
      assert.ok(r.container, `${f}: shorts container`);
      assert.ok(r.items >= 1, `${f}: reel items`);
      assert.ok(r.health.ok, `${f}: health ${JSON.stringify(r.health)}`);
      await page.close();
    }
  } finally {
    await context.close();
  }
});

test('mangled home fixture: items and feed still found via structural fallback', async () => {
  const [first] = await youtubeFixturesFor('home');
  const src = await readFile(path.join(fixtures, first), 'utf8');
  const mangled = src
    .replace(/ytd-rich-item-renderer/g, 'ytd-zzz-renderer')
    .replace(/ytd-rich-grid-renderer/g, 'ytd-yyy-renderer')
    .replace(/ytd-rich-grid-media/g, 'ytd-xxx-media')
    .replace(/ytd-rich-shelf-renderer/g, 'ytd-www-renderer')
    .replace(/ytd-rich-section-renderer/g, 'ytd-vvv-renderer')
    .replace(/ytm-shorts-lockup-view-model/g, 'ytm-uuu-view-model')
    .replace(/id="video-title(-link)?"/g, '')
    .replace(/ytd-channel-name/g, 'ytd-ttt-name');
  const tmpDir = path.join(fixtures, '..', '.artifacts');
  await mkdir(tmpDir, { recursive: true });
  const rel = '../.artifacts/home-mangled.html';
  await writeFile(path.join(fixtures, rel), mangled);

  const context = await launchWithExtension();
  try {
    const page = await openFixture(context, 'home', rel);
    const r = await page.evaluate(feedProbe);
    assert.equal(r.health.required.items, 'structural', `items strategy: ${JSON.stringify(r.health)}`);
    assert.equal(r.health.required.feed, 'structural', `feed strategy: ${JSON.stringify(r.health)}`);
    assert.ok(r.count >= 12, `mangled: expected >= 12 items, got ${r.count}`);
    for (const p of r.parsed) {
      assert.ok(p.id, `mangled item without id`);
      assert.ok(p.title, `mangled item without title: ${JSON.stringify(p)}`);
    }
    assert.ok(r.shelf, 'mangled: shorts shelf via structural');
    await page.close();
  } finally {
    await context.close();
  }
});
