export function getSkinById(registry, skinId) {
  return registry?.skins?.find((skin) => skin.id === skinId) ?? null;
}

export function getDefaultSkin(registry) {
  return getSkinById(registry, registry?.defaultSkinId) ?? registry?.skins?.[0] ?? null;
}

export function recommendSkinByTitle(registry, title = '') {
  const normalized = String(title).trim();
  if (!normalized) return getDefaultSkin(registry);

  const scored = (registry?.skins ?? [])
    .filter((skin) => skin.category !== 'default')
    .map((skin) => ({
      skin,
      score: (skin.match?.keywords ?? []).reduce(
        (sum, keyword) => sum + (normalized.includes(keyword) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].skin : getDefaultSkin(registry);
}

export function resolveActiveSkin(registry, settings = {}, title = '') {
  if (settings?.themeMode === 'manual' && settings?.selectedSkinId) {
    return getSkinById(registry, settings.selectedSkinId) ?? recommendSkinByTitle(registry, title);
  }
  return recommendSkinByTitle(registry, title);
}
