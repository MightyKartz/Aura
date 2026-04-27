import { isForceSyncMessage } from './messages.js';
import { STORAGE_KEY } from './settings.js';

const VIDEO_EVENTS = Object.freeze([
  'play',
  'pause',
  'loadedmetadata',
  'loadeddata',
  'canplay',
  'waiting',
  'seeking',
  'seeked',
  'emptied',
  'ended'
]);
const STRUCTURAL_MUTATION_SELECTORS = Object.freeze([
  'video',
  '#player-component',
  '#main-player',
  '.main-player-container',
  '.main-player-wrapper',
  '.container-player',
  '.txp_player',
  '.txp-player',
  '.wasm-player-fake-video'
]);
const POINTER_TRIGGER_TOLERANCE_PX = 32;
const MAX_MUTATION_RECORDS_PER_TICK = 80;
const MAX_CHANGED_NODES_PER_RECORD = 40;

function toRectSnapshot(rect = null) {
  if (!rect) return null;
  return {
    left: Math.round(Number(rect.left || 0)),
    top: Math.round(Number(rect.top || 0)),
    right: Math.round(Number(rect.right || 0)),
    bottom: Math.round(Number(rect.bottom || 0)),
    width: Math.round(Number(rect.width || 0)),
    height: Math.round(Number(rect.height || 0))
  };
}

function isPointInRect(x, y, rect = null, tolerancePx = POINTER_TRIGGER_TOLERANCE_PX) {
  if (!rect) return false;
  return x >= rect.left - tolerancePx
    && x <= rect.right + tolerancePx
    && y >= rect.top - tolerancePx
    && y <= rect.bottom + tolerancePx;
}

function describeElement(element = null) {
  if (!(element instanceof Element)) return '';
  const id = element.id ? `#${element.id}` : '';
  const className = typeof element.className === 'string'
    ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).map((name) => `.${name}`).join('')
    : '';
  return `${element.tagName?.toLowerCase?.() || 'element'}${id}${className}`;
}

function isPlaybackSurfaceElement(element = null, observedContainer = null, observedVideo = null) {
  if (!(element instanceof Element)) return false;
  if (element === observedContainer || element === observedVideo) return true;
  if (observedContainer instanceof Element && observedContainer.contains(element)) return true;
  if (observedVideo instanceof Element && observedVideo.contains(element)) return true;

  return STRUCTURAL_MUTATION_SELECTORS.some((selector) => {
    try {
      return Boolean(element.matches?.(selector) || element.closest?.(selector));
    } catch {
      return false;
    }
  });
}

function getEventPath(event = null) {
  if (typeof event?.composedPath === 'function') {
    return event.composedPath();
  }

  const path = [];
  let current = event?.target instanceof Node ? event.target : null;
  while (current) {
    path.push(current);
    current = current.parentNode || current.host || null;
  }
  return path;
}

export function evaluatePointerTrigger(event, {
  observedContainer = null,
  observedVideo = null,
  getElementsFromPoint = (x, y) => document.elementsFromPoint?.(x, y) || []
} = {}) {
  const x = Number(event?.clientX);
  const y = Number(event?.clientY);
  const containerRect = observedContainer instanceof Element ? observedContainer.getBoundingClientRect() : null;
  const videoRect = observedVideo instanceof Element ? observedVideo.getBoundingClientRect() : null;
  const target = event?.target instanceof Element ? event.target : null;
  const base = {
    accepted: false,
    reason: 'missing-pointer-coordinates',
    x: Number.isFinite(x) ? Math.round(x) : null,
    y: Number.isFinite(y) ? Math.round(y) : null,
    target: describeElement(target),
    containerRect: toRectSnapshot(containerRect),
    videoRect: toRectSnapshot(videoRect)
  };

  if (!Number.isFinite(x) || !Number.isFinite(y)) return base;

  if (!(observedContainer instanceof Element) && !(observedVideo instanceof Element)) {
    return { ...base, accepted: true, reason: 'no-observed-target' };
  }

  if (isPointInRect(x, y, containerRect)) {
    return { ...base, accepted: true, reason: 'container-rect' };
  }

  if (isPointInRect(x, y, videoRect)) {
    return { ...base, accepted: true, reason: 'video-rect' };
  }

  if (getEventPath(event).some((node) => isPlaybackSurfaceElement(node, observedContainer, observedVideo))) {
    return { ...base, accepted: true, reason: 'event-path' };
  }

  const elementsAtPoint = Array.from(getElementsFromPoint(x, y) || []).filter((node) => node instanceof Element);
  const matchedElement = elementsAtPoint.find((element) => isPlaybackSurfaceElement(element, observedContainer, observedVideo));
  if (matchedElement) {
    return {
      ...base,
      accepted: true,
      reason: 'elements-from-point',
      target: describeElement(matchedElement)
    };
  }

  return { ...base, reason: 'outside-playback-surface' };
}

function isAuraOwnedNode(node) {
  if (!(node instanceof Node)) return false;
  if (!(node instanceof Element)) {
    return node.parentElement?.closest?.('#aura-root') instanceof Element;
  }

  return node.id === 'aura-root' || node.closest('#aura-root') instanceof Element;
}

function isAuraManagedTarget(target, attributeName = '') {
  if (!(target instanceof Element)) return false;
  if (isAuraOwnedNode(target)) return true;
  if (attributeName === 'style' && target.dataset?.auraPositionLock === '1') return true;
  return false;
}

function areAuraOwnedNodes(nodes) {
  return Array.from(nodes || []).every((node) => isAuraOwnedNode(node));
}

function isObservedSubtreeNode(node, observedContainer, observedVideo) {
  if (!(node instanceof Node)) return false;

  if (observedContainer instanceof Element && node !== observedContainer && observedContainer.contains?.(node)) {
    return true;
  }

  if (observedVideo instanceof Element && node !== observedVideo && observedVideo.contains?.(node)) {
    return true;
  }

  return false;
}

function isStructuralMutationTarget(node, observedContainer, observedVideo) {
  if (!(node instanceof Node)) return false;
  if (node === observedContainer || node === observedVideo) return true;

  if (!(node instanceof Element)) {
    const parent = node.parentElement;
    return Boolean(
      parent
        && (parent === observedContainer
          || parent === observedVideo
          || parent.contains?.(observedContainer)
          || parent.contains?.(observedVideo))
    );
  }

  if (
    node === observedContainer
    || node === observedVideo
    || node.contains?.(observedContainer)
    || node.contains?.(observedVideo)
  ) {
    return true;
  }

  return STRUCTURAL_MUTATION_SELECTORS.some((selector) => {
    try {
      return node.matches?.(selector) || node.querySelector?.(selector);
    } catch {
      return false;
    }
  });
}

export function shouldScheduleStructuralSync(records = [], {
  observedContainer = null,
  observedVideo = null
} = {}) {
  if (!Array.isArray(records) || records.length === 0) return false;
  if (records.length > MAX_MUTATION_RECORDS_PER_TICK) return true;

  return records.slice(0, MAX_MUTATION_RECORDS_PER_TICK).some((record) => {
    if (!record || record.type !== 'childList') return false;
    const changedNodes = [
      ...Array.from(record.addedNodes || []),
      ...Array.from(record.removedNodes || [])
    ].slice(0, MAX_CHANGED_NODES_PER_RECORD);

    if (isObservedSubtreeNode(record.target, observedContainer, observedVideo)) {
      return changedNodes.some((node) => isStructuralMutationTarget(node, observedContainer, observedVideo));
    }

    if (isStructuralMutationTarget(record.target, observedContainer, observedVideo)) {
      return true;
    }

    return changedNodes.some((node) => isStructuralMutationTarget(node, observedContainer, observedVideo));
  });
}

export function shouldIgnoreMutationRecords(records = []) {
  if (!Array.isArray(records) || records.length === 0) return false;

  return records.every((record) => {
    if (!record || typeof record.type !== 'string') return false;

    if (record.type === 'attributes') {
      return isAuraManagedTarget(record.target, record.attributeName || '');
    }

    if (record.type === 'childList') {
      if (areAuraOwnedNodes(record.addedNodes) && areAuraOwnedNodes(record.removedNodes)) {
        return true;
      }

      return isAuraManagedTarget(record.target)
        && areAuraOwnedNodes(record.addedNodes)
        && areAuraOwnedNodes(record.removedNodes);
    }

    return false;
  });
}

export function createContentLifecycle({
  scheduleSync,
  onSettingsChanged,
  onForceSync,
  onPageHide,
  onRuntimeMessage
}) {
  let disposed = false;
  let heartbeatId = 0;
  let pointerClearTimer = 0;
  let lastPointerAt = 0;
  let lastPointerInfo = {
    accepted: false,
    reason: 'none',
    x: null,
    y: null,
    target: '',
    at: 0,
    ageMs: null,
    containerRect: null,
    videoRect: null
  };
  let resizeObserver = null;
  let mutationObserver = null;
  let observedContainer = null;
  let observedVideo = null;
  let boundVideo = null;
  let boundVideoListeners = [];
  let fullscreenChangeHandler = null;
  let visibilityChangeHandler = null;
  let windowResizeHandler = null;
  let pageHideHandler = null;
  let settingsChangedHandler = null;
  let runtimeMessageHandler = null;
  let pointerMoveHandler = null;

  function bindVideo(video) {
    if (boundVideo === video) return;

    for (const [eventName, handler] of boundVideoListeners) {
      boundVideo?.removeEventListener(eventName, handler);
    }

    boundVideoListeners = [];
    boundVideo = video instanceof HTMLVideoElement ? video : null;

    if (!(boundVideo instanceof HTMLVideoElement)) return;

    for (const eventName of VIDEO_EVENTS) {
      const handler = () => {
        scheduleSync(`video:${eventName}`);
      };
      boundVideoListeners.push([eventName, handler]);
      boundVideo.addEventListener(eventName, handler);
    }
  }

  function observeTargets(container, video) {
    if (!resizeObserver) return;
    if (observedContainer === container && observedVideo === video) return;

    resizeObserver.disconnect();
    observedContainer = container instanceof Element ? container : null;
    observedVideo = video instanceof Element ? video : null;

    if (observedContainer) resizeObserver.observe(observedContainer);
    if (observedVideo && observedVideo !== observedContainer) resizeObserver.observe(observedVideo);
  }

  function setTargets(container, video) {
    bindVideo(video);
    observeTargets(container, video);
  }

  function clearTargets() {
    bindVideo(null);
    observeTargets(null, null);
  }

  function start() {
    if (disposed) return;

    resizeObserver = new ResizeObserver(() => {
      scheduleSync('resize-observer');
    });

    mutationObserver = new MutationObserver((records) => {
      if (shouldIgnoreMutationRecords(records)) return;
      if (!shouldScheduleStructuralSync(records, { observedContainer, observedVideo })) return;
      scheduleSync('mutation');
    });

    mutationObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    fullscreenChangeHandler = () => {
      scheduleSync('fullscreenchange');
    };

    visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible') {
        scheduleSync('visibility');
      }
    };

    windowResizeHandler = () => {
      scheduleSync('window-resize');
    };

    pageHideHandler = () => {
      onPageHide?.('pagehide');
    };

    settingsChangedHandler = (changes, areaName) => {
      if (areaName !== 'sync' || !changes[STORAGE_KEY]) return;
      void onSettingsChanged?.();
    };

    runtimeMessageHandler = (message) => {
      if (isForceSyncMessage(message)) {
        void onForceSync?.(message.reason || 'force-sync');
        return;
      }

      void onRuntimeMessage?.(message);
    };

    pointerMoveHandler = (event) => {
      const now = Date.now();
      const pointerTrigger = evaluatePointerTrigger(event, {
        observedContainer,
        observedVideo
      });
      lastPointerInfo = {
        ...pointerTrigger,
        at: now,
        ageMs: 0
      };
      if (!pointerTrigger.accepted) return;

      const shouldPromoteAttention = now - lastPointerAt > 240;
      lastPointerAt = now;
      if (shouldPromoteAttention) {
        scheduleSync('pointer');
      }
      window.clearTimeout(pointerClearTimer);
      pointerClearTimer = window.setTimeout(() => {
        scheduleSync('pointer-settle');
      }, 1600);
    };

    document.addEventListener('fullscreenchange', fullscreenChangeHandler);
    document.addEventListener('visibilitychange', visibilityChangeHandler);
    document.addEventListener('pointermove', pointerMoveHandler, { passive: true });
    window.addEventListener('resize', windowResizeHandler, { passive: true });
    window.addEventListener('pagehide', pageHideHandler);
    globalThis.chrome?.storage?.sync?.onChanged?.addListener?.(settingsChangedHandler);
    globalThis.chrome?.runtime?.onMessage?.addListener?.(runtimeMessageHandler);

    heartbeatId = window.setInterval(() => {
      scheduleSync('heartbeat');
    }, 2500);
  }

  function stop() {
    disposed = true;

    window.clearInterval(heartbeatId);
    window.clearTimeout(pointerClearTimer);
    mutationObserver?.disconnect();
    resizeObserver?.disconnect();
    clearTargets();

    if (fullscreenChangeHandler) {
      document.removeEventListener('fullscreenchange', fullscreenChangeHandler);
      fullscreenChangeHandler = null;
    }

    if (visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', visibilityChangeHandler);
      visibilityChangeHandler = null;
    }

    if (pointerMoveHandler) {
      document.removeEventListener('pointermove', pointerMoveHandler);
      pointerMoveHandler = null;
    }

    if (windowResizeHandler) {
      window.removeEventListener('resize', windowResizeHandler);
      windowResizeHandler = null;
    }

    if (pageHideHandler) {
      window.removeEventListener('pagehide', pageHideHandler);
      pageHideHandler = null;
    }

    if (settingsChangedHandler) {
      globalThis.chrome?.storage?.sync?.onChanged?.removeListener?.(settingsChangedHandler);
      settingsChangedHandler = null;
    }

    if (runtimeMessageHandler) {
      globalThis.chrome?.runtime?.onMessage?.removeListener?.(runtimeMessageHandler);
      runtimeMessageHandler = null;
    }
  }

  return {
    start,
    stop,
    setTargets,
    clearTargets,
    getLastPointerAt: () => lastPointerAt,
    getPointerDebugInfo: () => ({
      ...lastPointerInfo,
      ageMs: lastPointerInfo.at > 0 ? Date.now() - lastPointerInfo.at : null
    })
  };
}
