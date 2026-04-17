export function createFallbackRegistry() {
  return {
    version: 1,
    defaultSkinId: 'cat-default-v1',
    skins: [
      {
        id: 'cat-default-v1',
        name: '默认小猫',
        category: 'default',
        description: '适合通用观影场景的轻量角落挂件。',
        match: { keywords: [] },
        assets: {
          topLeft: 'themes/skin-default-top-left.svg',
          bottomRight: 'themes/skin-default-bottom-right.svg'
        },
        palette: {
          primary: '#6dd3ff',
          accent: '#ffd166',
          glow: '#8ecdf4'
        }
      }
    ]
  };
}

export const SKIN_REGISTRY_PATH = 'theme-registry/builtin-skins.json';

export async function loadSkinRegistry({
  fetchImpl = fetch,
  getRuntimeUrl = (path) => chrome.runtime.getURL(path)
} = {}) {
  try {
    const response = await fetchImpl(getRuntimeUrl(SKIN_REGISTRY_PATH), {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('[Aura] failed to load skin registry, using fallback:', error);
    return createFallbackRegistry();
  }
}

export function getSkinById(registry, skinId) {
  return registry?.skins?.find((skin) => skin.id === skinId) ?? registry?.skins?.[0] ?? null;
}

export function getDefaultSkin(registry) {
  return getSkinById(registry, registry?.defaultSkinId) ?? registry?.skins?.[0] ?? null;
}

export function recommendSkinByText(registry, text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return getDefaultSkin(registry);

  const scored = (registry?.skins ?? [])
    .filter((skin) => skin.category !== 'default')
    .map((skin) => ({
      skin,
      score: (skin.match?.keywords ?? []).reduce(
        (sum, keyword) => sum + (normalized.includes(keyword) ? 1 : 0),
        0
      )
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].skin : getDefaultSkin(registry);
}

export function resolveSkin(registry, settings, contextText = '') {
  if (settings.themeMode === 'manual' && settings.selectedSkinId) {
    return {
      skin: getSkinById(registry, settings.selectedSkinId) ?? getDefaultSkin(registry),
      source: 'manual'
    };
  }

  const recommended = recommendSkinByText(registry, contextText);
  return {
    skin: recommended,
    source: recommended?.category === 'genre' ? 'auto-genre' : 'auto-default'
  };
}
