import test from 'node:test';
import assert from 'node:assert/strict';

import { computeLayout } from '../../apps/extension/runtime/layout.js';

const windowedState = {
  playbackMode: 'windowed',
  playbackState: 'playing',
  controlsVisible: false,
  adActive: false,
  attentionActive: true
};

test('computeLayout gives character skins larger corner art without changing safe offsets', () => {
  const containerRect = { width: 1180, height: 664 };
  const defaultLayout = computeLayout(containerRect, windowedState, { category: 'default' });
  const characterLayout = computeLayout(containerRect, windowedState, { category: 'character' });

  assert.ok(characterLayout.bottomWidth > defaultLayout.bottomWidth);
  assert.ok(characterLayout.bottomInset <= 2);
  assert.ok(characterLayout.topLeftInset <= 2);
  assert.ok(characterLayout.bottomOffset >= defaultLayout.bottomOffset);
  assert.ok(characterLayout.topWidth > defaultLayout.topWidth);
  assert.ok(characterLayout.topWidth >= 230);
  assert.ok(characterLayout.topWidth <= 260);
  assert.ok(characterLayout.topInset < 60);
  assert.ok(defaultLayout.topInset < 52);
});

test('computeLayout still keeps character skins above controls in immersive playback', () => {
  const containerRect = { width: 1360, height: 765 };
  const layout = computeLayout(
    containerRect,
    {
      playbackMode: 'web-fullscreen',
      playbackState: 'playing',
      controlsVisible: true,
      adActive: false,
      attentionActive: true
    },
    { category: 'character' }
  );

  assert.ok(layout.bottomWidth >= 220);
  assert.ok(layout.bottomWidth <= 252);
  assert.ok(layout.topWidth >= 290);
  assert.ok(layout.bottomOffset >= 98);
  assert.ok(layout.bottomOffset <= 126);
});

test('computeLayout applies remembered size scale without moving safe offsets', () => {
  const containerRect = { width: 1180, height: 664 };
  const skin = { category: 'character' };
  const normalLayout = computeLayout(containerRect, windowedState, skin, { sizeScale: 1 });
  const enlargedLayout = computeLayout(containerRect, windowedState, skin, { sizeScale: 1.2 });
  const compactLayout = computeLayout(containerRect, windowedState, skin, { sizeScale: 0.85 });

  assert.ok(enlargedLayout.topWidth > normalLayout.topWidth);
  assert.ok(enlargedLayout.bottomWidth > normalLayout.bottomWidth);
  assert.ok(compactLayout.topWidth < normalLayout.topWidth);
  assert.ok(compactLayout.bottomWidth < normalLayout.bottomWidth);
  assert.equal(enlargedLayout.topInset, normalLayout.topInset);
  assert.equal(enlargedLayout.topLeftInset, normalLayout.topLeftInset);
  assert.equal(enlargedLayout.bottomInset, normalLayout.bottomInset);
  assert.equal(enlargedLayout.bottomOffset, normalLayout.bottomOffset);
});
