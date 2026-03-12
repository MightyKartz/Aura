const key = 'aura:mvp:settings';

async function getSettings() {
  const existing = await chrome.storage.sync.get(key);
  return existing[key] ?? {
    enabled: true,
    intensity: 45,
    theme: 'tencent-default'
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(key);
  if (!existing[key]) {
    await chrome.storage.sync.set({
      [key]: {
        enabled: true,
        intensity: 45,
        theme: 'tencent-default'
      }
    });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-aura') return;
  const settings = await getSettings();
  await chrome.storage.sync.set({
    [key]: {
      ...settings,
      enabled: !settings.enabled
    }
  });
});
