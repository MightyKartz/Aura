export const STATUS_KEY = 'aura:mvp:status';
export const RUNTIME_STATES = Object.freeze({
  DISABLED: 'disabled',
  IDLE: 'idle',
  WAITING_CONTAINER: 'waiting-container',
  RENDERED: 'rendered',
  ERROR: 'error'
});

export function normalizeComparableUrl(url = '') {
  try {
    const parsed = new URL(String(url || ''));
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return String(url || '').split('#')[0];
  }
}

export function statusBelongsToUrl(status, url = '') {
  if (!status || !url) return false;
  return normalizeComparableUrl(status.pageUrl) === normalizeComparableUrl(url);
}

export async function readStatus(storageArea = chrome.storage.local) {
  const result = await storageArea.get(STATUS_KEY);
  return result?.[STATUS_KEY] ?? null;
}

export async function readStatusForUrl(url, storageArea = chrome.storage.local) {
  const status = await readStatus(storageArea);
  return statusBelongsToUrl(status, url) ? status : null;
}

export function createStatusReporter({
  frameId,
  getSiteId = () => 'tencent-video',
  getRenderMode = () => 'corner-decor',
  getPageUrl = () => location.href,
  getNow = () => Date.now(),
  writeStatus = (payload) => chrome.storage.local.set(payload)
} = {}) {
  let lastStatusFingerprint = '';

  function commitStatus(payload) {
    const pageUrl = getPageUrl();
    const normalized = {
      frameId,
      frame: 'top',
      site: getSiteId(),
      renderMode: getRenderMode(),
      pageUrl,
      topPageUrl: pageUrl,
      ...payload
    };

    const fingerprint = JSON.stringify(normalized);
    if (fingerprint === lastStatusFingerprint) return;
    lastStatusFingerprint = fingerprint;

    void writeStatus({
      [STATUS_KEY]: {
        ...normalized,
        updatedAt: getNow()
      }
    });
  }

  function clearStatus({ state, message, settings, title, skinContext, extra = {} }) {
    commitStatus({
      renderActive: false,
      state,
      message,
      enabled: settings.enabled,
      mode: settings.mode,
      title,
      skinContext,
      videoDetected: false,
      containerDetected: false,
      containerSource: 'none',
      playbackMode: 'windowed',
      playbackState: 'playing',
      controlsVisible: false,
      adActive: false,
      ...extra
    });
  }

  function renderStatus({
    title,
    showContext,
    container,
    containerSource,
    video,
    skin,
    skinSource,
    visualState,
    reason,
    settings,
    diagnostics = {}
  }) {
    const containerRect = container.getBoundingClientRect();
    const videoRect = video instanceof HTMLVideoElement ? video.getBoundingClientRect() : null;
    const message = visualState.adActive
      ? `${skin.name} 已在广告态弱化显示`
      : `已显示 ${skin.name}`;

    commitStatus({
      renderActive: true,
      state: 'rendered',
      message,
      enabled: settings.enabled,
      mode: settings.mode,
      title,
      skinId: skin.id,
      skinName: skin.name,
      skinSource,
      skinContext: showContext,
      videoDetected: video instanceof HTMLVideoElement,
      containerDetected: true,
      containerSource,
      playbackMode: visualState.playbackMode,
      playbackState: visualState.playbackState,
      controlsVisible: visualState.controlsVisible,
      adActive: visualState.adActive,
      lastSyncReason: reason,
      videoRect: videoRect ? `${Math.round(videoRect.width)}x${Math.round(videoRect.height)}` : '--',
      containerRect: `${Math.round(containerRect.width)}x${Math.round(containerRect.height)}`,
      ...diagnostics
    });
  }

  return {
    commitStatus,
    clearStatus,
    renderStatus
  };
}
