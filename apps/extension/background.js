import { sendForceSyncToTab } from './runtime/messages.js';
import { toggleEnabled, readSettings, writeSettings } from './runtime/settings.js';
import { findSiteAdapter } from './runtime/site-adapters.js';

function isSupportedTab(tab) {
  return Number.isInteger(tab?.id) && Boolean(findSiteAdapter(tab.url || ''));
}

async function removeAuraCssFromTab(tabId) {
  try {
    await chrome.scripting.removeCSS({
      target: { tabId },
      files: ['content.css']
    });
  } catch {
    // removeCSS throws when the stylesheet was never programmatically inserted.
  }
}

async function injectAuraIntoTab(tabId) {
  try {
    await removeAuraCssFromTab(tabId);
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content.css']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });

    return true;
  } catch (error) {
    console.warn('[Aura background] reinject skipped:', error);
    return false;
  }
}

async function ensureAuraRuntimeOnTab(tab, reason) {
  if (!isSupportedTab(tab)) return false;

  const tabId = tab.id;
  const delivered = await sendForceSyncToTab(tabId, reason);
  if (delivered) return true;

  const injected = await injectAuraIntoTab(tabId);
  if (!injected) return false;

  await sendForceSyncToTab(tabId, reason);
  return true;
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await readSettings();
  await writeSettings(settings);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-aura') return;

  await toggleEnabled();
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await ensureAuraRuntimeOnTab(activeTab, 'background:toggle');
});
