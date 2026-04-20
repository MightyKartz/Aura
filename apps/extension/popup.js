import { sendForceSyncToTab } from './runtime/messages.js';
import { DEFAULT_SETTINGS, STORAGE_KEY, readSettings, writeSettings } from './runtime/settings.js';
import { loadSkinRegistry, getDefaultSkin, getSkinById } from './runtime/skin-registry.js';
import { getSiteSupport } from './runtime/site-adapters.js';
import { STATUS_KEY, readStatus, RUNTIME_STATES, statusBelongsToUrl } from './runtime/status.js';

let skinRegistry = {
  version: 1,
  defaultSkinId: 'cat-default-v1',
  skins: []
};

let currentSettings = { ...DEFAULT_SETTINGS };
let currentStatus = null;
let activeTab = null;
let viewRefreshVersion = 0;
let transientRefreshIntervalId = 0;
let transientRefreshRemaining = 0;
const tabNavigationStartedAt = new Map();
let lastAppliedSnapshot = {
  settings: currentSettings,
  tab: activeTab,
  status: currentStatus
};
let lastAppliedSnapshotFingerprint = '';

const STATUS_SETTLE_ATTEMPTS = 12;
const STATUS_SETTLE_DELAY_MS = 250;
const TRANSIENT_REFRESH_INTERVAL_MS = 200;
const TRANSIENT_REFRESH_STEPS = 6;

const enabledInput = document.getElementById('enabled');
const supportStatus = document.getElementById('supportStatus');
const renderStateBadgeElement = document.getElementById('renderStateBadge');
const showTitle = document.getElementById('showTitle');
const statusText = document.getElementById('statusText');
const currentSkin = document.getElementById('currentSkin');
const skinSourceBadge = document.getElementById('skinSourceBadge');
const playbackModeText = document.getElementById('playbackModeText');
const themeModeSelect = document.getElementById('themeMode');
const themeModeHint = document.getElementById('themeModeHint');
const skinSelect = document.getElementById('skinSelect');
const skinDescription = document.getElementById('skinDescription');
const modeButtons = Array.from(document.querySelectorAll('[data-mode]'));
const diagnosticVideoDetected = document.getElementById('diagnosticVideoDetected');
const diagnosticContainerSource = document.getElementById('diagnosticContainerSource');
const diagnosticControlsVisible = document.getElementById('diagnosticControlsVisible');
const diagnosticAdActive = document.getElementById('diagnosticAdActive');
const diagnosticSkinContext = document.getElementById('diagnosticSkinContext');
const diagnosticLastSyncReason = document.getElementById('diagnosticLastSyncReason');
const diagnosticModuleLoadState = document.getElementById('diagnosticModuleLoadState');
const diagnosticRegistryLoadState = document.getElementById('diagnosticRegistryLoadState');
const diagnosticSyncState = document.getElementById('diagnosticSyncState');
const diagnosticErrorStage = document.getElementById('diagnosticErrorStage');
const diagnosticErrorMessage = document.getElementById('diagnosticErrorMessage');
const diagnosticPageUrl = document.getElementById('diagnosticPageUrl');

function formatValue(value, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function formatBoolean(value) {
  if (value === null || value === undefined) return '--';
  return value ? 'true' : 'false';
}

function getFallbackSkin() {
  return getDefaultSkin(skinRegistry);
}

function getFallbackSkinId() {
  return getFallbackSkin()?.id || skinRegistry.defaultSkinId || '';
}

function getDisplaySkinId(status = currentStatus) {
  if (currentSettings.themeMode === 'manual') {
    return currentSettings.selectedSkinId || getFallbackSkinId();
  }

  return status?.skinId || getFallbackSkinId();
}

function getDisplaySkin(status = currentStatus) {
  return getSkinById(skinRegistry, getDisplaySkinId(status)) ?? getFallbackSkin();
}

function isExtensionPageUrl(url = '') {
  return /^chrome-extension:\/\//i.test(String(url || ''));
}

function isBrowsablePageUrl(url = '') {
  return /^https?:\/\//i.test(String(url || ''));
}

function isEligibleContentTab(tab, excludedTabId = null) {
  return Number.isInteger(tab?.id)
    && tab.id !== excludedTabId
    && !isExtensionPageUrl(tab?.url)
    && isBrowsablePageUrl(tab?.url);
}

function markTabNavigationStarted(tabId) {
  if (!Number.isInteger(tabId)) return;
  tabNavigationStartedAt.set(tabId, Date.now());
}

function clearTabNavigationBoundary(tabId) {
  if (!Number.isInteger(tabId)) return;
  tabNavigationStartedAt.delete(tabId);
}

function getTabNavigationStartedAt(tabId) {
  if (!Number.isInteger(tabId)) return 0;
  return tabNavigationStartedAt.get(tabId) ?? 0;
}

async function getActiveTab() {
  const currentPopupTab = chrome.tabs.getCurrent
    ? await chrome.tabs.getCurrent().catch(() => null)
    : null;
  const excludedTabId = currentPopupTab?.id ?? null;

  const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const activeContentTab = activeTabs.find((tab) => isEligibleContentTab(tab, excludedTabId));
  if (activeContentTab) return activeContentTab;

  const windowTabs = await chrome.tabs.query({ lastFocusedWindow: true });
  const recentWindowContentTab = windowTabs
    .filter((tab) => isEligibleContentTab(tab, excludedTabId))
    .sort((left, right) => (right.lastAccessed || 0) - (left.lastAccessed || 0))[0];
  if (recentWindowContentTab) return recentWindowContentTab;

  const allTabs = await chrome.tabs.query({});
  const recentContentTab = allTabs
    .filter((tab) => isEligibleContentTab(tab, excludedTabId))
    .sort((left, right) => (right.lastAccessed || 0) - (left.lastAccessed || 0))[0];

  return recentContentTab ?? null;
}

function renderSupportPill(text, tone) {
  supportStatus.textContent = text;
  supportStatus.className = `pill ${tone}`;
}

function renderSourceBadge(source = '') {
  if (source === 'manual') {
    skinSourceBadge.className = 'badge badge--manual';
    skinSourceBadge.textContent = '手动';
    return;
  }

  if (source.startsWith('auto')) {
    skinSourceBadge.className = 'badge badge--auto';
    skinSourceBadge.textContent = '自动';
    return;
  }

  skinSourceBadge.className = 'badge badge--default';
  skinSourceBadge.textContent = '默认';
}

function renderRuntimeBadge(status) {
  let tone = 'pending';
  let label = '待显示';

  if (!currentSettings.enabled) {
    tone = 'inactive';
    label = '已关闭';
  } else if (status?.state === RUNTIME_STATES.DISABLED) {
    tone = 'pending';
    label = '同步中';
  } else if (status?.state === RUNTIME_STATES.ERROR) {
    tone = 'inactive';
    label = '异常';
  } else if (status?.renderActive) {
    tone = 'active';
    label = '已显示';
  } else if (status?.state === RUNTIME_STATES.WAITING_CONTAINER) {
    tone = 'pending';
    label = '等播放器';
  } else if (status) {
    tone = 'inactive';
    label = '未显示';
  }

  renderStateBadgeElement.className = `state-badge state-badge--${tone}`;
  renderStateBadgeElement.textContent = label;
}

function renderModeButtons(mode) {
  for (const button of modeButtons) {
    button.classList.toggle('is-active', button.dataset.mode === mode);
  }
}

function populateSkinSelect() {
  skinSelect.innerHTML = '';

  for (const skin of skinRegistry.skins) {
    const option = document.createElement('option');
    option.value = skin.id;
    option.textContent = skin.name;
    skinSelect.appendChild(option);
  }
}

function renderSkinDescription(skinId) {
  const skin = getSkinById(skinRegistry, skinId);
  if (!skin) {
    skinDescription.textContent = '皮肤信息加载中...';
    return;
  }

  const tags = Array.isArray(skin.tags) && skin.tags.length > 0
    ? `标签：${skin.tags.join(' / ')}`
    : '';
  skinDescription.textContent = [skin.description, tags].filter(Boolean).join(' ｜ ');
}

function updateSkinSelectionUI(status = currentStatus) {
  const skin = getDisplaySkin(status);
  if (!skin) return;
  skinSelect.value = skin.id;
  renderSkinDescription(skin.id);
}

function renderThemeModeUI() {
  themeModeSelect.value = currentSettings.themeMode;
  skinSelect.disabled = currentSettings.themeMode !== 'manual';
  themeModeHint.textContent = currentSettings.themeMode === 'manual'
    ? '手动模式下始终使用指定皮肤。'
    : '根据剧名和页面标签推荐更合适的皮肤。';
}

function renderDiagnostics(status) {
  diagnosticVideoDetected.textContent = formatBoolean(status?.videoDetected);
  diagnosticContainerSource.textContent = formatValue(status?.containerSource);
  diagnosticControlsVisible.textContent = formatBoolean(status?.controlsVisible);
  diagnosticAdActive.textContent = formatBoolean(status?.adActive);
  diagnosticSkinContext.textContent = formatValue(status?.skinContext);
  diagnosticLastSyncReason.textContent = formatValue(status?.lastSyncReason);
  diagnosticModuleLoadState.textContent = formatValue(status?.moduleLoadState);
  diagnosticRegistryLoadState.textContent = formatValue(status?.registryLoadState);
  diagnosticSyncState.textContent = formatValue(status?.syncState);
  diagnosticErrorStage.textContent = formatValue(status?.errorStage);
  diagnosticErrorMessage.textContent = formatValue(status?.errorMessage);
  diagnosticPageUrl.textContent = formatValue(status?.pageUrl);
}

function getDefaultSkinSource() {
  return currentSettings.themeMode === 'manual' ? 'manual' : 'default';
}

function getDisplaySkinName(status = currentStatus) {
  return status?.skinName || getDisplaySkin(status)?.name || '默认小猫';
}

function getDisplaySkinSource(status = currentStatus) {
  return status?.skinSource || getDefaultSkinSource();
}

function renderPlaybackSummary({
  title,
  skinName = getDisplaySkinName(),
  skinSource = getDisplaySkinSource(),
  playbackMode = '--',
  detail
}) {
  showTitle.textContent = title;
  currentSkin.textContent = skinName;
  renderSourceBadge(skinSource);
  playbackModeText.textContent = playbackMode;
  statusText.textContent = detail;
}

function renderActiveTabState() {
  const support = getSiteSupport(activeTab?.url || '');

  renderRuntimeBadge(currentStatus);
  renderDiagnostics(currentStatus);
  updateSkinSelectionUI(currentStatus);

  if (!activeTab) {
    renderSupportPill('未找到页面', 'pill--neutral');
    renderPlaybackSummary({
      title: '等待中...',
      detail: '当前没有可用的活动标签页。'
    });
    return;
  }

  if (!support.supported) {
    renderSupportPill('当前页未适配', 'pill--neutral');
    renderPlaybackSummary({
      title: '等待腾讯视频',
      detail: 'Aura 当前先稳定支持腾讯视频播放页。'
    });
    return;
  }

  if (!support.playback) {
    renderSupportPill('腾讯视频非播放页', 'pill--inactive');
    renderPlaybackSummary({
      title: '等待进入播放页',
      detail: '进入播放页后，角落挂件会自动出现。'
    });
    return;
  }

  renderSupportPill('腾讯视频已适配', 'pill--supported');

  if (!currentSettings.enabled) {
    renderPlaybackSummary({
      title: currentStatus?.title || '已关闭',
      skinName: getDisplaySkinName(currentStatus),
      skinSource: getDisplaySkinSource(currentStatus),
      playbackMode: formatValue(currentStatus?.playbackMode),
      detail: 'Aura 已关闭'
    });
    return;
  }

  if (!currentStatus) {
    renderPlaybackSummary({
      title: '识别中...',
      detail: '正在等待当前播放页完成播放器识别。'
    });
    return;
  }

  if (currentStatus.state === RUNTIME_STATES.DISABLED) {
    renderPlaybackSummary({
      title: currentStatus.title || '识别中...',
      skinName: getDisplaySkinName(currentStatus),
      skinSource: getDisplaySkinSource(currentStatus),
      playbackMode: formatValue(currentStatus.playbackMode),
      detail: '正在重新连接当前播放页...'
    });
    return;
  }

  const sharedSummary = {
    title: currentStatus.title || '未识别',
    skinName: getDisplaySkinName(currentStatus),
    skinSource: getDisplaySkinSource(currentStatus),
    playbackMode: formatValue(currentStatus.playbackMode)
  };

  if (currentStatus.state === RUNTIME_STATES.ERROR) {
    renderPlaybackSummary({
      ...sharedSummary,
      detail: currentStatus.errorStage
        ? `运行异常：${currentStatus.errorStage}`
        : (currentStatus.message || '运行异常')
    });
    return;
  }

  if (currentStatus.renderActive) {
    renderPlaybackSummary({
      ...sharedSummary,
      detail: currentStatus.adActive
        ? '当前处于广告态，挂件会自动弱化。'
        : '当前挂件已显示，控件出现时会自动减弱。'
    });
    return;
  }

  renderPlaybackSummary({
    ...sharedSummary,
    detail: currentStatus.message || '正在等待播放器稳定下来。'
  });
}

function isStatusFreshForTab(status, tab) {
  const navigationStartedAt = getTabNavigationStartedAt(tab?.id);
  if (!navigationStartedAt) return true;

  const statusUpdatedAt = Number(status?.updatedAt || 0);
  if (statusUpdatedAt >= navigationStartedAt) {
    clearTabNavigationBoundary(tab?.id);
    return true;
  }

  return false;
}

function applyPopupSnapshot({ settings, tab, status }) {
  const fingerprint = JSON.stringify({
    settings,
    tab: tab
      ? {
        id: tab.id ?? null,
        url: tab.url ?? '',
        title: tab.title ?? '',
        lastAccessed: tab.lastAccessed ?? 0,
        status: tab.status ?? ''
      }
      : null,
    status: status
      ? {
        pageUrl: status.pageUrl ?? '',
        state: status.state ?? '',
        renderActive: Boolean(status.renderActive),
        enabled: Boolean(status.enabled),
        updatedAt: status.updatedAt ?? 0,
        lastSyncReason: status.lastSyncReason ?? ''
      }
      : null
  });

  if (fingerprint === lastAppliedSnapshotFingerprint) {
    return;
  }

  lastAppliedSnapshotFingerprint = fingerprint;
  lastAppliedSnapshot = { settings, tab, status };
  currentSettings = settings;
  activeTab = tab;
  currentStatus = status;
  enabledInput.checked = currentSettings.enabled;
  renderModeButtons(currentSettings.mode);
  renderThemeModeUI();
  updateSkinSelectionUI();
  renderActiveTabState();
}

async function readPopupSnapshot() {
  const [settings, tab, status] = await Promise.all([
    readSettings(),
    getActiveTab(),
    readStatus()
  ]);

  const statusMatchesTab = statusBelongsToUrl(status, tab?.url || '');
  const nextStatus = statusMatchesTab && isStatusFreshForTab(status, tab)
    ? status
    : null;

  return {
    settings,
    tab,
    status: nextStatus
  };
}

async function refreshPopupView() {
  const version = ++viewRefreshVersion;
  const snapshot = await readPopupSnapshot();
  if (version !== viewRefreshVersion) return lastAppliedSnapshot;
  applyPopupSnapshot(snapshot);
  return snapshot;
}

function stopTransientRefreshBurst() {
  if (!transientRefreshIntervalId) return;
  window.clearInterval(transientRefreshIntervalId);
  transientRefreshIntervalId = 0;
  transientRefreshRemaining = 0;
}

function scheduleTransientRefreshBurst(steps = TRANSIENT_REFRESH_STEPS) {
  transientRefreshRemaining = Math.max(transientRefreshRemaining, steps);
  void refreshPopupView();

  if (transientRefreshIntervalId) return;

  transientRefreshIntervalId = window.setInterval(() => {
    transientRefreshRemaining -= 1;
    void refreshPopupView();

    if (transientRefreshRemaining <= 0) {
      stopTransientRefreshBurst();
    }
  }, TRANSIENT_REFRESH_INTERVAL_MS);
}

function snapshotMatchesExpectedState(snapshot, expectedSettings) {
  if (!snapshot || !expectedSettings) return false;
  if (snapshot.settings?.enabled !== expectedSettings.enabled) return false;

  const support = getSiteSupport(snapshot.tab?.url || '');
  if (!support.supported || !support.playback) {
    return true;
  }

  if (!snapshot.status) return false;

  if (!expectedSettings.enabled) {
    return snapshot.status.enabled === false || snapshot.status.state === RUNTIME_STATES.DISABLED;
  }

  return snapshot.status.enabled === true && snapshot.status.state !== RUNTIME_STATES.DISABLED;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function settlePopupView(expectedSettings) {
  let snapshot = lastAppliedSnapshot;

  for (let attempt = 0; attempt < STATUS_SETTLE_ATTEMPTS; attempt += 1) {
    snapshot = await refreshPopupView();
    if (snapshotMatchesExpectedState(snapshot, expectedSettings)) {
      return snapshot;
    }
    await delay(STATUS_SETTLE_DELAY_MS);
  }

  return snapshot;
}

async function syncActiveTab(reason) {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  await sendForceSyncToTab(tab.id, reason);
}

async function updateSettings(nextSettings, reason) {
  const normalizedSettings = await writeSettings(nextSettings);
  await refreshPopupView();
  await syncActiveTab(reason);
  await settlePopupView(normalizedSettings);
}

enabledInput.addEventListener('change', () => {
  void updateSettings(
    {
      ...currentSettings,
      enabled: enabledInput.checked
    },
    'popup:toggle'
  );
});

themeModeSelect.addEventListener('change', () => {
  void updateSettings(
    {
      ...currentSettings,
      themeMode: themeModeSelect.value,
      selectedSkinId: themeModeSelect.value === 'manual'
        ? (skinSelect.value || getFallbackSkinId())
        : ''
    },
    'popup:theme-mode'
  );
});

skinSelect.addEventListener('change', () => {
  renderSkinDescription(skinSelect.value);
  if (themeModeSelect.value !== 'manual') return;

  void updateSettings(
    {
      ...currentSettings,
      selectedSkinId: skinSelect.value || getFallbackSkinId()
    },
    'popup:skin'
  );
});

for (const button of modeButtons) {
  button.addEventListener('click', () => {
    void updateSettings(
      {
        ...currentSettings,
        mode: button.dataset.mode
      },
      'popup:mode'
    );
  });
}

chrome.storage.sync.onChanged?.addListener?.((changes, areaName) => {
  if (areaName !== 'sync' || !changes[STORAGE_KEY]) return;
  scheduleTransientRefreshBurst();
});

chrome.storage.local.onChanged?.addListener?.((changes, areaName) => {
  if (areaName !== 'local' || !changes[STATUS_KEY]) return;
  scheduleTransientRefreshBurst();
});

chrome.tabs.onActivated?.addListener?.(() => {
  scheduleTransientRefreshBurst();
});

chrome.tabs.onUpdated?.addListener?.((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    markTabNavigationStarted(tabId);
  }

  if (changeInfo.status === 'complete' || changeInfo.status === 'loading' || changeInfo.url) {
    scheduleTransientRefreshBurst();
  }
});

window.addEventListener('focus', () => {
  scheduleTransientRefreshBurst();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    scheduleTransientRefreshBurst();
    return;
  }

  stopTransientRefreshBurst();
});

window.addEventListener('beforeunload', () => {
  stopTransientRefreshBurst();
});

void (async function initPopup() {
  skinRegistry = await loadSkinRegistry();
  populateSkinSelect();
  await refreshPopupView();
  scheduleTransientRefreshBurst();
})();
