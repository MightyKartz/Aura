import { validateSkinRegistry } from './skin-contract.js';
import { resolveRuntimeAssetUrl } from './url-resolver.js';
import { scoreSkinMatch } from './character-theme.js';

export function createFallbackRegistry() {
  return {
    version: 1,
    defaultSkinId: 'cat-default-v1',
    skins: [
      {
        id: 'cat-default-v1',
        name: '默认小猫',
        category: 'default',
        description: '适合通用观影场景的暖白发光小猫角落挂件。',
        match: { keywords: [] },
        assets: {
          topLeft: 'themes/skin-default-top-left.png',
          bottomRight: 'themes/skin-default-bottom-right.png'
        },
        palette: {
          primary: '#fff1cf',
          accent: '#ffd45f',
          glow: '#ffcf5a'
        },
        recommendedMode: 'standard',
        motionPreset: 'soft',
        tags: ['默认', '通用', '柔和']
      }
    ]
  };
}

export const SKIN_REGISTRY_PATH = 'theme-registry/builtin-skins.json';

export async function loadSkinRegistry({
  fetchImpl = fetch,
  getRuntimeUrl = (path) => resolveRuntimeAssetUrl(path, import.meta.url)
} = {}) {
  try {
    const response = await fetchImpl(getRuntimeUrl(SKIN_REGISTRY_PATH), {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const registry = await response.json();
    return validateSkinRegistry(registry, { label: 'runtime-registry' });
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

function getAutoSource(skin) {
  if (skin?.category === 'character') return 'auto-character-theme';
  if (skin?.category === 'genre') return 'auto-genre';
  return 'auto-default';
}

export function recommendSkinByText(registry, text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return getDefaultSkin(registry);

  const scored = (registry?.skins ?? [])
    .filter((skin) => skin.category !== 'default')
    .map((skin) => ({
      skin,
      score: scoreSkinMatch(skin, normalized)
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
    source: getAutoSource(recommended)
  };
}
