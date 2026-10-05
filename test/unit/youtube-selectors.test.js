import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoIdFromHref, channelIdFromHref, pageType } from '../../extension/src/lib/selectors/youtube.js';

test('videoIdFromHref reads watch and shorts urls', () => {
  assert.equal(videoIdFromHref('/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(videoIdFromHref('https://www.youtube.com/watch?list=PL1&v=dQw4w9WgXcQ&t=1'), 'dQw4w9WgXcQ');
  assert.equal(videoIdFromHref('/shorts/abcdefghijk'), 'abcdefghijk');
  assert.equal(videoIdFromHref('/@someone'), null);
  assert.equal(videoIdFromHref(null), null);
});

test('channelIdFromHref reads handles, channel ids and legacy paths', () => {
  assert.equal(channelIdFromHref('/@handle.name'), '@handle.name');
  assert.equal(channelIdFromHref('/channel/UCabcdefghijklmnopqrstuv'), 'UCabcdefghijklmnopqrstuv');
  assert.equal(channelIdFromHref('/c/SomeName'), 'SomeName');
  assert.equal(channelIdFromHref('/user/old'), 'old');
  assert.equal(channelIdFromHref('/watch?v=dQw4w9WgXcQ'), null);
});

test('pageType maps paths', () => {
  const at = (pathname) => pageType({ pathname });
  assert.equal(at('/'), 'home');
  assert.equal(at('/watch'), 'watch');
  assert.equal(at('/shorts/abcdefghijk'), 'shorts');
  assert.equal(at('/feed/subscriptions'), 'subscriptions');
  assert.equal(at('/feed/channels'), 'channels');
  assert.equal(at('/results'), 'other');
});
