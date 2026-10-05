import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markReady } from '../../extension/src/lib/ready.js';

function fakeDoc() {
  return { documentElement: { dataset: {} } };
}

test('markReady sets the ready marker and site', () => {
  const doc = fakeDoc();
  assert.equal(markReady(doc, 'youtube'), true);
  assert.equal(doc.documentElement.dataset.feedoverlay, 'ready');
  assert.equal(doc.documentElement.dataset.feedoverlaySite, 'youtube');
});

test('markReady is idempotent', () => {
  const doc = fakeDoc();
  markReady(doc, 'youtube');
  assert.equal(markReady(doc, 'youtube'), false);
});
