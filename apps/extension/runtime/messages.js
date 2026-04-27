export const FORCE_SYNC_MESSAGE_TYPE = 'aura:force-sync';
export const MARK_MOMENT_MESSAGE_TYPE = 'aura:mark-moment';

export function createForceSyncMessage(reason = 'external') {
  return {
    type: FORCE_SYNC_MESSAGE_TYPE,
    reason
  };
}

export function createMarkMomentMessage(source = 'external') {
  return {
    type: MARK_MOMENT_MESSAGE_TYPE,
    source
  };
}

export function isForceSyncMessage(message) {
  return message?.type === FORCE_SYNC_MESSAGE_TYPE;
}

export function isMarkMomentMessage(message) {
  return message?.type === MARK_MOMENT_MESSAGE_TYPE;
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

export async function sendMarkMomentToTab(tabId, source = 'external') {
  if (!Number.isInteger(tabId)) return false;

  try {
    await chrome.tabs.sendMessage(tabId, createMarkMomentMessage(source));
    return true;
  } catch {
    return false;
  }
}
