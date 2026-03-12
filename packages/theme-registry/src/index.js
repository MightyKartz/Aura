export const THEME_REGISTRY = {
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
    },
    {
      id: 'ancient-romance',
      name: '古装仙侠',
      category: 'genre',
      description: '适合古装、仙侠、权谋类剧集的金纹月华风格。',
      match: { keywords: ['宫', '仙', '侠', '凤', '后', '王', '君', '令', '缘', '月', '华'] },
      assets: {
        top: 'themes/ancient-romance-top.svg',
        bottom: 'themes/ancient-romance-bottom.svg'
      },
      recommendedIntensity: 56,
      tags: ['古装', '仙侠', '月光', '金纹']
    },
    {
      id: 'urban-romance',
      name: '都市爱情',
      category: 'genre',
      description: '适合都市恋爱、轻喜、甜感剧集的霓虹柔光风格。',
      match: { keywords: ['爱', '恋', '你', '婚', '告白', '时光', '喜欢', '心动'] },
      assets: {
        top: 'themes/urban-romance-top.svg',
        bottom: 'themes/urban-romance-bottom.svg'
      },
      recommendedIntensity: 50,
      tags: ['都市', '恋爱', '柔粉', '霓虹']
    },
    {
      id: 'suspense',
      name: '悬疑刑侦',
      category: 'genre',
      description: '适合悬疑、刑侦、罪案题材的冷色压迫感风格。',
      match: { keywords: ['罪', '案', '局', '警', '疑', '谜', '追', '凶', '杀'] },
      assets: {
        top: 'themes/suspense-top.svg',
        bottom: 'themes/suspense-bottom.svg'
      },
      recommendedIntensity: 58,
      tags: ['悬疑', '刑侦', '冷蓝', '压迫感']
    },
    {
      id: 'zhu-yu',
      name: '逐玉 · 专属 Aura',
      category: 'show',
      description: '为《逐玉》准备的专属氛围主题，偏冷月与鎏金边光。',
      match: { keywords: ['逐玉'] },
      assets: {
        top: 'themes/zhu-yu-top.svg',
        bottom: 'themes/zhu-yu-bottom.svg'
      },
      recommendedIntensity: 54,
      tags: ['逐玉', '专属', '冷月', '鎏金']
    }
  ]
};

export function getThemeById(themeId) {
  return THEME_REGISTRY.themes.find((theme) => theme.id === themeId) ?? null;
}

export function listThemes() {
  return THEME_REGISTRY.themes;
}

export function getDefaultTheme() {
  return getThemeById(THEME_REGISTRY.defaultThemeId) ?? THEME_REGISTRY.themes[0];
}

export function recommendThemeByTitle(title = '') {
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
}

export function resolveActiveTheme(selectedThemeId, title = '') {
  if (selectedThemeId && selectedThemeId !== THEME_REGISTRY.defaultThemeId) {
    return getThemeById(selectedThemeId) ?? recommendThemeByTitle(title);
  }
  return recommendThemeByTitle(title);
}
