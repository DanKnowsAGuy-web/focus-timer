import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchWithExtension, routeOriginToFixture } from './harness.mjs';

test('content script runs on youtube.com served from the skeleton fixture', async () => {
  const context = await launchWithExtension();
  try {
    const page = await context.newPage();
    await routeOriginToFixture(page, 'https://www.youtube.com', 'youtube/skeleton.html');
    await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('html[data-feedoverlay="ready"]', { timeout: 10_000 });
    const site = await page.getAttribute('html', 'data-feedoverlay-site');
    assert.equal(site, 'youtube');
  } finally {
    await context.close();
  }
});

test('content script does not run on other origins', async () => {
  const context = await launchWithExtension();
  try {
    const page = await context.newPage();
    await routeOriginToFixture(page, 'https://example.com', 'youtube/skeleton.html');
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const marker = await page.getAttribute('html', 'data-feedoverlay');
    assert.equal(marker, null);
  } finally {
    await context.close();
  }
});
