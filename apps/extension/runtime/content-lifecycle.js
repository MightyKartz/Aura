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

export function createContentLifecycle({
  scheduleSync,
  onSettingsChanged,
  onForceSync,
  onPageHide
}) {
  let disposed = false;
  let heartbeatId = 0;
  let pointerClearTimer = 0;
  let lastPointerAt = 0;
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

    mutationObserver = new MutationObserver(() => {
      scheduleSync('mutation');
    });

    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'src']
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
      if (!isForceSyncMessage(message)) return;
      void onForceSync?.(message.reason || 'force-sync');
    };

    pointerMoveHandler = () => {
      lastPointerAt = Date.now();
      scheduleSync('pointer');
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
    chrome.storage.sync.onChanged?.addListener?.(settingsChangedHandler);
    chrome.runtime.onMessage?.addListener?.(runtimeMessageHandler);

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
      chrome.storage.sync.onChanged?.removeListener?.(settingsChangedHandler);
      settingsChangedHandler = null;
    }

    if (runtimeMessageHandler) {
      chrome.runtime.onMessage?.removeListener?.(runtimeMessageHandler);
      runtimeMessageHandler = null;
    }
  }

  return {
    start,
    stop,
    setTargets,
    clearTargets,
    getLastPointerAt: () => lastPointerAt
  };
}
