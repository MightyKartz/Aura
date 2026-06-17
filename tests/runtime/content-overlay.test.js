import test from 'node:test';
import assert from 'node:assert/strict';

import { OVERLAY_ROOT_ID } from '../../apps/extension/runtime/content-overlay.js';

test('content overlay exposes the stable Aura root id for QA and teardown', () => {
  assert.equal(OVERLAY_ROOT_ID, 'aura-root');
});
