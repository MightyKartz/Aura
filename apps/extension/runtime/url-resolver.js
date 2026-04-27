export function resolveRuntimeAssetUrl(path, baseUrl = import.meta.url) {
  if (!path) return '';

  try {
    if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
      return chrome.runtime.getURL(path);
    }
  } catch {
    // Fall through to relative URL resolution for standalone preview pages.
  }

  return new URL(`../${path}`, baseUrl).href;
}
