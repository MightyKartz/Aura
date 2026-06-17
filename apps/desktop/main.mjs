import { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, ipcMain, screen } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '../..');
const rendererPath = join(__dirname, 'renderer/index.html');
const stateDir = () => join(app.getPath('userData'), 'desktop-companion');
const statePath = () => join(stateDir(), 'state.json');

const DEFAULT_STATE = {
  bounds: { width: 310, height: 410 },
  skinId: 'cat-default-v1',
  intensity: 'standard',
  clickThrough: false,
  visible: true
};

let companionWindow;
let tray;
let state = { ...DEFAULT_STATE };

function readState() {
  try {
    const parsed = JSON.parse(readFileSync(statePath(), 'utf8'));
    state = {
      ...DEFAULT_STATE,
      ...parsed,
      bounds: {
        ...DEFAULT_STATE.bounds,
        ...(parsed.bounds || {})
      }
    };
  } catch {
    state = { ...DEFAULT_STATE };
  }
}

function writeState() {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(statePath(), JSON.stringify(state, null, 2));
}

function getInitialBounds() {
  const display = screen.getPrimaryDisplay();
  const width = Math.max(240, Number(state.bounds?.width || DEFAULT_STATE.bounds.width));
  const height = Math.max(300, Number(state.bounds?.height || DEFAULT_STATE.bounds.height));
  const x = Number.isFinite(state.bounds?.x)
    ? state.bounds.x
    : display.workArea.x + display.workArea.width - width - 28;
  const y = Number.isFinite(state.bounds?.y)
    ? state.bounds.y
    : display.workArea.y + display.workArea.height - height - 28;

  return { x, y, width, height };
}

function setClickThrough(enabled) {
  state.clickThrough = Boolean(enabled);
  if (companionWindow && !companionWindow.isDestroyed()) {
    companionWindow.setIgnoreMouseEvents(state.clickThrough, { forward: true });
    companionWindow.webContents.send('aura:desktop-state', state);
  }
  writeState();
  buildTrayMenu();
}

function buildTrayMenu() {
  if (!tray) return;

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: companionWindow?.isVisible() ? 'Hide Aura' : 'Show Aura',
      click: () => toggleVisibility()
    },
    {
      label: state.clickThrough ? 'Disable Click-Through' : 'Enable Click-Through',
      click: () => setClickThrough(!state.clickThrough)
    },
    { type: 'separator' },
    {
      label: 'Quiet',
      type: 'radio',
      checked: state.intensity === 'quiet',
      click: () => setIntensity('quiet')
    },
    {
      label: 'Standard',
      type: 'radio',
      checked: state.intensity === 'standard',
      click: () => setIntensity('standard')
    },
    {
      label: 'Lively',
      type: 'radio',
      checked: state.intensity === 'lively',
      click: () => setIntensity('lively')
    },
    { type: 'separator' },
    { label: 'Quit Aura', role: 'quit' }
  ]));
}

function toggleVisibility() {
  if (!companionWindow || companionWindow.isDestroyed()) return;
  if (companionWindow.isVisible()) {
    companionWindow.hide();
    state.visible = false;
  } else {
    companionWindow.show();
    companionWindow.focus();
    state.visible = true;
  }
  writeState();
  buildTrayMenu();
}

function setIntensity(intensity) {
  state.intensity = intensity;
  companionWindow?.webContents.send('aura:desktop-state', state);
  writeState();
  buildTrayMenu();
}

function rememberBounds() {
  if (!companionWindow || companionWindow.isDestroyed()) return;
  state.bounds = companionWindow.getBounds();
  writeState();
}

function createWindow() {
  companionWindow = new BrowserWindow({
    ...getInitialBounds(),
    minWidth: 220,
    minHeight: 280,
    transparent: true,
    frame: false,
    resizable: true,
    movable: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    title: 'Aura',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  companionWindow.setAlwaysOnTop(true, 'screen-saver');
  companionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  companionWindow.setFullScreenable(false);
  companionWindow.loadFile(rendererPath);
  companionWindow.on('moved', rememberBounds);
  companionWindow.on('resized', rememberBounds);
  companionWindow.on('close', rememberBounds);
  companionWindow.once('ready-to-show', () => {
    if (state.visible) companionWindow.show();
    setClickThrough(state.clickThrough);
    companionWindow.webContents.send('aura:desktop-state', state);
  });
}

function createTray() {
  const iconPath = resolve(appRoot, 'apps/extension/themes/skin-default-top-left.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip('Aura');
  tray.on('click', toggleVisibility);
  buildTrayMenu();
}

ipcMain.handle('aura:get-desktop-state', () => state);
ipcMain.handle('aura:get-skin-registry', () => {
  const registryPath = resolve(appRoot, 'themes/manifests/builtin-skins.json');
  return JSON.parse(readFileSync(registryPath, 'utf8'));
});
ipcMain.handle('aura:resolve-asset-url', (_event, assetPath) => {
  const normalized = String(assetPath || '').replace(/^themes\//, 'apps/extension/themes/');
  return pathToFileURL(resolve(appRoot, normalized)).href;
});
ipcMain.handle('aura:set-click-through', (_event, enabled) => setClickThrough(enabled));
ipcMain.handle('aura:set-intensity', (_event, intensity) => setIntensity(intensity));
ipcMain.handle('aura:set-skin', (_event, skinId) => {
  state.skinId = String(skinId || DEFAULT_STATE.skinId);
  companionWindow?.webContents.send('aura:desktop-state', state);
  writeState();
});
ipcMain.handle('aura:hide', () => {
  if (!companionWindow || companionWindow.isDestroyed()) return;
  companionWindow.hide();
  state.visible = false;
  writeState();
  buildTrayMenu();
});

app.whenReady().then(() => {
  readState();
  createWindow();
  createTray();
  globalShortcut.register('CommandOrControl+Shift+A', toggleVisibility);
  globalShortcut.register('CommandOrControl+Shift+T', () => setClickThrough(!state.clickThrough));
});

app.on('before-quit', writeState);
app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('activate', () => {
  if (!companionWindow || companionWindow.isDestroyed()) {
    createWindow();
  } else {
    companionWindow.show();
  }
});
