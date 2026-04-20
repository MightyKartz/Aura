import { computeLayout } from './layout.js';
import { createContentLifecycle } from './content-lifecycle.js';
import { createOverlayManager } from './content-overlay.js';
import { DEFAULT_SETTINGS, readSettings } from './settings.js';
import { createFallbackRegistry, loadSkinRegistry, resolveSkin } from './skin-registry.js';
import { findSiteAdapter } from './site-adapters.js';
import { createStatusReporter, RUNTIME_STATES } from './status.js';

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
  const LOW_SIGNAL_SYNC_REASONS = new Set(['mutation', 'heartbeat', 'pointer', 'pointer-settle', 'resize-observer']);
  let disposed = false;
  let syncQueued = false;
  let pendingReason = 'init';
  let lastMeaningfulReason = 'init';
  let settings = { ...DEFAULT_SETTINGS };
  let skinRegistry = createFallbackRegistry();
  let activeContainer = null;
  let activeVideo = null;
  let adapter = null;
  let detector = null;

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

  const overlay = createOverlayManager();
  const statusReporter = createStatusReporter({
    frameId,
    getSiteId: () => adapter?.id ?? 'unsupported'
  });
  const lifecycle = createContentLifecycle({
    scheduleSync,
    onSettingsChanged: handleSettingsChanged,
    onForceSync: handleForceSync,
    onPageHide: dispose
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

  function refreshSiteAdapter() {
    const nextAdapter = findSiteAdapter(location.href);
    if (adapter?.id === nextAdapter?.id) return;

    adapter = nextAdapter;
    detector = adapter?.createDetector({
      getActiveContainer: () => activeContainer,
      getLastPointerAt: () => lifecycle.getLastPointerAt()
    }) ?? null;
  }

  function extractShowTitle() {
    return detector?.extractShowTitle?.() ?? '';
  }

  function extractShowContext(title = '') {
    return detector?.extractShowContext?.(title) ?? '';
  }

  function detectPrimaryVideo() {
    return detector?.detectPrimaryVideo?.() ?? null;
  }

  function detectPlayerContainer() {
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

  function hasRecentPointerActivity() {
    const lastPointerAt = lifecycle.getLastPointerAt();
    return lastPointerAt > 0 && (Date.now() - lastPointerAt) < 1800;
  }

  function buildVisualState(container, video) {
    return {
      playbackMode: detectPlaybackMode(container, video),
      playbackState: detectPlaybackState(video),
      controlsVisible: shouldLiftForControls(container, video),
      adActive: isAdvertisementActive(container),
      attentionActive: hasRecentPointerActivity()
    };
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

  function writePassiveStatus(state, message, reason, extra = {}) {
    const reportedReason = getReportedReason(reason);
    statusReporter.clearStatus({
      state,
      message,
      settings,
      title: extractShowTitle(),
      skinContext: extractShowContext(),
      extra: {
        lastSyncReason: reportedReason,
        moduleLoadState: runtimeDiagnostics.moduleLoadState,
        registryLoadState: runtimeDiagnostics.registryLoadState,
        syncState: 'idle',
        ...extra
      }
    });
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
    if (!syncQueued || shouldReplacePendingReason(reason, pendingReason)) {
      pendingReason = reason;
    }
    if (syncQueued) return;
    syncQueued = true;

    requestAnimationFrame(() => {
      syncQueued = false;
      sync(pendingReason);
    });
  }

  function sync(reason = 'unknown') {
    if (disposed) return;

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

      const containerMatch = detectPlayerContainer();
      if (!(containerMatch?.element instanceof HTMLElement)) {
        clearVisualTargets();
        writePassiveStatus(RUNTIME_STATES.WAITING_CONTAINER, '等待播放器容器', reason, {
          videoDetected: detectPrimaryVideo() instanceof HTMLVideoElement
        });
        markRuntimeDiagnostic({
          state: RUNTIME_STATES.WAITING_CONTAINER,
          syncState: 'idle',
          errorStage: '',
          errorMessage: ''
        });
        return;
      }

      const video = detectPrimaryVideo();
      activeContainer = containerMatch.element;
      activeVideo = video instanceof HTMLVideoElement ? video : null;
      lifecycle.setTargets(activeContainer, activeVideo);

      const title = extractShowTitle();
      const showContext = extractShowContext(title);
      const { skin, source: skinSource } = resolveSkin(skinRegistry, settings, showContext);
      const visualState = buildVisualState(activeContainer, activeVideo);
      const layout = computeLayout(activeContainer.getBoundingClientRect(), visualState);

      overlay.render({
        container: activeContainer,
        skin,
        layout,
        visualState,
        mode: settings.mode
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
        errorMessage: ''
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

  function dispose(reason = 'dispose') {
    if (disposed) return;
    disposed = true;

    lifecycle.stop();
    clearVisualTargets();

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
