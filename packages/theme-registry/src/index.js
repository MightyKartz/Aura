export function getThemeById(registry, themeId) {
  return registry?.themes?.find((theme) => theme.id === themeId) ?? null;
}

export function getDefaultTheme(registry) {
  return getThemeById(registry, registry?.defaultThemeId) ?? registry?.themes?.[0] ?? null;
}

export function recommendThemeByTitle(registry, title = '') {
  const normalized = String(title).trim();
  if (!normalized) return getDefaultTheme(registry);

  const exactShow = registry.themes.find((theme) =>
    theme.category === 'show' && theme.match.keywords.some((keyword) => normalized.includes(keyword))
  );
  if (exactShow) return exactShow;

  const scored = registry.themes
    .filter((theme) => theme.category !== 'default')
    .map((theme) => ({
      theme,
      score: theme.match.keywords.reduce((sum, keyword) => sum + (normalized.includes(keyword) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].theme : getDefaultTheme(registry);
}

export function resolveActiveTheme(registry, selectedThemeId, title = '') {
  if (selectedThemeId && selectedThemeId !== registry.defaultThemeId) {
    return getThemeById(registry, selectedThemeId) ?? recommendThemeByTitle(registry, title);
  }
  return recommendThemeByTitle(registry, title);
}
