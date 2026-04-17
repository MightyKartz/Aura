if (typeof globalThis.__AURA_CORNER_DECOR_DISPOSE__ === 'function') {
  try {
    globalThis.__AURA_CORNER_DECOR_DISPOSE__('reinject');
  } catch (error) {
    console.warn('[Aura] failed to dispose previous runtime:', error);
  }
}

if (window.top !== window) {
  globalThis.__AURA_CORNER_DECOR_ACTIVE__ = false;
  globalThis.__AURA_CORNER_DECOR_DISPOSE__ = null;
} else {
  void import(chrome.runtime.getURL('runtime/content-controller.js'))
    .then(({ startAuraContentController }) => {
      startAuraContentController();
    })
    .catch((error) => {
      console.warn('[Aura] failed to load content controller:', error);
      globalThis.__AURA_CORNER_DECOR_ACTIVE__ = false;
      globalThis.__AURA_CORNER_DECOR_DISPOSE__ = null;
      globalThis.__AURA_CORNER_DECOR_LAST_ERROR__ = {
        stage: 'runtime-import',
        message: error instanceof Error ? error.message : String(error),
        updatedAt: Date.now()
      };
    });
}
