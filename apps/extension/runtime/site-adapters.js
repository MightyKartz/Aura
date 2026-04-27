import { createTencentDetector, isTencentPlaybackUrl } from './tencent-detect.js';

function isTencentVideoUrl(url = '') {
  try {
    const parsed = new URL(String(url || ''));
    return parsed.protocol === 'https:' && parsed.hostname === 'v.qq.com';
  } catch {
    return /^https:\/\/v\.qq\.com(?::\d+)?\//i.test(String(url || ''));
  }
}

export const TENCENT_VIDEO_ADAPTER = Object.freeze({
  id: 'tencent-video',
  label: '腾讯视频',
  matchesUrl(url = '') {
    return isTencentVideoUrl(url);
  },
  isPlaybackPage(url = '') {
    return isTencentPlaybackUrl(url);
  },
  createDetector(context) {
    return createTencentDetector(context);
  }
});

export const SITE_ADAPTERS = Object.freeze([TENCENT_VIDEO_ADAPTER]);

export function findSiteAdapter(url = '') {
  return SITE_ADAPTERS.find((adapter) => adapter.matchesUrl(url)) ?? null;
}

export function getSiteSupport(url = '') {
  const adapter = findSiteAdapter(url);
  return {
    adapter,
    supported: Boolean(adapter),
    playback: Boolean(adapter?.isPlaybackPage(url))
  };
}
