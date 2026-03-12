const STORAGE_KEY = 'aura:mvp:settings';
const ROOT_ID = 'aura-root';
const STATUS_KEY = 'aura:mvp:status';

let THEME_REGISTRY = {
  version: 1,
  defaultThemeId: 'tencent-default',
  themes: []
};
let getThemeById = (themeId) => THEME_REGISTRY.themes.find((theme) => theme.id === themeId) ?? null;
let getDefaultTheme = () => getThemeById(THEME_REGISTRY.defaultThemeId) ?? THEME_REGISTRY.themes[0];
let recommendThemeByTitle = (title = '') => getDefaultTheme();
let resolveActiveTheme = (selectedThemeId, title = '') => getDefaultTheme();
let registryReady = false;
let registryLoading = null;

const TENCENT_CONTAINER_SELECTORS = [
  '.txp_player_container',
  '.txp_player',
  '#mod_player',
  '.container-player',
  '.txp_videos_container',
  '.txp_video_container',
  '.container_inner',
  '.txp-player-container',
  '.txp-player',
  '[data-player]'
];

const DEFAULT_SETTINGS = {
  enabled: true,
  intensity: 45,
  theme: 'tencent-default'
};

let disposed = false;
let syncTimer = null;
let observer = null;
let lastToggleAt = 0;

async function ensureThemeRegistryLoaded() {
  if (registryReady) return true;
  if (registryLoading) return registryLoading;

  registryLoading = (async () => {
    try {
      const manifestUrl = chrome.runtime.getURL('theme-registry/builtin-themes.json');
      const response = await fetch(manifestUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const registry = await response.json();
      THEME_REGISTRY = registry;
      getThemeById = (themeId) => THEME_REGISTRY.themes.find((theme) => theme.id === themeId) ?? null;
      getDefaultTheme = () => getThemeById(THEME_REGISTRY.defaultThemeId) ?? THEME_REGISTRY.themes[0];
      recommendThemeByTitle = (title = '') => {
        const normalized = String(title).trim();
        if (!normalized) return getDefaultTheme();
        const exactShow = THEME_REGISTRY.themes.find((theme) =>
          theme.category === 'show' && theme.match.keywords.some((keyword) => normalized.includes(keyword))
        );
        if (exactShow) return exactShow;
        const scored = THEME_REGISTRY.themes
          .filter((theme) => theme.category !== 'default')
          .map((theme) => ({
            theme,
            score: theme.match.keywords.reduce((sum, keyword) => sum + (normalized.includes(keyword) ? 1 : 0), 0),
          }))
          .sort((a, b) => b.score - a.score);
        return scored[0]?.score > 0 ? scored[0].theme : getDefaultTheme();
      };
      resolveActiveTheme = (selectedThemeId, title = '') => {
        if (selectedThemeId && selectedThemeId !== THEME_REGISTRY.defaultThemeId) {
          return getThemeById(selectedThemeId) ?? recommendThemeByTitle(title);
        }
        return recommendThemeByTitle(title);
      };
      registryReady = true;
      return true;
    } catch (error) {
      console.warn('[Aura] failed to load theme registry manifest, fallback to default theme only:', error);
      THEME_REGISTRY = {
        version: 1,
        defaultThemeId: 'tencent-default',
        themes: [
          {
            id: 'tencent-default',
            name: '腾讯默认 Aura',
            category: 'default',
            description: '适合腾讯视频通用观影场景的基础氛围主题。',
            match: { keywords: [] },
            assets: {
              top: 'themes/tencent-default-top.svg',
              bottom: 'themes/tencent-default-bottom.svg'
            },
            recommendedIntensity: 48,
            tags: ['通用', '默认', '柔和']
          }
        ]
      };
      getThemeById = (themeId) => THEME_REGISTRY.themes.find((theme) => theme.id === themeId) ?? null;
      getDefaultTheme = () => THEME_REGISTRY.themes[0];
      recommendThemeByTitle = () => THEME_REGISTRY.themes[0];
      resolveActiveTheme = () => THEME_REGISTRY.themes[0];
      registryReady = true;
      return false;
    }
  })();

  return registryLoading;
}

function isExtensionAlive() {
  try {
    return Boolean(globalThis.chrome?.runtime?.id);
  } catch {
    return false;
  }
}

function handleSyncEvent() {
  void syncAura();
}

function handleStorageChange() {
  void syncAura();
}

function toggleAuraWithDebounce() {
  const now = Date.now();
  if (now - lastToggleAt < 300) return;
  lastToggleAt = now;
  getSyncValue(STORAGE_KEY, DEFAULT_SETTINGS, (settings) => {
    setSyncValue(STORAGE_KEY, { ...settings, enabled: !settings.enabled }, () => {
      syncAura();
    });
  });
}

function handleHotkey(event) {
  if (disposed) return;
  const key = event.key.toLowerCase();
  const matchMacFriendly = event.metaKey && event.altKey && key === 'a';
  const matchCtrlShift = event.ctrlKey && event.shiftKey && key === 'a';
  if (matchMacFriendly || matchCtrlShift) {
    event.preventDefault();
    event.stopPropagation();
    toggleAuraWithDebounce();
  }
}

function disposeAura() {
  if (disposed) return;
  disposed = true;

  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }

  if (observer) {
    observer.disconnect();
    observer = null;
  }

  const root = document.getElementById(ROOT_ID);
  root?.remove();

  window.removeEventListener('resize', handleSyncEvent);
  document.removeEventListener('fullscreenchange', handleSyncEvent);
  document.removeEventListener('keyup', handleHotkey);

  try {
    chrome.storage?.onChanged?.removeListener?.(handleStorageChange);
  } catch {
    // ignore
  }
}

function guardExtensionContext() {
  if (!isExtensionAlive()) {
    disposeAura();
    return false;
  }
  return true;
}

function extensionErrorLike(lastError) {
  return !!lastError && String(lastError.message || lastError).includes('Extension context invalidated');
}

function getSyncValue(key, fallback, callback) {
  if (!guardExtensionContext()) {
    callback(fallback);
    return;
  }
  try {
    chrome.storage.sync.get(key, (result) => {
      const lastError = chrome.runtime?.lastError;
      if (extensionErrorLike(lastError)) {
        disposeAura();
        callback(fallback);
        return;
      }
      if (lastError) {
        console.warn('[Aura] getSyncValue fallback:', lastError);
        callback(fallback);
        return;
      }
      callback(result?.[key] ?? fallback);
    });
  } catch (error) {
    if (String(error).includes('Extension context invalidated')) {
      disposeAura();
      callback(fallback);
      return;
    }
    console.warn('[Aura] getSyncValue caught fallback:', error);
    callback(fallback);
  }
}

function setSyncValue(key, value, callback) {
  if (!guardExtensionContext()) {
    callback?.(false);
    return;
  }
  try {
    chrome.storage.sync.set({ [key]: value }, () => {
      const lastError = chrome.runtime?.lastError;
      if (extensionErrorLike(lastError)) {
        disposeAura();
        callback?.(false);
        return;
      }
      if (lastError) {
        console.warn('[Aura] setSyncValue ignored:', lastError);
        callback?.(false);
        return;
      }
      callback?.(true);
    });
  } catch (error) {
    if (String(error).includes('Extension context invalidated')) {
      disposeAura();
      callback?.(false);
      return;
    }
    console.warn('[Aura] setSyncValue caught ignored:', error);
    callback?.(false);
  }
}

function setLocalValue(key, value, callback) {
  if (!guardExtensionContext()) {
    callback?.(false);
    return;
  }
  try {
    chrome.storage.local.set({ [key]: value }, () => {
      const lastError = chrome.runtime?.lastError;
      if (extensionErrorLike(lastError)) {
        disposeAura();
        callback?.(false);
        return;
      }
      if (lastError) {
        console.warn('[Aura] setLocalValue ignored:', lastError);
        callback?.(false);
        return;
      }
      callback?.(true);
    });
  } catch (error) {
    if (String(error).includes('Extension context invalidated')) {
      disposeAura();
      callback?.(false);
      return;
    }
    console.warn('[Aura] setLocalValue caught ignored:', error);
    callback?.(false);
  }
}

function safeRuntimeUrl(path) {
  if (!guardExtensionContext()) return '';
  try {
    return chrome.runtime.getURL(path);
  } catch (error) {
    if (String(error).includes('Extension context invalidated')) {
      disposeAura();
      return '';
    }
    console.warn('[Aura] safeRuntimeUrl fallback:', error);
    return '';
  }
}

function ensureRoot() {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;

  root = document.createElement('div');
  root.id = ROOT_ID;

  const topLayer = document.createElement('div');
  topLayer.className = 'aura-layer aura-layer--top';
  topLayer.dataset.role = 'top';

  const bottomLayer = document.createElement('div');
  bottomLayer.className = 'aura-layer aura-layer--bottom';
  bottomLayer.dataset.role = 'bottom';

  root.append(topLayer, bottomLayer);
  document.documentElement.appendChild(root);
  return root;
}

function scoreVideo(video) {
  const rect = video.getBoundingClientRect();
  const style = window.getComputedStyle(video);
  const visible = rect.width > 40 && rect.height > 30 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0;
  const area = rect.width * rect.height;
  return { video, rect, visible, area };
}

function findPrimaryVideo() {
  const videos = Array.from(document.querySelectorAll('video'));
  if (videos.length === 0) return null;

  const scored = videos
    .map(scoreVideo)
    .filter((item) => item.visible)
    .sort((a, b) => b.area - a.area);

  if (scored.length > 0) {
    return scored[0].video;
  }

  return videos
    .map(scoreVideo)
    .sort((a, b) => b.area - a.area)[0]?.video ?? null;
}

function scoreContainer(node) {
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  const visible = rect.width > 240 && rect.height > 120 && style.display !== 'none' && style.visibility !== 'hidden';
  let score = rect.width * rect.height;
  const classText = `${node.className || ''} ${node.id || ''}`;
  if (/player|video|txp/i.test(classText)) score *= 1.15;
  if (document.fullscreenElement && document.fullscreenElement.contains(node)) score *= 1.25;
  return { node, rect, score, visible };
}

function findBestTencentContainer() {
  const selectorMatches = TENCENT_CONTAINER_SELECTORS
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  const genericMatches = Array.from(document.querySelectorAll('div, section')).filter((node) => {
    if (!(node instanceof HTMLElement)) return false;
    const txt = `${node.className || ''} ${node.id || ''}`;
    return /player|video|txp/i.test(txt);
  });

  const candidates = [...new Set([...selectorMatches, ...genericMatches])]
    .filter((node) => node instanceof HTMLElement)
    .map((node) => scoreContainer(node))
    .filter((item) => item.visible)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.node ?? null;
}

function findTencentContainer(video) {
  const fullscreenEl = document.fullscreenElement;
  if (fullscreenEl instanceof HTMLElement && fullscreenEl.getBoundingClientRect().width > 240) {
    return fullscreenEl;
  }

  const bestContainer = findBestTencentContainer();
  if (bestContainer) {
    if (!video) return bestContainer;
    if (bestContainer.contains(video) || video.closest?.('*')) {
      return bestContainer;
    }
  }

  if (!video) return bestContainer;

  for (const selector of TENCENT_CONTAINER_SELECTORS) {
    const node = video.closest(selector) ?? document.querySelector(selector);
    if (node instanceof HTMLElement && node.getBoundingClientRect().width > 200) {
      return node;
    }
  }

  return video.parentElement instanceof HTMLElement ? video.parentElement : video;
}

function refineVisibleMediaRect(video, container) {
  const containerRect = container?.getBoundingClientRect?.();
  const videoRect = video?.getBoundingClientRect?.();
  if (!containerRect) return videoRect ?? null;
  if (!videoRect || !videoRect.width || !videoRect.height) return containerRect;

  const left = Math.max(containerRect.left, videoRect.left);
  const top = Math.max(containerRect.top, videoRect.top);
  const right = Math.min(containerRect.right, videoRect.right);
  const bottom = Math.min(containerRect.bottom, videoRect.bottom);

  if (right - left > 120 && bottom - top > 80) {
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }
  return videoRect;
}

function computeLetterbox(video, container) {
  const containerRect = container?.getBoundingClientRect?.();
  const mediaRect = refineVisibleMediaRect(video, container);
  const rect = mediaRect ?? containerRect;
  if (!rect || !containerRect || !containerRect.width || !containerRect.height) return null;

  const targetRect = rect;
  let top = 0;
  let bottom = 0;
  let symmetricLetterbox = false;
  const hasIntrinsic = !!(video?.videoWidth && video?.videoHeight);

  if (video && hasIntrinsic && targetRect.width && targetRect.height) {
    const videoAspect = video.videoWidth / video.videoHeight;
    const boxAspect = targetRect.width / targetRect.height;

    if (videoAspect > boxAspect) {
      const renderedHeight = targetRect.width / videoAspect;
      const verticalGap = Math.max(0, targetRect.height - renderedHeight);
      top = verticalGap / 2;
      bottom = verticalGap / 2;
      symmetricLetterbox = true;
    } else {
      top = Math.max(0, targetRect.top - containerRect.top);
      bottom = Math.max(0, containerRect.bottom - targetRect.bottom);
    }
  } else if (video && targetRect.width && targetRect.height) {
    top = Math.max(0, targetRect.top - containerRect.top);
    bottom = Math.max(0, containerRect.bottom - targetRect.bottom);
  } else {
    const guessed = Math.max(24, Math.min(42, Math.round(containerRect.height * 0.065)));
    top = guessed;
    bottom = guessed;
    symmetricLetterbox = true;
  }

  if (top > 12 && bottom < 6) {
    bottom = top;
    symmetricLetterbox = true;
  }
  if (bottom > 12 && top < 6) {
    top = bottom;
    symmetricLetterbox = true;
  }

  return {
    top,
    bottom,
    rect: { left: containerRect.left, top: containerRect.top, right: containerRect.right, bottom: containerRect.bottom, width: containerRect.width, height: containerRect.height },
    mediaRect: targetRect,
    hasIntrinsic,
    usedContainerFallback: !video,
    symmetricLetterbox
  };
}

function normalizeDramaTitle(rawTitle) {
  return rawTitle
    .replace(/腾讯视频|在线观看|高清视频免费看|完整版|电视剧|电影|综艺|动漫/gi, ' ')
    .replace(/[|｜_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectDramaTitle() {
  const candidates = [
    document.querySelector('meta[property="og:title"]')?.content,
    document.querySelector('meta[name="title"]')?.content,
    document.querySelector('.video_title_cn')?.textContent,
    document.querySelector('.player_title')?.textContent,
    document.querySelector('h1')?.textContent,
    document.title,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const title = normalizeDramaTitle(candidate);
    if (title.length >= 2) return title;
  }
  return '未识别剧名';
}

function updateStatus(status) {
  setLocalValue(STATUS_KEY, status);
}

function positionLayer(layer, left, top, width, height) {
  const safeHeight = Math.max(0, height);
  layer.style.left = `${Math.max(0, left)}px`;
  layer.style.top = `${Math.max(0, top)}px`;
  layer.style.width = `${Math.max(0, width)}px`;
  layer.style.height = `${safeHeight}px`;
  layer.style.display = safeHeight > 0 ? 'block' : 'none';
}

function applyTheme(root, settings, geometry, title) {
  const activeTheme = resolveActiveTheme(settings.theme, title);
  const topLayer = root.querySelector('[data-role="top"]');
  const bottomLayer = root.querySelector('[data-role="bottom"]');
  const intensityRatio = Math.max(0, Math.min(1, settings.intensity / 100));
  const fallbackPenalty = geometry.usedContainerFallback ? 0.5 : 1;
  const recommended = activeTheme?.recommendedIntensity ?? settings.intensity;
  const recommendationBoost = Math.min(1, recommended / 100);
  const opacity = settings.enabled ? Math.min(0.64, (0.12 + Math.max(intensityRatio, recommendationBoost * 0.75) * 0.40) * fallbackPenalty) : 0;
  const { rect, top, bottom, mediaRect, symmetricLetterbox } = geometry;

  const topUrl = safeRuntimeUrl(activeTheme.assets.top);
  const bottomUrl = safeRuntimeUrl(activeTheme.assets.bottom);
  if (!topUrl || !bottomUrl) {
    return { active: false, theme: activeTheme, top, bottom };
  }

  const minBand = geometry.usedContainerFallback ? 20 : 32;
  const effectiveTop = top > 8 ? Math.max(minBand, Math.round(top)) : Math.round(top);
  let effectiveBottom = bottom > 8 ? Math.max(minBand, Math.round(bottom)) : Math.round(bottom);

  if (symmetricLetterbox && effectiveTop > 0 && effectiveBottom < effectiveTop) {
    effectiveBottom = effectiveTop;
  }

  const left = mediaRect?.left ?? rect.left;
  const width = mediaRect?.width ?? rect.width;
  const topAnchor = mediaRect?.top ?? rect.top;
  const bottomAnchor = mediaRect?.bottom ?? rect.bottom;

  topLayer.style.setProperty('--aura-opacity', String(opacity));
  bottomLayer.style.setProperty('--aura-opacity', String(opacity));
  topLayer.style.backgroundImage = `url(${topUrl})`;
  bottomLayer.style.backgroundImage = `url(${bottomUrl})`;

  positionLayer(topLayer, left, topAnchor, width, effectiveTop);
  positionLayer(bottomLayer, left, bottomAnchor - effectiveBottom, width, effectiveBottom);

  const active = settings.enabled && (effectiveTop > 6 || effectiveBottom > 6);
  topLayer.classList.toggle('aura-layer--active', active);
  bottomLayer.classList.toggle('aura-layer--active', active);
  root.dataset.theme = activeTheme.id;

  return { active, theme: activeTheme, top: effectiveTop, bottom: effectiveBottom };
}

async function syncAura() {
  if (disposed || !guardExtensionContext()) return;

  try {
    await ensureThemeRegistryLoaded();
    const root = ensureRoot();
    getSyncValue(STORAGE_KEY, DEFAULT_SETTINGS, (settings) => {
      if (disposed) return;

      const video = findPrimaryVideo();
      const container = findTencentContainer(video);
      const title = detectDramaTitle();
      const recommendedTheme = recommendThemeByTitle(title);

      if (!video && !container) {
        updateStatus({
          site: '腾讯视频',
          ready: false,
          message: '未检测到有效视频元素或播放器容器',
          title,
          autoTheme: recommendedTheme.id,
          theme: recommendedTheme.id,
          debug: {
            videoCount: document.querySelectorAll('video').length,
            fullscreen: !!document.fullscreenElement,
          }
        });
        return;
      }

      const geometry = computeLetterbox(video, container);

      if (!geometry) {
        updateStatus({
          site: '腾讯视频',
          ready: false,
          message: '已识别播放器，但暂时无法计算黑边',
          title,
          autoTheme: recommendedTheme.id,
          theme: recommendedTheme.id,
          debug: {
            videoCount: document.querySelectorAll('video').length,
            fullscreen: !!document.fullscreenElement,
            hasContainer: !!container,
          }
        });
        return;
      }

      const applied = applyTheme(root, settings, geometry, title);
      updateStatus({
        site: '腾讯视频',
        ready: true,
        message: applied.active ? 'Aura 已生效' : '当前视频黑边不明显或 Aura 已关闭',
        title,
        autoTheme: recommendedTheme.id,
        theme: applied.theme.id,
        themeName: applied.theme.name,
        letterboxTop: Math.round(applied.top),
        letterboxBottom: Math.round(applied.bottom),
        debug: {
          videoCount: document.querySelectorAll('video').length,
          fullscreen: !!document.fullscreenElement,
          intrinsicReady: !!geometry.hasIntrinsic,
          hasContainer: !!container,
          usedContainerFallback: !!geometry.usedContainerFallback,
          symmetricLetterbox: !!geometry.symmetricLetterbox,
        }
      });
    });
  } catch (error) {
    if (String(error).includes('Extension context invalidated')) {
      disposeAura();
      return;
    }
    console.warn('[Aura] syncAura ignored error:', error);
  }
}

observer = new MutationObserver(() => {
  void syncAura();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('resize', handleSyncEvent);
document.addEventListener('fullscreenchange', handleSyncEvent);
document.addEventListener('keyup', handleHotkey);

try {
  chrome.storage.onChanged.addListener(handleStorageChange);
} catch {
  disposeAura();
}

syncTimer = setInterval(() => {
  void syncAura();
}, 1200);

void syncAura();
