export const FORCE_SYNC_MESSAGE_TYPE = 'aura:force-sync';

export function createForceSyncMessage(reason = 'external') {
  return {
    type: FORCE_SYNC_MESSAGE_TYPE,
    reason
  };
}

export function isForceSyncMessage(message) {
  return message?.type === FORCE_SYNC_MESSAGE_TYPE;
}

export async function sendForceSyncToTab(tabId, reason = 'external') {
  if (!Number.isInteger(tabId)) return false;

  try {
    await chrome.tabs.sendMessage(tabId, createForceSyncMessage(reason));
    return true;
  } catch {
    return false;
  }
}
