import { computeLayout } from './layout.js';
import { createContentLifecycle } from './content-lifecycle.js';
import { createOverlayManager } from './content-overlay.js';
import { buildInfoLayerModel } from './info-layer.js';
import { isMarkMomentMessage } from './messages.js';
import { DEFAULT_SETTINGS, normalizeSizeScale, patchSettings, readSettings } from './settings.js';
import { createFallbackRegistry, loadSkinRegistry, resolveSkin } from './skin-registry.js';
import { findSiteAdapter } from './site-adapters.js';
import { createStatusReporter, RUNTIME_STATES } from './status.js';
import {
  formatPlaybackTime,
  getLatestMark,
  readMarksForUrl,
  readResumePointForUrl,
  saveMarkForUrl,
  writeResumePointForUrl
} from './utility-state.js';

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: typeof error.stack === 'string' ? error.stack : ''
    };
  }

  return {
    name: typeof error,
    message: typeof error === 'string' ? error : String(error),
    stack: ''
  };
}

export function startAuraContentController({
  frameId = `aura-${Math.random().toString(36).slice(2, 10)}`
} = {}) {
  const LOW_SIGNAL_SYNC_REASONS = new Set(['asset-ready', 'mutation', 'heartbeat', 'pointer', 'pointer-settle', 'resize-observer']);
  const SYNC_REASON_COOLDOWNS = Object.freeze({
    'asset-ready': 650,
    mutation: 900,
    heartbeat: 5000,
    pointer: 320,
    'pointer-settle': 480,
    'resize-observer': 220,
    'window-resize': 180
  });
  let disposed = false;
  let syncQueued = false;
  let pendingReason = 'init';
  let syncInFlight = false;
  let lastMeaningfulReason = 'init';
  let settings = { ...DEFAULT_SETTINGS };
  let skinRegistry = createFallbackRegistry();
  let activeContainer = null;
  let activeVideo = null;
  let adapter = null;
  let detector = null;
  let cornerFeedbackPrompt = null;
  let promptClearTimeoutId = 0;
  let lastResumePersistedAt = 0;
  let lastResumePersistedTimeSec = -1;
  let utilitySummaryCache = null;
  let utilitySummaryCacheKey = '';
  const lastQueuedAtByReason = new Map();

  const runtimeDiagnostics = {
    frameId,
    active: true,
    stage: 'bootstrap',
    state: 'booting',
    lastSyncReason: 'bootstrap',
    moduleLoadState: 'loaded',
    registryLoadState: 'idle',
    syncState: 'idle',
    errorStage: '',
    errorMessage: '',
    updatedAt: Date.now()
  };

  const overlay = createOverlayManager({
    onAssetReady: () => {
      scheduleSync('asset-ready');
    },
    onAction: handleOverlayAction
  });
  const statusReporter = createStatusReporter({
    frameId,
    getSiteId: () => adapter?.id ?? 'unsupported'
  });
  const lifecycle = createContentLifecycle({
    scheduleSync,
    onSettingsChanged: handleSettingsChanged,
    onForceSync: handleForceSync,
    onPageHide: dispose,
    onRuntimeMessage: handleRuntimeMessage
  });

  function updateDomDiagnostics() {
    const root = document.documentElement;
    if (!(root instanceof HTMLElement)) return;

    root.dataset.auraFrameId = frameId;
    root.dataset.auraRuntimeState = runtimeDiagnostics.state || 'unknown';
    root.dataset.auraRuntimeStage = runtimeDiagnostics.stage || 'unknown';
    root.dataset.auraRuntimeErrorStage = runtimeDiagnostics.errorStage || '';
    root.dataset.auraRuntimeLastSyncReason = runtimeDiagnostics.lastSyncReason || '';
    root.dataset.auraRuntimeModuleLoad = runtimeDiagnostics.moduleLoadState || 'unknown';
    root.dataset.auraRuntimeRegistryLoad = runtimeDiagnostics.registryLoadState || 'unknown';
    root.dataset.auraRuntimeSyncState = runtimeDiagnostics.syncState || 'unknown';
  }

  function updateGlobalDiagnostics() {
    globalThis.__AURA_CORNER_DECOR_RUNTIME__ = { ...runtimeDiagnostics };
    globalThis.__AURA_CORNER_DECOR_LAST_ERROR__ = runtimeDiagnostics.errorStage
      ? {
        frameId,
        stage: runtimeDiagnostics.errorStage,
        message: runtimeDiagnostics.errorMessage,
        updatedAt: runtimeDiagnostics.updatedAt
      }
      : null;
  }

  function markRuntimeDiagnostic(patch) {
    Object.assign(runtimeDiagnostics, patch, { updatedAt: Date.now() });
    updateDomDiagnostics();
    updateGlobalDiagnostics();
  }

  function isExtensionContextAlive() {
    try {
      return Boolean(globalThis.chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function disposeLocalOnly(reason = 'extension-context-invalidated') {
    dispose(reason, { reportStatus: false });
  }

  function refreshSiteAdapter() {
    const nextAdapter = findSiteAdapter(location.href);
    if (adapter?.id === nextAdapter?.id) return;

    adapter = nextAdapter;
    detector = adapter?.createDetector({
      getActiveContainer: () => activeContainer
    }) ?? null;
  }

  function extractShowTitle() {
    return detector?.extractShowTitle?.() ?? '';
  }

  function extractShowContext(title = '') {
    return detector?.extractShowContext?.(title) ?? '';
  }

  function isReusableVideo(video) {
    if (!(video instanceof HTMLVideoElement) || !video.isConnected) return false;
    const rect = video.getBoundingClientRect();
    return rect.width >= 220 && rect.height >= 124;
  }

  function isReusableContainer(container) {
    if (!(container instanceof HTMLElement) || !container.isConnected) return false;
    const rect = container.getBoundingClientRect();
    return rect.width >= 240 && rect.height >= 135;
  }

  function shouldPreferTrackedTargets(reason = '') {
    return [
      'heartbeat',
      'pointer',
      'pointer-settle',
      'resize-observer',
      'window-resize',
      'prompt-expire'
    ].includes(reason);
  }

  function detectPrimaryVideo(reason = '') {
    if (shouldPreferTrackedTargets(reason) && isReusableVideo(activeVideo)) {
      return activeVideo;
    }

    return detector?.detectPrimaryVideo?.() ?? null;
  }

  function detectPlayerContainer(reason = '') {
    if (shouldPreferTrackedTargets(reason) && isReusableContainer(activeContainer)) {
      return {
        element: activeContainer,
        source: 'active-container'
      };
    }

    return detector?.detectPlayerContainer?.() ?? null;
  }

  function hasVisibleSiteShell() {
    return Boolean(detectPlayerContainer());
  }

  function detectPlaybackMode(container, video) {
    return detector?.detectPlaybackMode?.(container, video) ?? 'windowed';
  }

  function detectPlaybackState(video) {
    return detector?.detectPlaybackState?.(video) ?? 'playing';
  }

  function shouldLiftForControls(container, video) {
    return detector?.shouldLiftForControls?.(container, video) ?? false;
  }

  function isAdvertisementActive(container) {
    return detector?.isAdvertisementActive?.(container) ?? false;
  }

  function getPlaybackControlCapability(video) {
    if (!(video instanceof HTMLVideoElement) || !video.isConnected) {
      return {
        canReadTime: false,
        canSeek: false,
        reason: 'no-video'
      };
    }

    try {
      const currentTime = Number(video.currentTime);
      if (!Number.isFinite(currentTime) || currentTime < 0) {
        return {
          canReadTime: false,
          canSeek: false,
          reason: 'invalid-current-time'
        };
      }

      return {
        canReadTime: true,
        canSeek: true,
        reason: 'html-video'
      };
    } catch {
      return {
        canReadTime: false,
        canSeek: false,
        reason: 'video-time-unreadable'
      };
    }
  }

  function buildVisualState(container, video) {
    const lastPointerAt = lifecycle.getLastPointerAt();
    const pointerDebug = lifecycle.getPointerDebugInfo();
    return {
      playbackMode: detectPlaybackMode(container, video),
      playbackState: detectPlaybackState(video),
      controlsVisible: shouldLiftForControls(container, video),
      adActive: isAdvertisementActive(container),
      attentionActive: pointerDebug.accepted === true && lastPointerAt > 0 && (Date.now() - lastPointerAt) < 1800,
      attentionToken: lastPointerAt,
      pointerDebug
    };
  }

  function clearPromptTimer() {
    if (promptClearTimeoutId) {
      window.clearTimeout(promptClearTimeoutId);
      promptClearTimeoutId = 0;
    }
  }

  function schedulePromptExpirySync(durationMs = 0) {
    clearPromptTimer();
    if (!(durationMs > 0)) return;
    promptClearTimeoutId = window.setTimeout(() => {
      promptClearTimeoutId = 0;
      scheduleSync('prompt-expire');
    }, durationMs + 40);
  }

  function setCornerFeedbackPrompt(text, type, durationMs = 1600) {
    if (!text) {
      cornerFeedbackPrompt = null;
      clearPromptTimer();
      return null;
    }

    cornerFeedbackPrompt = {
      text,
      type,
      expiresAt: Date.now() + durationMs,
      durationMs
    };
    schedulePromptExpirySync(durationMs);
    return cornerFeedbackPrompt;
  }

  function getActiveCornerFeedbackPrompt(now = Date.now()) {
    if (!cornerFeedbackPrompt) return null;
    if (Number(cornerFeedbackPrompt.expiresAt || 0) <= now) {
      cornerFeedbackPrompt = null;
      clearPromptTimer();
      return null;
    }
    return cornerFeedbackPrompt;
  }

  async function readUtilitySummary(pageUrl) {
    const [marks, resumePoint] = await Promise.all([
      readMarksForUrl(pageUrl),
      readResumePointForUrl(pageUrl)
    ]);
    const latestMark = getLatestMark(marks);
    return {
      marks,
      latestMark,
      resumePoint,
      markCount: marks.length,
      recentMarkLabel: latestMark?.label || '',
      resumePointLabel: resumePoint?.label || ''
    };
  }

  function buildUtilitySummaryFromData({
    marks = [],
    resumePoint = null
  } = {}) {
    const latestMark = getLatestMark(marks);
    return {
      marks,
      latestMark,
      resumePoint,
      markCount: marks.length,
      recentMarkLabel: latestMark?.label || '',
      resumePointLabel: resumePoint?.label || ''
    };
  }

  async function readUtilitySummaryCached(pageUrl, { force = false } = {}) {
    if (!pageUrl) return buildUtilitySummaryFromData();
    if (!force && utilitySummaryCacheKey === pageUrl && utilitySummaryCache) {
      return utilitySummaryCache;
    }

    const summary = await readUtilitySummary(pageUrl);
    utilitySummaryCacheKey = pageUrl;
    utilitySummaryCache = summary;
    return summary;
  }

  async function persistResumePoint(video, { force = false } = {}) {
    if (!(video instanceof HTMLVideoElement)) return null;

    const currentTime = Number(video.currentTime || 0);
    if (!Number.isFinite(currentTime) || currentTime < 5) return null;

    const now = Date.now();
    const timeDelta = Math.abs(currentTime - lastResumePersistedTimeSec);
    const timeGatePassed = now - lastResumePersistedAt >= 15000;
    const positionGatePassed = timeDelta >= 15;
    if (!force && !timeGatePassed && !positionGatePassed) {
      return null;
    }

    const pageUrl = location.href;
    const payload = {
      timeSec: Math.max(0, Math.floor(currentTime)),
      label: formatPlaybackTime(currentTime),
      updatedAt: now
    };

    const saved = await writeResumePointForUrl(pageUrl, payload);
    if (saved) {
      lastResumePersistedAt = now;
      lastResumePersistedTimeSec = saved.timeSec;
      if (utilitySummaryCacheKey === pageUrl && utilitySummaryCache) {
        utilitySummaryCache = buildUtilitySummaryFromData({
          marks: utilitySummaryCache.marks,
          resumePoint: saved
        });
      }
    }
    return saved;
  }

  async function handleMarkMoment(source = 'runtime') {
    const video = activeVideo instanceof HTMLVideoElement
      ? activeVideo
      : detectPrimaryVideo('mark-moment');
    if (!(video instanceof HTMLVideoElement)) {
      setCornerFeedbackPrompt('暂未识别播放进度', 'mark-unavailable', 1600);
      scheduleSync(`mark-unavailable:${source}`);
      return false;
    }

    activeVideo = video;
    const currentTime = Number(video.currentTime || 0);
    if (!Number.isFinite(currentTime) || currentTime < 0) {
      setCornerFeedbackPrompt('暂未识别播放进度', 'mark-unavailable', 1600);
      scheduleSync(`mark-unavailable:${source}`);
      return false;
    }

    const pageUrl = location.href;
    const createdAt = Date.now();
    const savedMarks = await saveMarkForUrl(pageUrl, {
      timeSec: Math.floor(currentTime),
      label: formatPlaybackTime(currentTime),
      createdAt
    });
    const latestMark = getLatestMark(savedMarks);
    if (!latestMark) {
      setCornerFeedbackPrompt('回看点保存失败', 'mark-failed', 1600);
      scheduleSync(`mark-failed:${source}`);
      return false;
    }

    setCornerFeedbackPrompt(`回看点已存 ${latestMark.label}`, 'mark-saved', 1800);
    const resumePoint = await persistResumePoint(video, { force: true });
    utilitySummaryCacheKey = pageUrl;
    utilitySummaryCache = buildUtilitySummaryFromData({
      marks: savedMarks,
      resumePoint
    });
    scheduleSync(`mark:${source}`);
    return true;
  }

  async function handleReplayLatestMark(source = 'runtime') {
    const pageUrl = location.href;
    const summary = await readUtilitySummaryCached(pageUrl, { force: true });
    const latestMark = summary.latestMark;
    if (!(latestMark && Number.isFinite(Number(latestMark.timeSec)))) {
      setCornerFeedbackPrompt('还没有回看点', 'replay-empty', 1500);
      scheduleSync(`replay-empty:${source}`);
      return false;
    }

    const video = activeVideo instanceof HTMLVideoElement
      ? activeVideo
      : detectPrimaryVideo('replay-latest-mark');
    if (!(video instanceof HTMLVideoElement)) {
      setCornerFeedbackPrompt('暂未识别播放器', 'replay-unavailable', 1600);
      scheduleSync(`replay-unavailable:${source}`);
      return false;
    }

    activeVideo = video;
    const targetTime = Math.max(0, Math.floor(Number(latestMark.timeSec)));
    try {
      video.currentTime = targetTime;
      if (video.paused) {
        await video.play?.().catch(() => null);
      }
      setCornerFeedbackPrompt(`回到 ${latestMark.label}`, 'replay-jump', 1500);
      scheduleSync(`replay:${source}`);
      return true;
    } catch {
      setCornerFeedbackPrompt('回看失败', 'replay-failed', 1600);
      scheduleSync(`replay-failed:${source}`);
      return false;
    }
  }

  function getNextSizeScale(value = 1) {
    const current = normalizeSizeScale(value);
    if (current < 1.08) return 1.16;
    if (current < 1.2) return 1.25;
    return 1;
  }

  async function handleOverlayAction(action = '') {
    if (action === 'mark') {
      return handleMarkMoment('overlay-panel');
    }

    if (action === 'replay') {
      return handleReplayLatestMark('overlay-panel');
    }

    if (action === 'size') {
      const nextSizeScale = getNextSizeScale(settings.sizeScale);
      settings = await patchSettings({ sizeScale: nextSizeScale });
      setCornerFeedbackPrompt(`大小 ${Math.round(nextSizeScale * 100)}%`, 'size-changed', 1500);
      scheduleSync('overlay:size');
      return true;
    }

    if (action === 'hide') {
      settings = await patchSettings({ enabled: false });
      setCornerFeedbackPrompt('Aura 已隐藏', 'hidden', 800);
      scheduleSync('overlay:hide');
      return true;
    }

    return false;
  }

  async function handleRuntimeMessage(message) {
    if (!isMarkMomentMessage(message)) return;
    await handleMarkMoment(message.source || 'runtime');
  }

  function clearVisualTargets() {
    activeContainer = null;
    activeVideo = null;
    overlay.teardown();
    lifecycle.clearTargets();
  }

  function isLowSignalSyncReason(reason = '') {
    if (!reason) return false;
    return LOW_SIGNAL_SYNC_REASONS.has(reason);
  }

  function getReportedReason(reason = '') {
    if (!isLowSignalSyncReason(reason)) {
      lastMeaningfulReason = reason || lastMeaningfulReason;
      return reason;
    }

    return lastMeaningfulReason || reason;
  }

  function shouldReplacePendingReason(nextReason = '', currentReason = '') {
    if (!currentReason) return true;

    const nextIsLowSignal = isLowSignalSyncReason(nextReason);
    const currentIsLowSignal = isLowSignalSyncReason(currentReason);

    if (!currentIsLowSignal && nextIsLowSignal) {
      return false;
    }

    if (currentIsLowSignal && !nextIsLowSignal) {
      return true;
    }

    return true;
  }

  function getReasonCooldown(reason = '') {
    return SYNC_REASON_COOLDOWNS[reason] ?? 0;
  }

  function shouldSkipReasonDueToCooldown(reason = '') {
    const cooldownMs = getReasonCooldown(reason);
    if (!(cooldownMs > 0)) return false;

    const now = Date.now();
    const lastQueuedAt = lastQueuedAtByReason.get(reason) || 0;
    if (now - lastQueuedAt < cooldownMs) {
      return true;
    }

    lastQueuedAtByReason.set(reason, now);
    return false;
  }

  function writePassiveStatus(state, message, reason, extra = {}) {
    const reportedReason = getReportedReason(reason);
    const passiveStatus = {
      renderActive: false,
      state,
      message,
      enabled: settings.enabled,
      mode: settings.mode,
      controlsVisible: false,
      adActive: false,
      attentionActive: false,
      pointerAccepted: false,
      pointerReason: 'inactive',
      pointerAgeMs: null,
      lastSyncReason: reportedReason,
      ...extra
    };
    statusReporter.clearStatus({
      state,
      message,
      settings,
      title: extractShowTitle(),
      skinContext: extractShowContext(),
      extra: {
        moduleLoadState: runtimeDiagnostics.moduleLoadState,
        registryLoadState: runtimeDiagnostics.registryLoadState,
        syncState: 'idle',
        ...passiveStatus
      }
    });
    markRuntimeDiagnostic({ status: passiveStatus });
  }

  function reportRuntimeFailure({ stage, message, error, reason }) {
    const serialized = serializeError(error);
    const hadVideo = activeVideo instanceof HTMLVideoElement;
    const hadContainer = activeContainer instanceof HTMLElement;
    const reportedReason = getReportedReason(reason);

    clearVisualTargets();
    console.warn(`[Aura runtime] ${message}:`, error);

    statusReporter.commitStatus({
      renderActive: false,
      state: RUNTIME_STATES.ERROR,
      message,
      enabled: settings.enabled,
      mode: settings.mode,
      title: extractShowTitle(),
      skinContext: extractShowContext(),
      videoDetected: hadVideo,
      containerDetected: hadContainer,
      containerSource: 'none',
      playbackMode: 'windowed',
      playbackState: 'playing',
      controlsVisible: false,
      adActive: false,
      lastSyncReason: reportedReason,
      moduleLoadState: runtimeDiagnostics.moduleLoadState,
      registryLoadState: runtimeDiagnostics.registryLoadState,
      syncState: 'failed',
      errorStage: stage,
      errorMessage: serialized.message
    });

    markRuntimeDiagnostic({
      stage,
      state: RUNTIME_STATES.ERROR,
      lastSyncReason: reportedReason,
      syncState: 'failed',
      errorStage: stage,
      errorMessage: serialized.message
    });
  }

  async function loadSettings() {
    settings = await readSettings();
    return settings;
  }

  async function ensureRegistryLoaded() {
    markRuntimeDiagnostic({
      stage: 'registry-load',
      state: 'booting',
      registryLoadState: 'pending'
    });

    skinRegistry = await loadSkinRegistry();

    markRuntimeDiagnostic({
      stage: 'registry-load',
      state: 'booting',
      registryLoadState: 'loaded'
    });
  }

  function scheduleSync(reason = 'unknown') {
    if (disposed) return;
    if (!isExtensionContextAlive()) {
      disposeLocalOnly('extension-context-invalidated');
      return;
    }
    if (shouldSkipReasonDueToCooldown(reason)) return;
    if (!syncQueued || shouldReplacePendingReason(reason, pendingReason)) {
      pendingReason = reason;
    }
    if (syncQueued || syncInFlight) return;
    syncQueued = true;

    window.setTimeout(() => {
      syncQueued = false;
      void flushSyncQueue();
    }, 0);
  }

  async function flushSyncQueue() {
    if (disposed || syncInFlight) return;
    syncInFlight = true;
    const reason = pendingReason || 'unknown';
    pendingReason = '';

    try {
      await sync(reason);
    } finally {
      syncInFlight = false;
      if (!disposed && pendingReason) {
        scheduleSync(pendingReason);
      }
    }
  }

  async function sync(reason = 'unknown') {
    if (disposed) return;
    if (!isExtensionContextAlive()) {
      disposeLocalOnly('extension-context-invalidated');
      return;
    }

    try {
      refreshSiteAdapter();
      const reportedReason = getReportedReason(reason);

      markRuntimeDiagnostic({
        stage: 'sync',
        state: 'running',
        lastSyncReason: reportedReason,
        syncState: 'running',
        errorStage: runtimeDiagnostics.errorStage === 'sync' ? '' : runtimeDiagnostics.errorStage,
        errorMessage: runtimeDiagnostics.errorStage === 'sync' ? '' : runtimeDiagnostics.errorMessage
      });

      if (!settings.enabled) {
        clearVisualTargets();
        writePassiveStatus(RUNTIME_STATES.DISABLED, 'Aura 已关闭', reason);
        markRuntimeDiagnostic({
          state: RUNTIME_STATES.DISABLED,
          syncState: 'idle',
          errorStage: '',
          errorMessage: ''
        });
        return;
      }

      if (!adapter) {
        clearVisualTargets();
        writePassiveStatus(RUNTIME_STATES.IDLE, '当前页面未适配', reason);
        markRuntimeDiagnostic({
          state: RUNTIME_STATES.IDLE,
          syncState: 'idle',
          errorStage: '',
          errorMessage: ''
        });
        return;
      }

      if (!adapter.isPlaybackPage(location.href) && !hasVisibleSiteShell()) {
        clearVisualTargets();
        writePassiveStatus(RUNTIME_STATES.IDLE, `等待${adapter.label}播放页`, reason);
        markRuntimeDiagnostic({
          state: RUNTIME_STATES.IDLE,
          syncState: 'idle',
          errorStage: '',
          errorMessage: ''
        });
        return;
      }

      const containerMatch = detectPlayerContainer(reason);
      if (!(containerMatch?.element instanceof HTMLElement)) {
        clearVisualTargets();
        writePassiveStatus(RUNTIME_STATES.WAITING_CONTAINER, '等待播放器容器', reason, {
          videoDetected: detectPrimaryVideo(reason) instanceof HTMLVideoElement
        });
        markRuntimeDiagnostic({
          state: RUNTIME_STATES.WAITING_CONTAINER,
          syncState: 'idle',
          errorStage: '',
          errorMessage: ''
        });
        return;
      }

      const video = detectPrimaryVideo(reason);
      activeContainer = containerMatch.element;
      activeVideo = video instanceof HTMLVideoElement ? video : null;
      lifecycle.setTargets(activeContainer, activeVideo);

      const pageUrl = location.href;
      const title = extractShowTitle();
      const showContext = extractShowContext(title);
      const { skin, source: skinSource } = resolveSkin(skinRegistry, settings, showContext);
      const visualState = buildVisualState(activeContainer, activeVideo);
      const playbackControl = getPlaybackControlCapability(activeVideo);
      const layout = computeLayout(activeContainer.getBoundingClientRect(), visualState, skin, settings);
      await persistResumePoint(activeVideo);
      const utilitySummary = await readUtilitySummaryCached(pageUrl);
      const infoLayer = buildInfoLayerModel({
        skin,
        showContext,
        prompt: getActiveCornerFeedbackPrompt(),
        utilitySummary,
        playbackControl
      });

      overlay.render({
        container: activeContainer,
        skin,
        layout,
        visualState,
        mode: settings.mode,
        infoLayer
      });

      statusReporter.renderStatus({
        title,
        showContext,
        container: activeContainer,
        containerSource: containerMatch.source,
        video: activeVideo,
        skin,
        skinSource,
        visualState,
        reason: reportedReason,
        settings,
        diagnostics: {
          cornerSemanticLabel: infoLayer.semanticLabel,
          cornerFeedbackPrompt: infoLayer.feedbackText,
          cornerFeedbackPromptType: infoLayer.feedbackType,
          pointerAccepted: visualState.pointerDebug?.accepted === true,
          pointerReason: visualState.pointerDebug?.reason || '',
          pointerAgeMs: visualState.pointerDebug?.ageMs ?? null,
          pointerX: visualState.pointerDebug?.x ?? null,
          pointerY: visualState.pointerDebug?.y ?? null,
          pointerTarget: visualState.pointerDebug?.target || '',
          pointerContainerRect: visualState.pointerDebug?.containerRect
            ? `${visualState.pointerDebug.containerRect.width}x${visualState.pointerDebug.containerRect.height}@${visualState.pointerDebug.containerRect.left},${visualState.pointerDebug.containerRect.top}`
            : '',
          pointerVideoRect: visualState.pointerDebug?.videoRect
            ? `${visualState.pointerDebug.videoRect.width}x${visualState.pointerDebug.videoRect.height}@${visualState.pointerDebug.videoRect.left},${visualState.pointerDebug.videoRect.top}`
            : '',
          markCount: utilitySummary.markCount,
          recentMarkLabel: utilitySummary.recentMarkLabel,
          resumePointLabel: utilitySummary.resumePointLabel,
          canMarkMoment: infoLayer.canMarkMoment,
          canReplayLatestMark: infoLayer.canReplayLatestMark,
          playbackControlReason: playbackControl.reason,
          errorStage: '',
          moduleLoadState: runtimeDiagnostics.moduleLoadState,
          registryLoadState: runtimeDiagnostics.registryLoadState,
          syncState: 'ok'
        }
      });

      markRuntimeDiagnostic({
        state: RUNTIME_STATES.RENDERED,
        syncState: 'ok',
        errorStage: '',
        errorMessage: '',
        status: {
          renderActive: true,
          state: RUNTIME_STATES.RENDERED,
          playbackMode: visualState.playbackMode,
          playbackState: visualState.playbackState,
          controlsVisible: visualState.controlsVisible,
          adActive: visualState.adActive,
          attentionActive: visualState.attentionActive,
          pointerAccepted: visualState.pointerDebug?.accepted === true,
          pointerReason: visualState.pointerDebug?.reason || '',
          pointerAgeMs: visualState.pointerDebug?.ageMs ?? null,
          pointerX: visualState.pointerDebug?.x ?? null,
          pointerY: visualState.pointerDebug?.y ?? null,
          pointerTarget: visualState.pointerDebug?.target || '',
          pointerContainerRect: visualState.pointerDebug?.containerRect || null,
          pointerVideoRect: visualState.pointerDebug?.videoRect || null,
          canMarkMoment: infoLayer.canMarkMoment,
          canReplayLatestMark: infoLayer.canReplayLatestMark,
          playbackControlReason: playbackControl.reason
        }
      });
    } catch (error) {
      reportRuntimeFailure({
        stage: 'sync',
        message: 'Aura 同步失败',
        error,
        reason
      });
    }
  }

  async function handleSettingsChanged() {
    await loadSettings();
    scheduleSync('settings');
  }

  async function handleForceSync(reason = 'force-sync') {
    await loadSettings();
    scheduleSync(reason);
  }

  function dispose(reason = 'dispose', { reportStatus = true } = {}) {
    if (disposed) return;
    disposed = true;

    lifecycle.stop();
    clearVisualTargets();
    clearPromptTimer();

    if (reportStatus && isExtensionContextAlive()) {
      statusReporter.clearStatus({
        state: RUNTIME_STATES.IDLE,
        message: `runtime disposed: ${reason}`,
        settings,
        title: extractShowTitle(),
        skinContext: extractShowContext(),
        extra: {
          lastSyncReason: reason,
          moduleLoadState: runtimeDiagnostics.moduleLoadState,
          registryLoadState: runtimeDiagnostics.registryLoadState,
          syncState: 'disposed'
        }
      });
    }

    markRuntimeDiagnostic({
      active: false,
      stage: 'disposed',
      state: RUNTIME_STATES.IDLE,
      lastSyncReason: reason,
      syncState: 'disposed'
    });

    globalThis.__AURA_CORNER_DECOR_ACTIVE__ = false;
    globalThis.__AURA_CORNER_DECOR_DISPOSE__ = null;
  }

  async function init() {
    try {
      globalThis.__AURA_CORNER_DECOR_ACTIVE__ = true;
      globalThis.__AURA_CORNER_DECOR_DISPOSE__ = dispose;

      markRuntimeDiagnostic({
        stage: 'init',
        state: 'booting',
        lastSyncReason: 'init'
      });

      await Promise.all([ensureRegistryLoaded(), loadSettings()]);
      if (disposed) return;

      refreshSiteAdapter();
      lifecycle.start();

      markRuntimeDiagnostic({
        stage: 'init',
        state: 'ready',
        syncState: 'idle',
        lastSyncReason: 'init'
      });

      scheduleSync('init');
    } catch (error) {
      reportRuntimeFailure({
        stage: 'init',
        message: 'Aura 初始化失败',
        error,
        reason: 'init'
      });
    }
  }

  void init();

  return {
    dispose,
    syncNow(reason = 'manual-sync') {
      void handleForceSync(reason);
    }
  };
}
