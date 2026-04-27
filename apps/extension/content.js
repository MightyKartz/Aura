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
  const wait = (delayMs) => new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
  const loadControllerOnce = (attempt) => {
    const cacheBust = attempt > 0 ? `?auraAttempt=${attempt}-${Date.now()}` : '';
    return import(chrome.runtime.getURL(`runtime/content-controller.js${cacheBust}`))
      .catch(() => import(`./runtime/content-controller.js${cacheBust}`));
  };
  const loadController = async () => {
    let lastError = null;
    const retryDelays = [0, 120, 360, 800, 1600, 3200, 5200];
    for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
      const delayMs = retryDelays[attempt];
      if (delayMs > 0) {
        await wait(delayMs);
      }
      try {
        return await loadControllerOnce(attempt);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  };

  void loadController()
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
