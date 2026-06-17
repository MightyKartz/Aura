import { computeLayout } from './runtime/layout.js';
import { createOverlayManager } from './runtime/content-overlay.js';
import { buildInfoLayerModel } from './runtime/info-layer.js';
import { loadSkinRegistry, getSkinById, getDefaultSkin } from './runtime/skin-registry.js';
import { getCharacterMotionPreset, getCharacterMotionSignature, getCharacterTheme } from './runtime/character-theme.js';
import { resolveRuntimeAssetUrl } from './runtime/url-resolver.js';

const player = document.getElementById('previewPlayer');
const skinList = document.getElementById('skinList');
const skinMeta = document.getElementById('skinMeta');
const modeSelect = document.getElementById('modeSelect');
const playbackModeSelect = document.getElementById('playbackModeSelect');
const pausedToggle = document.getElementById('pausedToggle');
const controlsToggle = document.getElementById('controlsToggle');
const adToggle = document.getElementById('adToggle');
const attentionToggle = document.getElementById('attentionToggle');
const stageSkinName = document.getElementById('stageSkinName');
const stageMotionPreset = document.getElementById('stageMotionPreset');
const stageMotionState = document.getElementById('stageMotionState');
const stageMotionFrames = document.getElementById('stageMotionFrames');
const stageActionState = document.getElementById('stageActionState');
const stageLayoutLabel = document.getElementById('stageLayoutLabel');

const modeLabelMap = {
  quiet: '安静模式',
  standard: '标准模式',
  lively: '活泼模式'
};

const playbackLabelMap = {
  windowed: '窗口态',
  'web-fullscreen': '网页全屏',
  'native-fullscreen': '原生全屏'
};

const motionStateLabelMap = {
  'idle-soft': '柔和待机',
  'attention-soft': '轻触发光',
  'idle-watch': '侦查待机',
  'paused-still': '暂停静候',
  'controls-softened': '控件避让',
  'ad-muted': '广告弱化'
};

const frameStatusLabelMap = {
  'base-only': '右下单图 · 左上氛围'
};

const overlay = createOverlayManager({
  getAssetUrl: (path) => resolveRuntimeAssetUrl(path, import.meta.url),
  onAssetReady: () => {
    window.requestAnimationFrame(renderView);
  }
});

let registry = null;
let selectedSkinId = '';
let attentionToken = 0;
const urlState = new URLSearchParams(location.search);

function readBooleanParam(key, fallback = false) {
  const raw = urlState.get(key);
  if (raw === null) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function applyInitialControls() {
  const requestedMode = urlState.get('mode');
  const requestedPlayback = urlState.get('playback');

  if (requestedMode && ['quiet', 'standard', 'lively'].includes(requestedMode)) {
    modeSelect.value = requestedMode;
  }

  if (requestedPlayback && ['windowed', 'web-fullscreen', 'native-fullscreen'].includes(requestedPlayback)) {
    playbackModeSelect.value = requestedPlayback;
  }

  pausedToggle.checked = readBooleanParam('paused');
  controlsToggle.checked = readBooleanParam('controls');
  adToggle.checked = readBooleanParam('ad');
  attentionToggle.checked = readBooleanParam('attention', false);
  attentionToken = attentionToggle.checked ? Date.now() : 0;
}

function getVisualState() {
  return {
    playbackMode: playbackModeSelect.value,
    playbackState: pausedToggle.checked ? 'paused' : 'playing',
    controlsVisible: controlsToggle.checked,
    adActive: adToggle.checked,
    attentionActive: attentionToggle.checked,
    attentionToken
  };
}

function getSelectedSkin() {
  return getSkinById(registry, selectedSkinId) ?? getDefaultSkin(registry);
}

function renderSkinMeta(skin) {
  const tags = Array.isArray(skin.tags) ? skin.tags.join(' / ') : '--';
  const theme = getCharacterTheme(skin);
  const motionPreset = getCharacterMotionPreset(skin, 'soft');
  const motionSignature = getCharacterMotionSignature(skin) || '静态挂件';
  const summaryLines = theme
    ? [
        `<div><span class="skin-meta__label">主题定位</span><strong>${theme.themeName}</strong></div>`,
        `<div><span class="skin-meta__label">氛围关键词</span>${theme.topLeftAtmosphere.motifs.join(' / ')}</div>`,
        `<div><span class="skin-meta__label">人物构图</span>${theme.bottomRightCharacter.role} · ${theme.bottomRightCharacter.pose} · ${theme.bottomRightCharacter.prop}</div>`,
        `<div><span class="skin-meta__label">动效气质</span>${motionPreset} · ${theme.motionLanguage.focus} · ${theme.motionLanguage.accent}</div>`,
        `<div><span class="skin-meta__label">推荐场景</span>${playbackLabelMap.windowed}，${modeLabelMap[skin.recommendedMode] || skin.recommendedMode}</div>`
      ]
    : [
        `<div><span class="skin-meta__label">标签</span>${tags}</div>`,
        `<div><span class="skin-meta__label">动效气质</span>${motionPreset} · ${motionSignature}</div>`
      ];

  skinMeta.innerHTML = [
    `<strong>${skin.name}</strong>`,
    `<div>${skin.description}</div>`,
    `<div><span class="skin-meta__label">风格标签</span>${tags}</div>`,
    ...summaryLines
  ].join('');
}

function renderSkinList() {
  skinList.innerHTML = '';

  for (const skin of registry.skins) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `skin-card${skin.id === selectedSkinId ? ' is-active' : ''}`;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', skin.id === selectedSkinId ? 'true' : 'false');
    button.innerHTML = `
      <div class="skin-card__title">
        <span>${skin.name}</span>
        <span class="stage-pill">${getCharacterMotionPreset(skin, 'soft')}</span>
      </div>
      <div class="skin-card__meta">${skin.tags.join(' / ')}</div>
    `;
    button.addEventListener('click', () => {
      selectedSkinId = skin.id;
      renderView();
    });
    skinList.appendChild(button);
  }
}

function buildPreviewInfoLayer(skin, visualState) {
  const paused = visualState.playbackState === 'paused';
  const utilitySummary = paused
    ? {
        markCount: 0,
        recentMarkLabel: '',
        resumePointLabel: '18:42'
      }
    : {
        markCount: 0,
        recentMarkLabel: '',
        resumePointLabel: ''
      };

  return buildInfoLayerModel({
    skin,
    showContext: skin.tags?.[0] || '',
    prompt: paused ? { text: '暂停中', type: 'paused' } : null,
    utilitySummary
  });
}

function renderView() {
  const skin = getSelectedSkin();
  const visualState = getVisualState();
  const mode = modeSelect.value;

  player.classList.toggle('is-immersive', visualState.playbackMode !== 'windowed');
  const layout = computeLayout(player.getBoundingClientRect(), visualState, skin);
  renderSkinList();
  renderSkinMeta(skin);

  stageSkinName.textContent = skin.name;
  stageMotionPreset.textContent = getCharacterMotionSignature(skin)
    ? `${getCharacterMotionPreset(skin, 'soft')} · ${getCharacterMotionSignature(skin)}`
    : getCharacterMotionPreset(skin, 'soft');
  stageLayoutLabel.textContent = `${playbackLabelMap[visualState.playbackMode] || visualState.playbackMode} · ${modeLabelMap[mode] || mode}`;

  overlay.render({
    container: player,
    skin,
    layout,
    visualState,
    mode,
    infoLayer: buildPreviewInfoLayer(skin, visualState)
  });

  const debug = overlay.getDebugInfo();
  stageMotionState.textContent = motionStateLabelMap[debug?.motionState] || debug?.motionState || '柔和待机';
  stageMotionFrames.textContent = formatFrameDebug(debug);
  stageActionState.textContent = formatActionDebug(debug);
}

function formatFrameDebug(debug = null) {
  if (!debug) return '静态主帧';

  return frameStatusLabelMap[debug.frameStatus] || debug.frameStatus || '右下单图 · 左上氛围';
}

function formatActionDebug(debug = null) {
  if (debug?.motionState === 'controls-softened') return '控件可见 · 动效收敛';
  if (debug?.motionState === 'attention-soft') return '播放器触发 · 光感回应';
  return '单图模式 · 无替换帧';
}

for (const element of [
  modeSelect,
  playbackModeSelect,
  pausedToggle,
  controlsToggle,
  adToggle
]) {
  element.addEventListener('change', renderView);
}

attentionToggle.addEventListener('change', () => {
  attentionToken = attentionToggle.checked ? Date.now() : 0;
  renderView();
});

window.addEventListener('resize', renderView);

void (async function initSkinStudio() {
  registry = await loadSkinRegistry({
    getRuntimeUrl: (path) => resolveRuntimeAssetUrl(path, import.meta.url)
  });
  applyInitialControls();
  selectedSkinId = getSkinById(registry, urlState.get('skin'))?.id || registry.defaultSkinId;
  renderView();
})();
