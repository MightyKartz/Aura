import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FORCE_SYNC_MESSAGE_TYPE,
  MARK_MOMENT_MESSAGE_TYPE,
  createForceSyncMessage,
  createMarkMomentMessage,
  isForceSyncMessage,
  isMarkMomentMessage
} from '../../apps/extension/runtime/messages.js';

test('createForceSyncMessage keeps existing force-sync contract', () => {
  const message = createForceSyncMessage('popup');
  assert.deepEqual(message, {
    type: FORCE_SYNC_MESSAGE_TYPE,
    reason: 'popup'
  });
  assert.equal(isForceSyncMessage(message), true);
  assert.equal(isMarkMomentMessage(message), false);
});

test('createMarkMomentMessage creates popup-triggered mark contract', () => {
  const message = createMarkMomentMessage('popup-button');
  assert.deepEqual(message, {
    type: MARK_MOMENT_MESSAGE_TYPE,
    source: 'popup-button'
  });
  assert.equal(isMarkMomentMessage(message), true);
  assert.equal(isForceSyncMessage(message), false);
});
