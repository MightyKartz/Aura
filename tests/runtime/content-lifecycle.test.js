import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluatePointerTrigger,
  shouldIgnoreMutationRecords,
  shouldScheduleStructuralSync
} from '../../apps/extension/runtime/content-lifecycle.js';

class FakeNode {}
class FakeElement extends FakeNode {
  constructor({
    id = '',
    className = '',
    tagName = 'div',
    rect = null,
    auraOwned = false,
    auraLock = false,
    parentElement = null
  } = {}) {
    super();
    this.id = id;
    this.className = className;
    this.tagName = tagName.toUpperCase();
    this._rect = rect;
    this._auraOwned = auraOwned;
    this.parentElement = parentElement;
    this.dataset = auraLock ? { auraPositionLock: '1' } : {};
    this._children = [];
    if (parentElement instanceof FakeElement) {
      parentElement._children.push(this);
    }
  }

  closest(selector) {
    if (selector === '#aura-root') return this._auraOwned ? this : null;
    if (this.matches(selector)) return this;
    return this.parentElement?.closest?.(selector) || null;
  }

  contains(node) {
    if (!(node instanceof FakeElement)) return false;
    if (node === this) return true;

    let current = node.parentElement;
    while (current) {
      if (current === this) return true;
      current = current.parentElement;
    }

    return false;
  }

  matches(selector) {
    if (selector === 'video') return this.tagName === 'VIDEO';
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return String(this.className || '').split(/\s+/).includes(selector.slice(1));
    return false;
  }

  getBoundingClientRect() {
    return this._rect || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
}

test('shouldIgnoreMutationRecords ignores Aura-owned overlay mutations', () => {
  globalThis.Node = FakeNode;
  globalThis.Element = FakeElement;

  const auraRoot = new FakeElement({ id: 'aura-root', auraOwned: true });
  const auraImage = new FakeElement({ auraOwned: true, parentElement: auraRoot });

  const ignored = shouldIgnoreMutationRecords([
    {
      type: 'attributes',
      target: auraImage,
      attributeName: 'src'
    },
    {
      type: 'childList',
      target: auraRoot,
      addedNodes: [new FakeElement({ auraOwned: true, parentElement: auraRoot })],
      removedNodes: []
    }
  ]);

  assert.equal(ignored, true);
});

test('shouldIgnoreMutationRecords ignores Aura childList insertions even when target is player container', () => {
  globalThis.Node = FakeNode;
  globalThis.Element = FakeElement;

  const container = new FakeElement();
  const auraRoot = new FakeElement({ id: 'aura-root', auraOwned: true, parentElement: container });

  assert.equal(
    shouldIgnoreMutationRecords([
      {
        type: 'childList',
        target: container,
        addedNodes: [auraRoot],
        removedNodes: []
      }
    ]),
    true
  );
});

test('shouldIgnoreMutationRecords ignores container style mutations caused by Aura lock', () => {
  globalThis.Node = FakeNode;
  globalThis.Element = FakeElement;

  const container = new FakeElement({ auraLock: true });

  assert.equal(
    shouldIgnoreMutationRecords([
      {
        type: 'attributes',
        target: container,
        attributeName: 'style'
      }
    ]),
    true
  );
});

test('shouldIgnoreMutationRecords keeps real page mutations observable', () => {
  globalThis.Node = FakeNode;
  globalThis.Element = FakeElement;

  const pageNode = new FakeElement();

  assert.equal(
    shouldIgnoreMutationRecords([
      {
        type: 'attributes',
        target: pageNode,
        attributeName: 'class'
      }
    ]),
    false
  );
});

test('shouldScheduleStructuralSync ignores unrelated page childList churn', () => {
  globalThis.Node = FakeNode;
  globalThis.Element = FakeElement;

  const unrelatedNode = new FakeElement();
  const unrelatedTarget = new FakeElement();

  assert.equal(
    shouldScheduleStructuralSync([
      {
        type: 'childList',
        target: unrelatedTarget,
        addedNodes: [unrelatedNode],
        removedNodes: []
      }
    ]),
    false
  );
});

test('shouldScheduleStructuralSync tracks player and video structure changes', () => {
  class StructuralElement extends FakeElement {
    constructor({ matchesPlayer = false, containsVideo = false, ...rest } = {}) {
      super(rest);
      this._matchesPlayer = matchesPlayer;
      this._containsVideo = containsVideo;
    }

    matches(selector) {
      return this._matchesPlayer && selector === '.txp-player';
    }

    querySelector(selector) {
      return this._containsVideo && selector === 'video' ? new StructuralElement() : null;
    }
  }

  globalThis.Node = FakeNode;
  globalThis.Element = StructuralElement;

  const playerNode = new StructuralElement({ matchesPlayer: true });
  const videoWrapper = new StructuralElement({ containsVideo: true });

  assert.equal(
    shouldScheduleStructuralSync([
      {
        type: 'childList',
        target: new StructuralElement(),
        addedNodes: [playerNode],
        removedNodes: []
      }
    ]),
    true
  );

  assert.equal(
    shouldScheduleStructuralSync([
      {
        type: 'childList',
        target: new StructuralElement(),
        addedNodes: [videoWrapper],
        removedNodes: []
      }
    ]),
    true
  );
});

test('shouldScheduleStructuralSync ignores deep churn inside the observed container subtree', () => {
  globalThis.Node = FakeNode;
  globalThis.Element = FakeElement;

  const container = new FakeElement();
  const internalLayer = new FakeElement({ parentElement: container });
  const internalNode = new FakeElement({ parentElement: internalLayer });

  assert.equal(
    shouldScheduleStructuralSync([
      {
        type: 'childList',
        target: internalLayer,
        addedNodes: [internalNode],
        removedNodes: []
      }
    ], {
      observedContainer: container,
      observedVideo: null
    }),
    false
  );
});

test('shouldScheduleStructuralSync still tracks boundary changes for the observed container', () => {
  globalThis.Node = FakeNode;
  globalThis.Element = FakeElement;

  const pageShell = new FakeElement();
  const container = new FakeElement({ parentElement: pageShell });

  assert.equal(
    shouldScheduleStructuralSync([
      {
        type: 'childList',
        target: pageShell,
        addedNodes: [],
        removedNodes: [container]
      }
    ], {
      observedContainer: container,
      observedVideo: null
    }),
    true
  );
});

test('shouldScheduleStructuralSync bails out on very large mutation batches', () => {
  globalThis.Node = FakeNode;
  globalThis.Element = FakeElement;

  const records = Array.from({ length: 90 }, () => ({
    type: 'childList',
    target: new FakeElement(),
    addedNodes: [],
    removedNodes: []
  }));

  assert.equal(shouldScheduleStructuralSync(records), true);
});

test('evaluatePointerTrigger accepts pointer near observed container rect', () => {
  globalThis.Node = FakeNode;
  globalThis.Element = FakeElement;

  const container = new FakeElement({
    rect: { left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300 }
  });

  const result = evaluatePointerTrigger({
    clientX: 512,
    clientY: 220,
    target: new FakeElement()
  }, {
    observedContainer: container,
    observedVideo: null,
    getElementsFromPoint: () => []
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, 'container-rect');
});

test('evaluatePointerTrigger accepts playback elementsFromPoint even when active container rect misses', () => {
  globalThis.Node = FakeNode;
  globalThis.Element = FakeElement;

  const container = new FakeElement({
    rect: { left: 100, top: 100, right: 300, bottom: 260, width: 200, height: 160 }
  });
  const realPlayerLayer = new FakeElement({ className: 'txp-player' });

  const result = evaluatePointerTrigger({
    clientX: 700,
    clientY: 520,
    target: new FakeElement()
  }, {
    observedContainer: container,
    observedVideo: null,
    getElementsFromPoint: () => [realPlayerLayer]
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, 'elements-from-point');
  assert.equal(result.target, 'div.txp-player');
});

test('evaluatePointerTrigger rejects pointer outside known playback surfaces', () => {
  globalThis.Node = FakeNode;
  globalThis.Element = FakeElement;

  const container = new FakeElement({
    rect: { left: 100, top: 100, right: 300, bottom: 260, width: 200, height: 160 }
  });

  const result = evaluatePointerTrigger({
    clientX: 700,
    clientY: 520,
    target: new FakeElement()
  }, {
    observedContainer: container,
    observedVideo: null,
    getElementsFromPoint: () => []
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'outside-playback-surface');
});
