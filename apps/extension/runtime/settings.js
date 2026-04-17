export const STORAGE_KEY = 'aura:mvp:settings';

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  mode: 'standard',
  themeMode: 'auto',
  selectedSkinId: ''
});

export const LEGACY_SKIN_MAP = Object.freeze({
  suspense: 'cat-suspense-v1',
  'ancient-romance': 'cat-ancient-romance-v1',
  'urban-romance': 'cat-default-v1'
});

export function intensityToMode(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.mode;
  if (numeric < 35) return 'quiet';
  if (numeric < 70) return 'standard';
  return 'lively';
}

export function normalizeSettings(raw = {}) {
  const selectedSkinId = typeof raw.selectedSkinId === 'string'
    ? raw.selectedSkinId
    : LEGACY_SKIN_MAP[String(raw.theme || '')] ?? '';

  return {
    enabled: raw.enabled !== false,
    mode: raw.mode === 'quiet' || raw.mode === 'standard' || raw.mode === 'lively'
      ? raw.mode
      : intensityToMode(raw.intensity),
    themeMode: raw.themeMode === 'manual'
      ? 'manual'
      : selectedSkinId
        ? 'manual'
        : 'auto',
    selectedSkinId
  };
}

export async function readSettings(storageArea = chrome.storage.sync) {
  const result = await storageArea.get(STORAGE_KEY);
  return normalizeSettings(result?.[STORAGE_KEY] ?? DEFAULT_SETTINGS);
}

export async function writeSettings(settings, storageArea = chrome.storage.sync) {
  const normalized = normalizeSettings(settings);
  await storageArea.set({
    [STORAGE_KEY]: normalized
  });
  return normalized;
}

export async function patchSettings(patch, storageArea = chrome.storage.sync) {
  const current = await readSettings(storageArea);
  return writeSettings(
    {
      ...current,
      ...patch
    },
    storageArea
  );
}

export async function toggleEnabled(storageArea = chrome.storage.sync) {
  const current = await readSettings(storageArea);
  return writeSettings(
    {
      ...current,
      enabled: !current.enabled
    },
    storageArea
  );
}
