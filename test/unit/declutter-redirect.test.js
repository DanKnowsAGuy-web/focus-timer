import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redirectIfNeeded } from '../../extension/src/lib/declutter/youtube.js';
import { DEFAULT_SETTINGS } from '../../extension/src/lib/settings.js';

function loc(pathname) {
  const calls = [];
  return { pathname, replace: (u) => calls.push(u), calls };
}
const cfg = DEFAULT_SETTINGS.sites.youtube;

test('home redirects to subscriptions when the toggle is on', () => {
  const l = loc('/');
  assert.equal(redirectIfNeeded({ location: l }, cfg), true);
  assert.deepEqual(l.calls, ['/feed/subscriptions']);
});

test('home stays put when the toggle is off', () => {
  const l = loc('/');
  assert.equal(redirectIfNeeded({ location: l }, { ...cfg, redirectHomeToSubscriptions: false }), false);
  assert.deepEqual(l.calls, []);
});

test('shorts redirect to the regular player when shorts are hidden', () => {
  const l = loc('/shorts/abcdefghijk');
  assert.equal(redirectIfNeeded({ location: l }, cfg), true);
  assert.deepEqual(l.calls, ['/watch?v=abcdefghijk']);
});

test('other pages never redirect', () => {
  for (const p of ['/feed/subscriptions', '/watch', '/results', '/feed/channels']) {
    const l = loc(p);
    assert.equal(redirectIfNeeded({ location: l }, cfg), false, p);
  }
});
