import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, deepMerge, mergeSettings, getSettings, updateSettings } from '../../extension/src/lib/settings.js';

test('mergeSettings fills defaults and keeps stored values', () => {
  const m = mergeSettings({ sites: { youtube: { hideComments: true } } });
  assert.equal(m.sites.youtube.hideComments, true);
  assert.equal(m.sites.youtube.hideShorts, true);
  assert.equal(m.sites.youtube.redirectHomeToSubscriptions, true);
});

test('mergeSettings tolerates undefined and does not mutate defaults', () => {
  const m = mergeSettings(undefined);
  assert.deepEqual(m, DEFAULT_SETTINGS);
  m.sites.youtube.hideShorts = false;
  assert.equal(DEFAULT_SETTINGS.sites.youtube.hideShorts, true);
});

test('deepMerge replaces scalars and merges objects', () => {
  const out = deepMerge({ a: { b: 1, c: 2 }, d: 1 }, { a: { b: 9 }, d: { e: 1 } });
  assert.deepEqual(out, { a: { b: 9, c: 2 }, d: { e: 1 } });
});

test('memory fallback get/update round-trips without chrome.storage', async () => {
  const before = await getSettings();
  assert.equal(before.sites.youtube.hideMetrics, true);
  const after = await updateSettings({ sites: { youtube: { hideMetrics: false } } });
  assert.equal(after.sites.youtube.hideMetrics, false);
  assert.equal((await getSettings()).sites.youtube.hideMetrics, false);
});
