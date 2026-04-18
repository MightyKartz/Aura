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
let lastAppliedSnapshot = {
  settings: currentSettings,
  tab: activeTab,
  status: currentStatus
};

const STATUS_SETTLE_ATTEMPTS = 12;
const STATUS_SETTLE_DELAY_MS = 250;

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

async function getActiveTab() {
  const tabs = await chrome.tabs.query({});
  const contentTabs = tabs
    .filter((tab) => !isExtensionPageUrl(tab?.url))
    .sort((left, right) => (right.lastAccessed || 0) - (left.lastAccessed || 0));

  return contentTabs[0] ?? null;
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

function renderActiveTabState() {
  const support = getSiteSupport(activeTab?.url || '');

  renderRuntimeBadge(currentStatus);
  renderDiagnostics(currentStatus);
  updateSkinSelectionUI(currentStatus);

  if (!activeTab) {
    renderSupportPill('未找到页面', 'pill--neutral');
    showTitle.textContent = '等待中...';
    currentSkin.textContent = getDisplaySkin()?.name || '默认小猫';
    renderSourceBadge(currentSettings.themeMode === 'manual' ? 'manual' : 'default');
    playbackModeText.textContent = '--';
    statusText.textContent = '当前没有可用的活动标签页。';
    return;
  }

  if (!support.supported) {
    renderSupportPill('当前页未适配', 'pill--neutral');
    showTitle.textContent = '等待腾讯视频';
    currentSkin.textContent = getDisplaySkin()?.name || '默认小猫';
    renderSourceBadge(currentSettings.themeMode === 'manual' ? 'manual' : 'default');
    playbackModeText.textContent = '--';
    statusText.textContent = 'Aura 当前先稳定支持腾讯视频播放页。';
    return;
  }

  if (!support.playback) {
    renderSupportPill('腾讯视频非播放页', 'pill--inactive');
    showTitle.textContent = '等待进入播放页';
    currentSkin.textContent = getDisplaySkin()?.name || '默认小猫';
    renderSourceBadge(currentSettings.themeMode === 'manual' ? 'manual' : 'default');
    playbackModeText.textContent = '--';
    statusText.textContent = '进入播放页后，角落挂件会自动出现。';
    return;
  }

  renderSupportPill('腾讯视频已适配', 'pill--supported');

  if (!currentSettings.enabled) {
    showTitle.textContent = currentStatus?.title || '已关闭';
    currentSkin.textContent = currentStatus?.skinName || getDisplaySkin(currentStatus)?.name || '默认小猫';
    renderSourceBadge(currentStatus?.skinSource || (currentSettings.themeMode === 'manual' ? 'manual' : 'default'));
    playbackModeText.textContent = formatValue(currentStatus?.playbackMode);
    statusText.textContent = 'Aura 已关闭';
    return;
  }

  if (!currentStatus) {
    showTitle.textContent = '识别中...';
    currentSkin.textContent = getDisplaySkin()?.name || '默认小猫';
    renderSourceBadge(currentSettings.themeMode === 'manual' ? 'manual' : 'default');
    playbackModeText.textContent = '--';
    statusText.textContent = '正在等待当前播放页完成播放器识别。';
    return;
  }

  if (currentStatus.state === RUNTIME_STATES.DISABLED) {
    showTitle.textContent = currentStatus.title || '识别中...';
    currentSkin.textContent = currentStatus.skinName || getDisplaySkin(currentStatus)?.name || '默认小猫';
    renderSourceBadge(currentStatus.skinSource || (currentSettings.themeMode === 'manual' ? 'manual' : 'default'));
    playbackModeText.textContent = formatValue(currentStatus.playbackMode);
    statusText.textContent = '正在重新连接当前播放页...';
    return;
  }

  showTitle.textContent = currentStatus.title || '未识别';
  currentSkin.textContent = currentStatus.skinName || getDisplaySkin(currentStatus)?.name || '默认小猫';
  renderSourceBadge(currentStatus.skinSource || (currentSettings.themeMode === 'manual' ? 'manual' : 'default'));
  playbackModeText.textContent = formatValue(currentStatus.playbackMode);

  if (currentStatus.state === RUNTIME_STATES.ERROR) {
    statusText.textContent = currentStatus.errorStage
      ? `运行异常：${currentStatus.errorStage}`
      : (currentStatus.message || '运行异常');
    return;
  }

  if (currentStatus.renderActive) {
    statusText.textContent = currentStatus.adActive
      ? '当前处于广告态，挂件会自动弱化。'
      : '当前挂件已显示，控件出现时会自动减弱。';
    return;
  }

  statusText.textContent = currentStatus.message || '正在等待播放器稳定下来。';
}

function applyPopupSnapshot({ settings, tab, status }) {
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

  return {
    settings,
    tab,
    status: statusBelongsToUrl(status, tab?.url || '') ? status : null
  };
}

async function refreshPopupView() {
  const version = ++viewRefreshVersion;
  const snapshot = await readPopupSnapshot();
  if (version !== viewRefreshVersion) return lastAppliedSnapshot;
  applyPopupSnapshot(snapshot);
  return snapshot;
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
  void refreshPopupView();
});

chrome.storage.local.onChanged?.addListener?.((changes, areaName) => {
  if (areaName !== 'local' || !changes[STATUS_KEY]) return;
  void refreshPopupView();
});

chrome.tabs.onActivated?.addListener?.(() => {
  void refreshPopupView();
});

chrome.tabs.onUpdated?.addListener?.((tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    void refreshPopupView();
  }
});

void (async function initPopup() {
  skinRegistry = await loadSkinRegistry();
  populateSkinSelect();
  await refreshPopupView();
})();
