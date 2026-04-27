import test from 'node:test';
import assert from 'node:assert/strict';

import { getSiteSupport } from '../../apps/extension/runtime/site-adapters.js';
import { isTencentPlaybackUrl } from '../../apps/extension/runtime/tencent-detect.js';

test('Tencent adapter accepts playback URLs with an explicit local QA port', () => {
  const url = 'https://v.qq.com:9443/x/cover/aura-local-qa/aura-local.html';
  const support = getSiteSupport(url);

  assert.equal(support.supported, true);
  assert.equal(support.playback, true);
  assert.equal(support.adapter?.id, 'tencent-video');
  assert.equal(isTencentPlaybackUrl(url), true);
});

test('Tencent adapter still rejects non-Tencent hosts', () => {
  const support = getSiteSupport('https://example.com/x/cover/demo.html');

  assert.equal(support.supported, false);
  assert.equal(support.playback, false);
  assert.equal(isTencentPlaybackUrl('https://example.com/x/cover/demo.html'), false);
});
