const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('auraDesktop', {
  getState: () => ipcRenderer.invoke('aura:get-desktop-state'),
  getSkinRegistry: () => ipcRenderer.invoke('aura:get-skin-registry'),
  resolveAssetUrl: (assetPath) => ipcRenderer.invoke('aura:resolve-asset-url', assetPath),
  setClickThrough: (enabled) => ipcRenderer.invoke('aura:set-click-through', enabled),
  setIntensity: (intensity) => ipcRenderer.invoke('aura:set-intensity', intensity),
  setSkin: (skinId) => ipcRenderer.invoke('aura:set-skin', skinId),
  hide: () => ipcRenderer.invoke('aura:hide'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('aura:desktop-state', listener);
    return () => ipcRenderer.off('aura:desktop-state', listener);
  }
});
