const STORAGE_KEY = 'aura:mvp:settings';
const STATUS_KEY = 'aura:mvp:status';

const enabledInput = document.getElementById('enabled');
const intensityInput = document.getElementById('intensity');
const themeSelect = document.getElementById('themeSelect');
const modeText = document.getElementById('modeText');
const statusText = document.getElementById('statusText');

let lastToggleAt = 0;

function matchesToggleShortcut(event) {
  const key = event.key.toLowerCase();
  return (event.metaKey && event.altKey && key === 'a') || (event.ctrlKey && event.shiftKey && key === 'a');
}

function intensityToMode(value) {
  if (value <= 0) return '关闭';
  if (value < 35) return '轻微';
  if (value < 70) return '柔和';
  return '沉浸';
}

async function loadSettings() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] ?? { enabled: true, intensity: 45, theme: 'tencent-default' };
  enabledInput.checked = settings.enabled;
  intensityInput.value = String(settings.intensity);
  themeSelect.value = settings.theme;
  modeText.textContent = intensityToMode(settings.intensity);
}

async function loadStatus() {
  const result = await chrome.storage.local.get(STATUS_KEY);
  const status = result[STATUS_KEY];
  if (!status) {
    statusText.textContent = '等待在腾讯视频页面生效（扩展快捷键：Ctrl+Shift+A；页面/Popup：Option+Command+A 或 Ctrl+Shift+A）';
    return;
  }

  const parts = [];
  if (status.title) parts.push(`剧名：${status.title}`);
  if (status.message) parts.push(status.message);
  if (status.autoTheme) parts.push(`自动推荐：${status.autoTheme}`);
  if (typeof status.letterboxTop === 'number' || typeof status.letterboxBottom === 'number') {
    parts.push(`黑边：上 ${status.letterboxTop ?? 0}px / 下 ${status.letterboxBottom ?? 0}px`);
  }
  if (status.debug?.videoCount !== undefined) {
    parts.push(`video:${status.debug.videoCount}`);
  }
  if (status.debug?.hasContainer !== undefined) {
    parts.push(`容器:${status.debug.hasContainer ? '已识别' : '未识别'}`);
  }
  if (status.debug?.intrinsicReady !== undefined) {
    parts.push(`元数据:${status.debug.intrinsicReady ? '已就绪' : '未就绪'}`);
  }
  if (status.debug?.usedContainerFallback !== undefined) {
    parts.push(`容器兜底:${status.debug.usedContainerFallback ? '是' : '否'}`);
  }
  if (status.debug?.symmetricLetterbox !== undefined) {
    parts.push(`对称黑边:${status.debug.symmetricLetterbox ? '是' : '否'}`);
  }
  parts.push('快捷键：Ctrl+Shift+A（扩展） / Option+Command+A（辅助） / Ctrl+Shift+A（页面/Popup）');
  statusText.textContent = parts.join(' ｜ ');
}

async function saveSettings() {
  const settings = {
    enabled: enabledInput.checked,
    intensity: Number(intensityInput.value),
    theme: themeSelect.value,
  };
  modeText.textContent = intensityToMode(settings.intensity);
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  statusText.textContent = '设置已保存，切回腾讯视频页面查看效果（Ctrl+Shift+A / Option+Command+A）';
}

async function toggleEnabledFromShortcut() {
  const now = Date.now();
  if (now - lastToggleAt < 300) return;
  lastToggleAt = now;
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] ?? { enabled: true, intensity: 45, theme: 'tencent-default' };
  const next = { ...settings, enabled: !settings.enabled };
  enabledInput.checked = next.enabled;
  await chrome.storage.sync.set({ [STORAGE_KEY]: next });
  statusText.textContent = `Aura 已${next.enabled ? '开启' : '关闭'}（快捷键触发）`;
}

enabledInput.addEventListener('change', saveSettings);
intensityInput.addEventListener('input', saveSettings);
themeSelect.addEventListener('change', saveSettings);
chrome.storage.local.onChanged?.addListener?.(() => loadStatus());

document.addEventListener('keydown', (event) => {
  if (!matchesToggleShortcut(event)) return;
  event.preventDefault();
  void toggleEnabledFromShortcut();
});

await loadSettings();
await loadStatus();
