const TITLE_SELECTORS = Object.freeze([
  '.video-info-detail__title',
  '.video-info-detail h1',
  '.video-info-main h1',
  '.player-play-title',
  '.episode-title',
  '[data-role="video-title"]',
  '[class*="video-title"]',
  'h1'
]);

const CONTEXT_SELECTORS = Object.freeze([
  '.video-info-detail__tag',
  '.video-info-detail__item',
  '.desc-info',
  '.info-item',
  '[class*="genre"]',
  '[class*="tag"]',
  '[class*="detail"] [class*="info"]'
]);

const PLAYER_CANDIDATES = Object.freeze([
  { selector: '#player-component', source: 'player-component', bonus: 32000 },
  { selector: '#main-player', source: 'main-player', bonus: 30000 },
  { selector: '.main-player-container', source: 'main-player-container', bonus: 25000 },
  { selector: '.main-player-wrapper', source: 'main-player-wrapper', bonus: 22000 },
  { selector: '.container-player', source: 'container-player', bonus: 20000 },
  { selector: '.txp_player', source: 'txp-player', bonus: 18000 },
  { selector: '.txp-player', source: 'txp-player', bonus: 17000 },
  { selector: '.wasm-player-fake-video', source: 'fake-video-shell', bonus: 14000 },
  { selector: '.thumbplayer-webvtt-overlay', source: 'content-overlay', bonus: 9000 },
  { selector: '.txp_subtitles_container', source: 'subtitle-overlay', bonus: 7000 }
]);

const CONTROL_SELECTORS = Object.freeze([
  '.txp_controls',
  '.txp-control',
  '.txp_controls_container',
  '.txp-control-wrap',
  '.txp_bottom_panel',
  '.txp-progress',
  '.txp-time-current',
  '.txp-btn-volume',
  '.txp_btn_fullscreen'
]);

const AD_SELECTORS = Object.freeze([
  '[class*="txp_ad"]',
  '[class*="ad-count"]',
  '[class*="ad-time"]',
  '[class*="ad-text"]',
  '[data-role*="ad"]'
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function isTencentPlaybackUrl(url = location.href) {
  const safeUrl = String(url || '');
  if (!/^https:\/\/v\.qq\.com\//i.test(safeUrl)) return false;

  try {
    const parsed = new URL(safeUrl);
    const pathname = parsed.pathname || '';
    return /\/x\/(cover|page)\//i.test(pathname)
      || /[?&](vid|cid)=/i.test(parsed.search || '')
      || /\/txp\/iframe-player\.html/i.test(pathname);
  } catch {
    return /\/x\/(cover|page)\//i.test(safeUrl) || /[?&](vid|cid)=/i.test(safeUrl);
  }
}

export function cleanText(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/(?:[-_｜|].*)?腾讯视频.*$/i, '')
    .replace(/高清视频在线观看.*$/i, '')
    .replace(/完整版.*$/i, '')
    .trim();
}

function visibleArea(rect) {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const overlapWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
  const overlapHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
  return overlapWidth * overlapHeight;
}

function isElementVisible(element) {
  if (!(element instanceof Element)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  if (visibleArea(rect) < 1) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && Number(style.opacity || 1) > 0.05;
}

function collectFirstTexts(selectors, limit, accept) {
  const bucket = [];
  const seen = new Set();

  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector)).slice(0, limit);
    for (const node of nodes) {
      const text = cleanText(node.textContent || '');
      if (!text || seen.has(text) || !accept(text)) continue;
      seen.add(text);
      bucket.push(text);
    }
    if (bucket.length > 0) break;
  }

  return bucket;
}

function scoreVideo(video) {
  if (!(video instanceof HTMLVideoElement) || !isElementVisible(video)) return 0;

  const rect = video.getBoundingClientRect();
  if (rect.width < 220 || rect.height < 124) return 0;

  const area = visibleArea(rect);
  if (area < 50000) return 0;

  const viewportCenterX = (window.innerWidth || rect.width) / 2;
  const viewportCenterY = (window.innerHeight || rect.height) / 2;
  const videoCenterX = rect.left + rect.width / 2;
  const videoCenterY = rect.top + rect.height / 2;
  const distance = Math.hypot(videoCenterX - viewportCenterX, videoCenterY - viewportCenterY);
  const maxDistance = Math.hypot(viewportCenterX, viewportCenterY) || 1;
  const centerBonus = 1 - clamp(distance / maxDistance, 0, 1);

  let score = area;
  if (!video.paused && !video.ended) score *= 1.35;
  if (video.readyState >= 2) score += 30000;
  if (video.currentTime > 0) score += 15000;
  score += centerBonus * 25000;
  return score;
}

function keywordScore(element) {
  if (!(element instanceof HTMLElement)) return 0;
  const identity = `${element.id || ''} ${element.className || ''} ${element.getAttribute('data-role') || ''}`;
  let score = 0;
  if (/main-player|player-component|txp/i.test(identity)) score += 6000;
  if (/player|video|stage|screen|container|wrapper|layout|fullscreen/i.test(identity)) score += 2200;
  if (element.hasAttribute('data-player') || element.getAttribute('data-role') === 'player') score += 1800;
  return score;
}

function scoreContainerCandidate(element, candidate, activeContainer) {
  if (!(element instanceof HTMLElement) || !isElementVisible(element)) return -Infinity;

  const rect = element.getBoundingClientRect();
  if (rect.width < 240 || rect.height < 135) return -Infinity;

  const area = visibleArea(rect);
  if (area < 50000) return -Infinity;

  const viewportCenterX = (window.innerWidth || rect.width) / 2;
  const viewportCenterY = (window.innerHeight || rect.height) / 2;
  const elementCenterX = rect.left + rect.width / 2;
  const elementCenterY = rect.top + rect.height / 2;
  const distance = Math.hypot(elementCenterX - viewportCenterX, elementCenterY - viewportCenterY);
  const maxDistance = Math.hypot(viewportCenterX, viewportCenterY) || 1;
  const centerBonus = 1 - clamp(distance / maxDistance, 0, 1);

  let score = area;
  score += candidate.bonus;
  score += keywordScore(element) * 3;
  score += centerBonus * 18000;

  if (activeContainer === element) score += 8000;
  if (rect.width > window.innerWidth * 1.18 || rect.height > window.innerHeight * 1.18) score -= 7000;
  if (candidate.source === 'content-overlay' || candidate.source === 'subtitle-overlay') score -= 4000;

  return score;
}

export function createTencentDetector({ getActiveContainer, getLastPointerAt } = {}) {
  return {
    extractShowTitle() {
      const candidates = collectFirstTexts(TITLE_SELECTORS, 4, (text) => text.length >= 2 && text.length <= 48);
      if (candidates[0]) return candidates[0];

      const metaTitle = cleanText(document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '');
      if (metaTitle.length >= 2 && metaTitle.length <= 48) return metaTitle;

      const title = cleanText(document.title || '');
      return title.length >= 2 && title.length <= 48 ? title : '';
    },

    extractShowContext(title = '') {
      const candidates = [];
      const seen = new Set();
      const normalizedTitle = cleanText(title);

      if (normalizedTitle) {
        seen.add(normalizedTitle);
        candidates.push(normalizedTitle);
      }

      const texts = collectFirstTexts(
        CONTEXT_SELECTORS,
        12,
        (text) => text.length >= 2 && text.length <= 36 && /[古悬疑爱喜甜燃热血青春侠探案战宫仙武刑侦成长]/.test(text)
      );

      for (const text of texts) {
        if (seen.has(text)) continue;
        seen.add(text);
        candidates.push(text);
      }

      const metaKeywords = cleanText(document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '');
      if (metaKeywords.length >= 2 && metaKeywords.length <= 80 && !seen.has(metaKeywords)) {
        candidates.push(metaKeywords);
      }

      const metaDescription = cleanText(document.querySelector('meta[name="description"]')?.getAttribute('content') || '');
      if (metaDescription.length >= 2 && metaDescription.length <= 80 && !seen.has(metaDescription)) {
        candidates.push(metaDescription);
      }

      return candidates.join(' ');
    },

    detectPrimaryVideo() {
      let bestVideo = null;
      let bestScore = 0;

      for (const video of document.querySelectorAll('video')) {
        const score = scoreVideo(video);
        if (score > bestScore) {
          bestScore = score;
          bestVideo = video;
        }
      }

      return bestScore > 50000 ? bestVideo : null;
    },

    detectPlayerContainer() {
      let bestMatch = null;
      let bestScore = -Infinity;

      for (const candidate of PLAYER_CANDIDATES) {
        for (const element of document.querySelectorAll(candidate.selector)) {
          const score = scoreContainerCandidate(element, candidate, getActiveContainer?.());
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              element,
              source: candidate.source
            };
          }
        }
      }

      return bestMatch?.element instanceof HTMLElement ? bestMatch : null;
    },

    hasVisibleTencentShell() {
      return Boolean(this.detectPlayerContainer());
    },

    hasVisibleControls(container) {
      if (!(container instanceof HTMLElement)) return false;
      const containerRect = container.getBoundingClientRect();

      for (const selector of CONTROL_SELECTORS) {
        for (const element of document.querySelectorAll(selector)) {
          if (!isElementVisible(element)) continue;
          const rect = element.getBoundingClientRect();
          if (rect.width < 20 || rect.height < 6) continue;
          const overlapsBottomArea = rect.bottom >= containerRect.top + containerRect.height * 0.55
            && rect.top <= containerRect.bottom + 8;
          if (overlapsBottomArea) return true;
        }
      }

      return false;
    },

    isAdvertisementActive(container) {
      if (!(container instanceof HTMLElement)) return false;

      for (const selector of AD_SELECTORS) {
        for (const element of document.querySelectorAll(selector)) {
          if (!isElementVisible(element)) continue;
          const rect = element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const intersects = rect.right >= containerRect.left
            && rect.left <= containerRect.right
            && rect.bottom >= containerRect.top
            && rect.top <= containerRect.bottom;
          if (intersects) return true;
        }
      }

      const containerRect = container.getBoundingClientRect();
      const scanNodes = Array.from(container.querySelectorAll('div, span')).slice(0, 160);
      for (const element of scanNodes) {
        if (!(element instanceof HTMLElement) || !isElementVisible(element)) continue;
        const text = cleanText(element.textContent || '');
        if (text !== '广告') continue;

        const rect = element.getBoundingClientRect();
        const inLeftBottomCorner = rect.left <= containerRect.left + 88 && rect.bottom >= containerRect.bottom - 96;
        if (inLeftBottomCorner) return true;
      }

      return false;
    },

    detectPlaybackMode(container, video) {
      const fullscreenElement = document.fullscreenElement;
      if (fullscreenElement && (
        fullscreenElement === container
        || fullscreenElement === video
        || fullscreenElement.contains(container)
        || container?.contains?.(fullscreenElement)
      )) {
        return 'fullscreen';
      }

      const identity = [
        document.documentElement.className,
        document.body?.className || '',
        container?.className || ''
      ].join(' ');

      if (/page-fullscreen|webfullscreen|web-fullscreen|thumbplayer-fake-fullscreen|plugin_ctrl_fake_fullscreen|plugin_ctrl_txp_mode_fullscreen|txp_player_fullscreen|txp-fullscreen/i.test(identity)) {
        return 'web-fullscreen';
      }

      return 'windowed';
    },

    detectPlaybackState(video) {
      if (video instanceof HTMLVideoElement) {
        return video.paused ? 'paused' : 'playing';
      }

      return 'playing';
    },

    shouldLiftForControls(container, video) {
      return this.hasVisibleControls(container)
        || Date.now() - (getLastPointerAt?.() ?? 0) < 1500
        || Boolean(video instanceof HTMLVideoElement && video.paused && video.currentTime > 0);
    }
  };
}
