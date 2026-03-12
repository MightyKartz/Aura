import {
  THEME_REGISTRY,
  getThemeById,
} from './theme-registry/index.js';

const STORAGE_KEY = 'aura:mvp:settings';
const STATUS_KEY = 'aura:mvp:status';

const enabledInput = document.getElementById('enabled');
const intensityInput = document.getElementById('intensity');
const themeSelect = document.getElementById('themeSelect');
const modeText = document.getElementById('modeText');
const statusText = document.getElementById('statusText');
const debugText = document.getElementById('debugText');
const showTitle = document.getElementById('showTitle');
const recommendedTheme = document.getElementById('recommendedTheme');
const themeDescription = document.getElementById('themeDescription');
const cycleThemeButton = document.getElementById('cycleThemeButton');
const toggleDebugButton = document.getElementById('toggleDebugButton');

let showDebug = false;
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

function populateThemeSelect() {
  themeSelect.innerHTML = '';
  for (const theme of THEME_REGISTRY.themes) {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    themeSelect.appendChild(option);
  }
}

function renderThemeDescription(themeId) {
  const theme = getThemeById(themeId) ?? THEME_REGISTRY.themes[0];
  themeDescription.textContent = `${theme.description} 建议强度：${theme.recommendedIntensity}`;
}

async function loadSettings() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] ?? { enabled: true, intensity: 45, theme: THEME_REGISTRY.defaultThemeId };
  enabledInput.checked = settings.enabled;
  intensityInput.value = String(settings.intensity);
  themeSelect.value = settings.theme;
  modeText.textContent = intensityToMode(settings.intensity);
  renderThemeDescription(settings.theme);
}

async function loadStatus() {
  const result = await chrome.storage.local.get(STATUS_KEY);
  const status = result[STATUS_KEY];
  if (!status) {
    showTitle.textContent = '识别中...';
    recommendedTheme.textContent = '识别中...';
    statusText.textContent = '等待在腾讯视频页面生效（扩展快捷键：Ctrl+Shift+A；页面/Popup：Option+Command+A 或 Ctrl+Shift+A）';
    debugText.textContent = '';
    return;
  }

  showTitle.textContent = status.title || '未识别';
  recommendedTheme.textContent = (getThemeById(status.theme || status.autoTheme || THEME_REGISTRY.defaultThemeId) ?? THEME_REGISTRY.themes[0]).name;

  const userParts = [];
  if (status.message) userParts.push(status.message);
  if (typeof status.letterboxTop === 'number' || typeof status.letterboxBottom === 'number') {
    userParts.push(`黑边上 ${status.letterboxTop ?? 0}px / 下 ${status.letterboxBottom ?? 0}px`);
  }
  userParts.push('快捷键：Ctrl + Shift + A');
  statusText.textContent = userParts.join(' ｜ ');

  const debugParts = [];
  if (status.autoTheme) debugParts.push(`自动推荐：${status.autoTheme}`);
  if (status.themeName) debugParts.push(`实际主题：${status.themeName}`);
  if (status.debug?.videoCount !== undefined) debugParts.push(`video: ${status.debug.videoCount}`);
  if (status.debug?.hasContainer !== undefined) debugParts.push(`容器: ${status.debug.hasContainer ? '已识别' : '未识别'}`);
  if (status.debug?.intrinsicReady !== undefined) debugParts.push(`元数据: ${status.debug.intrinsicReady ? '已就绪' : '未就绪'}`);
  if (status.debug?.usedContainerFallback !== undefined) debugParts.push(`容器兜底: ${status.debug.usedContainerFallback ? '是' : '否'}`);
  if (status.debug?.symmetricLetterbox !== undefined) debugParts.push(`对称黑边: ${status.debug.symmetricLetterbox ? '是' : '否'}`);
  debugText.textContent = debugParts.join('\n');
  debugText.classList.toggle('hidden', !showDebug);
}

async function saveSettings() {
  const settings = {
    enabled: enabledInput.checked,
    intensity: Number(intensityInput.value),
    theme: themeSelect.value,
  };
  modeText.textContent = intensityToMode(settings.intensity);
  renderThemeDescription(settings.theme);
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  statusText.textContent = '设置已保存，切回腾讯视频页面查看效果（Ctrl+Shift+A / Option+Command+A）';
}

async function toggleEnabledFromShortcut() {
  const now = Date.now();
  if (now - lastToggleAt < 300) return;
  lastToggleAt = now;
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] ?? { enabled: true, intensity: 45, theme: THEME_REGISTRY.defaultThemeId };
  const next = { ...settings, enabled: !settings.enabled };
  enabledInput.checked = next.enabled;
  await chrome.storage.sync.set({ [STORAGE_KEY]: next });
  statusText.textContent = `Aura 已${next.enabled ? '开启' : '关闭'}（快捷键触发）`;
}

async function cycleTheme() {
  const current = themeSelect.value;
  const ids = THEME_REGISTRY.themes.map((theme) => theme.id);
  const index = ids.indexOf(current);
  const next = ids[(index + 1 + ids.length) % ids.length];
  themeSelect.value = next;
  await saveSettings();
}

enabledInput.addEventListener('change', saveSettings);
intensityInput.addEventListener('input', saveSettings);
themeSelect.addEventListener('change', saveSettings);
cycleThemeButton.addEventListener('click', () => void cycleTheme());
toggleDebugButton.addEventListener('click', () => {
  showDebug = !showDebug;
  debugText.classList.toggle('hidden', !showDebug);
  toggleDebugButton.textContent = showDebug ? '隐藏调试' : '调试信息';
});
chrome.storage.local.onChanged?.addListener?.(() => loadStatus());

document.addEventListener('keydown', (event) => {
  if (!matchesToggleShortcut(event)) return;
  event.preventDefault();
  void toggleEnabledFromShortcut();
});

populateThemeSelect();
await loadSettings();
await loadStatus();
