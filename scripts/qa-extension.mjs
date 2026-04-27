import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const dist = resolve(root, 'dist');
const outputDir = resolve(root, 'output/qa-extension');
const settingsKey = 'aura:mvp:settings';
const shouldCaptureScreenshots = process.env.AURA_QA_SCREENSHOTS === '1';
let targetUrl = '';

const chromeCandidates = [
  process.env.AURA_CHROME_BIN,
  '/Users/kartz/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
].filter(Boolean);

function assert(condition, message, detail = null) {
  if (!condition) {
    const error = new Error(message);
    error.detail = detail;
    throw error;
  }
}

function findChromeBinary() {
  const found = chromeCandidates.find((candidate) => existsSync(candidate));
  assert(
    found,
    `Chrome binary not found. Set AURA_CHROME_BIN or install Chrome for Testing. Tried: ${chromeCandidates.join(', ')}`
  );
  return found;
}

function runBuild() {
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], {
    cwd: root,
    stdio: 'inherit'
  });
  assert(result.status === 0, 'Build failed before extension QA.');
}

function ensureQaCertificate() {
  const certDir = resolve(root, 'tmp/qa-cert');
  const keyPath = resolve(certDir, 'vqq-local.key');
  const certPath = resolve(certDir, 'vqq-local.crt');
  if (existsSync(keyPath) && existsSync(certPath)) return { keyPath, certPath };

  mkdirSync(certDir, { recursive: true });
  const result = spawnSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    keyPath,
    '-out',
    certPath,
    '-subj',
    '/CN=v.qq.com',
    '-days',
    '2'
  ], {
    cwd: root,
    stdio: 'ignore'
  });
  assert(result.status === 0, 'Could not create local HTTPS certificate for v.qq.com QA.');
  return { keyPath, certPath };
}

function startLocalTencentServer() {
  const { keyPath, certPath } = ensureQaCertificate();
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>Aura Local QA - 腾讯视频</title></head><body></body></html>';
  const server = createServer({
    key: readFileSync(keyPath),
    cert: readFileSync(certPath)
  }, (_request, response) => {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store'
    });
    response.end(html);
  });

  return new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolvePromise({
        server,
        port: address.port,
        close: () => new Promise((resolveClose) => server.close(resolveClose))
      });
    });
  });
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function getJson(url) {
  const response = await fetch(url);
  assert(response.ok, `CDP request failed: ${response.status} ${url}`);
  return response.json();
}

async function waitForJson(url, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await getJson(url);
    } catch {
      await sleep(100);
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;

    const handlers = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      handlers.reject(new Error(message.error.message || JSON.stringify(message.error)));
    } else {
      handlers.resolve(message.result);
    }
  });

  return new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener('open', () => {
      resolvePromise({
        send(method, params = {}) {
          const id = nextId++;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveCall, rejectCall) => {
            const timeout = setTimeout(() => {
              pending.delete(id);
              rejectCall(new Error(`CDP command timed out: ${method}`));
            }, 15000);
            pending.set(id, {
              resolve(value) {
                clearTimeout(timeout);
                resolveCall(value);
              },
              reject(error) {
                clearTimeout(timeout);
                rejectCall(error);
              }
            });
          });
        },
        close() {
          socket.close();
        }
      });
    });
    socket.addEventListener('error', rejectPromise);
  });
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(description || 'Runtime.evaluate failed');
  }
  return result.result.value;
}

async function waitFor(condition, timeoutMs = 10000, intervalMs = 150) {
  const startedAt = Date.now();
  let lastValue = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await condition().catch((error) => ({ error: error.message }));
    if (lastValue) return lastValue;
    await sleep(intervalMs);
  }
  return lastValue;
}

async function findTarget(port, predicate, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find(predicate);
    if (target) return target;
    await sleep(150);
  }
  return null;
}

async function runInTab(controller, tabId, func, args = []) {
  const expression = `
    chrome.scripting.executeScript({
      target: { tabId: ${JSON.stringify(tabId)} },
      func: ${func.toString()},
      args: ${JSON.stringify(args)}
    }).then((results) => results?.[0]?.result ?? null)
  `;
  return evaluate(controller, expression);
}

async function waitForTabScriptable(controller, tabId, timeoutMs = 12000) {
  return waitFor(async () => {
    const result = await runInTab(controller, tabId, () => ({
      readyState: document.readyState,
      href: location.href
    })).catch(() => null);
    return result?.href ? result : null;
  }, timeoutMs, 250);
}

async function setSettings(worker, settings) {
  await evaluate(
    worker,
    `chrome.storage.sync.set({ ${JSON.stringify(settingsKey)}: ${JSON.stringify({
      ...settings,
      __qaSyncNonce: Date.now()
    })} })`
  );
}

async function sendForceSync(controller, tabId, reason) {
  await evaluate(
    controller,
    `chrome.tabs.sendMessage(${JSON.stringify(tabId)}, { type: 'aura:force-sync', reason: ${JSON.stringify(reason)} }).catch(() => null)`
  );
}

async function captureScreenshot(page, fileName) {
  try {
    await page.send('Page.bringToFront').catch(() => null);
    const result = await page.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      fromSurface: true
    });
    const outputPath = resolve(outputDir, fileName);
    writeFileSync(outputPath, Buffer.from(result.data, 'base64'));
    return outputPath;
  } catch (error) {
    console.warn(`Aura QA screenshot skipped (${fileName}): ${error.message}`);
    return '';
  }
}

async function saveOptionalScreenshot(page, screenshots, fileName) {
  if (!shouldCaptureScreenshots) return;
  const path = await captureScreenshot(page, fileName);
  if (path) screenshots.push(path);
}

async function dispatchPointerMove(page, { x = 900, y = 460 } = {}) {
  await page.send('Page.bringToFront').catch(() => null);
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y,
    button: 'none',
    pointerType: 'mouse'
  });
}

function setupFakeTencentPlayer(config = {}) {
  document.title = `${config.title || 'Aura Local QA'} - 腾讯视频`;
  document.documentElement.style.background = '#05070a';
  document.body.style.cssText = [
    'margin:0',
    'min-height:100vh',
    'background:#05070a',
    'overflow:hidden'
  ].join(';');

  document.querySelector('#aura-qa-player')?.remove();

  const shell = document.createElement('main');
  shell.id = 'aura-qa-player';
  shell.className = 'main-player-container';
  shell.style.cssText = [
    'position:fixed',
    'left:72px',
    'top:72px',
    'width:1280px',
    'height:720px',
    'display:block',
    'visibility:visible',
    'opacity:1',
    'overflow:hidden',
    'background:linear-gradient(135deg,#07111f 0%,#142234 54%,#070a0e 100%)',
    'box-shadow:0 24px 80px rgba(0,0,0,.45)',
    'z-index:10'
  ].join(';');

  const title = document.createElement('h1');
  title.setAttribute('data-role', 'video-title');
  title.textContent = config.title || '悬疑探案 夜幕追踪';
  title.style.cssText = [
    'position:absolute',
    'left:28px',
    'top:24px',
    'margin:0',
    'font:600 28px/1.2 sans-serif',
    'color:rgba(255,255,255,.92)',
    'z-index:2'
  ].join(';');

  const video = document.createElement('video');
  if (!config.noVideo) {
    video.muted = true;
    video.playsInline = true;
    video.style.cssText = [
      'display:block',
      'width:100%',
      'height:100%',
      'background:radial-gradient(circle at 42% 38%,rgba(121,166,196,.48),transparent 24%),linear-gradient(120deg,#09131f,#182a36 64%,#07090d)',
      'object-fit:cover'
    ].join(';');

    Object.defineProperty(video, 'paused', {
      configurable: true,
      get: () => window.__AURA_QA_PAUSED__ === true
    });
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => window.__AURA_QA_TIME__ || 95,
      set: (value) => {
        window.__AURA_QA_TIME__ = Number(value) || 0;
      }
    });
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      get: () => 4
    });
  }

  const controls = document.createElement('div');
  controls.className = 'txp_controls';
  controls.setAttribute('data-aura-qa-controls', '1');
  controls.style.cssText = [
    'position:absolute',
    'left:0',
    'right:0',
    'bottom:0',
    'height:72px',
    'background:linear-gradient(0deg,rgba(0,0,0,.72),rgba(0,0,0,0))',
    'opacity:0',
    'visibility:hidden',
    'z-index:3'
  ].join(';');

  if (config.noVideo) {
    const fakeSurface = document.createElement('div');
    fakeSurface.className = 'wasm-player-fake-video';
    fakeSurface.style.cssText = [
      'display:block',
      'width:100%',
      'height:100%',
      'background:radial-gradient(circle at 42% 38%,rgba(121,166,196,.34),transparent 24%),linear-gradient(120deg,#111723,#263042 64%,#07090d)'
    ].join(';');
    shell.append(fakeSurface, title, controls);
  } else {
    shell.append(video, title, controls);
  }
  document.body.append(shell);
  window.__AURA_QA_PAUSED__ = Boolean(config.paused);
  window.__AURA_QA_TIME__ = Number(config.currentTime || 95);
  return {
    ok: true,
    rect: shell.getBoundingClientRect().toJSON()
  };
}

function setQaPlaybackState(state = {}) {
  window.__AURA_QA_PAUSED__ = Boolean(state.paused);
  const controls = document.querySelector('[data-aura-qa-controls]');
  if (controls instanceof HTMLElement) {
    controls.style.opacity = state.controlsVisible ? '1' : '0';
    controls.style.visibility = state.controlsVisible ? 'visible' : 'hidden';
  }
  if (state.pointer) {
    document.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientX: 900,
      clientY: 460
    }));
  }
  return true;
}

function collectAuraSnapshot(label) {
  const root = document.querySelector('#aura-root');
  const base = root?.querySelector('.aura-ornament__image--base');
  const topInfo = root?.querySelector('.aura-ornament--top-left .aura-ornament__info');
  const feedback = root?.querySelector('[data-info="feedback"]');
  const hotspot = root?.querySelector('[data-companion-hotspot]');
  const panel = root?.querySelector('[data-companion-panel]');
  const panelButtons = root?.querySelectorAll('[data-aura-action]');
  const visiblePanelButtons = Array.from(panelButtons || []).filter((button) => {
    if (!(button instanceof HTMLElement)) return false;
    const buttonStyle = getComputedStyle(button);
    return !button.hidden && buttonStyle.display !== 'none' && buttonStyle.visibility !== 'hidden';
  });
  const panelIcons = root?.querySelectorAll('.aura-companion-panel__icon');
  const petals = root?.querySelectorAll('.aura-ornament__petal');
  const bottomBody = root?.querySelector('.aura-ornament--bottom-right .aura-ornament__body');
  const bottomHalo = root?.querySelector('.aura-ornament--bottom-right .aura-ornament__halo');
  const atmosphere = root?.querySelector('.aura-ornament__atmosphere');
  const style = root ? getComputedStyle(root) : null;
  const baseStyle = base ? getComputedStyle(base) : null;
  const feedbackStyle = feedback ? getComputedStyle(feedback) : null;
  const hotspotStyle = hotspot ? getComputedStyle(hotspot) : null;
  const panelStyle = panel ? getComputedStyle(panel) : null;
  const bottomBodyStyle = bottomBody ? getComputedStyle(bottomBody) : null;
  const bottomHaloStyle = bottomHalo ? getComputedStyle(bottomHalo) : null;
  const atmosphereStyle = atmosphere ? getComputedStyle(atmosphere) : null;
  const hotspotRect = hotspot ? hotspot.getBoundingClientRect() : null;
  const panelRect = panel ? panel.getBoundingClientRect() : null;
  const feedbackRect = feedback ? feedback.getBoundingClientRect() : null;
  const status = globalThis.__AURA_CORNER_DECOR_RUNTIME__?.status || null;
  return {
    label,
    active: Boolean(globalThis.__AURA_CORNER_DECOR_ACTIVE__),
    root: Boolean(root),
    visible: root?.dataset.visible || '',
    skinId: root?.dataset.skinId || '',
    skin: root?.dataset.skin || '',
    skinName: root?.dataset.skinName || '',
    motionPreset: root?.dataset.motionPreset || '',
    motionState: root?.dataset.motionState || '',
    attention: root?.dataset.attention || '',
    pointerAccepted: root?.dataset.pointerAccepted || '',
    pointerReason: root?.dataset.pointerReason || '',
    companionPanelOpen: root?.dataset.companionPanelOpen || '',
    companionPanelReason: root?.dataset.companionPanelReason || '',
    controlsVisible: status?.controlsVisible ?? null,
    statusAttentionActive: status?.attentionActive ?? null,
    statusPointerAccepted: status?.pointerAccepted ?? null,
    statusPointerReason: status?.pointerReason || '',
    statusPointerTarget: status?.pointerTarget || '',
    statusPointerContainerRect: status?.pointerContainerRect || null,
    statusPointerVideoRect: status?.pointerVideoRect || null,
    playbackState: status?.playbackState ?? '',
    state: status?.state || globalThis.__AURA_CORNER_DECOR_RUNTIME__?.state || '',
    stage: status?.stage || globalThis.__AURA_CORNER_DECOR_RUNTIME__?.stage || '',
    syncState: status?.syncState || globalThis.__AURA_CORNER_DECOR_RUNTIME__?.syncState || '',
    lastSyncReason: status?.lastSyncReason || globalThis.__AURA_CORNER_DECOR_RUNTIME__?.lastSyncReason || '',
    renderActive: status?.renderActive ?? null,
    canMarkMoment: root?.dataset.canMarkMoment || '',
    canReplayLatestMark: root?.dataset.canReplayLatestMark || '',
    statusCanMarkMoment: status?.canMarkMoment ?? null,
    statusCanReplayLatestMark: status?.canReplayLatestMark ?? null,
    playbackControlReason: status?.playbackControlReason || '',
    topInfoExists: Boolean(topInfo),
    atmospherePetalCount: petals?.length || 0,
    atmosphereDisplay: atmosphereStyle?.display || '',
    feedbackVisible: root?.dataset.feedbackVisible || '',
    feedbackText: feedback?.textContent || '',
    feedbackOpacity: feedbackStyle?.opacity || '',
    feedbackRect: feedbackRect ? {
      left: feedbackRect.left,
      top: feedbackRect.top,
      width: feedbackRect.width,
      height: feedbackRect.height,
      right: feedbackRect.right,
      bottom: feedbackRect.bottom
    } : null,
    companionHotspotExists: Boolean(hotspot),
    companionHotspotPointerEvents: hotspotStyle?.pointerEvents || '',
    companionHotspotRect: hotspotRect ? {
      left: hotspotRect.left,
      top: hotspotRect.top,
      width: hotspotRect.width,
      height: hotspotRect.height,
      centerX: hotspotRect.left + hotspotRect.width / 2,
      centerY: hotspotRect.top + hotspotRect.height / 2
    } : null,
    companionPanelExists: Boolean(panel),
    companionPanelButtonCount: panelButtons?.length || 0,
    companionPanelVisibleButtonCount: visiblePanelButtons.length,
    companionPanelIconCount: panelIcons?.length || 0,
    companionPanelText: panel?.textContent?.trim() || '',
    latestMarkLabel: root?.dataset.latestMarkLabel || '',
    latestMarkTimeSec: root?.dataset.latestMarkTimeSec || '',
    companionPanelOpacity: panelStyle?.opacity || '',
    companionPanelPointerEvents: panelStyle?.pointerEvents || '',
    companionPanelRect: panelRect ? {
      left: panelRect.left,
      top: panelRect.top,
      width: panelRect.width,
      height: panelRect.height,
      centerX: panelRect.left + panelRect.width / 2,
      centerY: panelRect.top + panelRect.height / 2
    } : null,
    bottomProbeX: style?.getPropertyValue('--aura-bottom-probe-x').trim() || '',
    bottomDrift: style?.getPropertyValue('--aura-bottom-drift').trim() || '',
    bottomTilt: style?.getPropertyValue('--aura-bottom-tilt').trim() || '',
    bottomLift: style?.getPropertyValue('--aura-bottom-motion-lift').trim() || '',
    bottomScalePeak: style?.getPropertyValue('--aura-bottom-scale-peak').trim() || '',
    companionHaloOpacity: style?.getPropertyValue('--aura-companion-halo-opacity').trim() || '',
    companionHaloScale: style?.getPropertyValue('--aura-companion-halo-scale').trim() || '',
    bottomHaloExists: Boolean(bottomHalo),
    bottomHaloAnimationName: bottomHaloStyle?.animationName || '',
    baseOpacity: baseStyle?.opacity || '',
    baseTransform: baseStyle?.transform || '',
    bottomBodyAnimationName: bottomBodyStyle?.animationName || '',
    baseSize: base ? [base.naturalWidth, base.naturalHeight] : null,
    error: globalThis.__AURA_CORNER_DECOR_LAST_ERROR__ || null
  };
}

function clickAuraPanelAction(action) {
  const button = document.querySelector(`[data-aura-action="${action}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    return {
      ok: false,
      reason: 'button-missing'
    };
  }

  button.click();
  return {
    ok: true
  };
}

function rectsOverlap(a = null, b = null) {
  if (!(a && b)) return false;
  return a.left < b.left + b.width
    && a.left + a.width > b.left
    && a.top < b.top + b.height
    && a.top + a.height > b.top;
}

async function main() {
  runBuild();
  mkdirSync(outputDir, { recursive: true });

  const chromeBinary = findChromeBinary();
  const port = 9400 + Math.floor(Math.random() * 400);
  const userDataDir = resolve(tmpdir(), `aura-extension-qa-${Date.now()}`);
  const localTencent = await startLocalTencentServer();
  targetUrl = `https://v.qq.com:${localTencent.port}/x/cover/aura-local-qa/aura-local.html`;
  const chrome = spawn(chromeBinary, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    `--load-extension=${dist}`,
    `--disable-extensions-except=${dist}`,
    '--host-resolver-rules=MAP v.qq.com 127.0.0.1',
    '--ignore-certificate-errors',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--window-size=1440,900',
    'about:blank'
  ], {
    stdio: 'ignore'
  });

  const snapshots = {};
  const screenshots = [];
  let browser = null;
  let page = null;
  let worker = null;
  let controller = null;

  try {
    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
    browser = await connectCdp(version.webSocketDebuggerUrl);

    const workerTarget = await findTarget(
      port,
      (entry) => entry.type === 'service_worker' && entry.url.endsWith('/background.js')
    );
    assert(workerTarget, 'Aura extension service worker was not loaded.');
    worker = await connectCdp(workerTarget.webSocketDebuggerUrl);
    await worker.send('Runtime.enable');

    const extensionId = new URL(workerTarget.url).host;
    const controllerTarget = await browser.send('Target.createTarget', {
      url: `chrome-extension://${extensionId}/skin-studio.html?qa=extension`,
      active: false
    });
    assert(controllerTarget?.targetId, 'Could not create Aura extension controller page.', controllerTarget);
    const controllerPageTarget = await findTarget(
      port,
      (entry) => entry.type === 'page' && entry.id === controllerTarget.targetId
    );
    assert(controllerPageTarget, 'Could not find Aura extension controller page target.');
    controller = await connectCdp(controllerPageTarget.webSocketDebuggerUrl);
    await controller.send('Runtime.enable');

    const tab = await evaluate(
      controller,
      `chrome.tabs.create({ url: ${JSON.stringify(targetUrl)}, active: true }).then((tab) => ({ id: tab.id, url: tab.url, title: tab.title || '' }))`
    );
    assert(tab?.id, 'Could not create Tencent QA tab through extension controller.', tab);
    const pageTarget = await findTarget(
      port,
      (entry) => entry.type === 'page'
        && (
          String(entry.url || '').startsWith(targetUrl)
          || String(entry.url || '').startsWith('https://v.qq.com/')
        )
    );
    assert(pageTarget, 'Could not find QA page target.');
    page = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Page.stopLoading').catch(() => null);
    const scriptableTab = await waitForTabScriptable(controller, tab.id, 18000);
    assert(scriptableTab?.href, 'Tencent QA tab did not become scriptable.', scriptableTab);

    await setSettings(worker, {
      enabled: true,
      mode: 'standard',
      themeMode: 'manual',
      selectedSkinId: 'cat-suspense-v1'
    });

    const playerSetup = await runInTab(controller, tab.id, setupFakeTencentPlayer, [{
      title: '悬疑探案 夜幕追踪',
      paused: false,
      currentTime: 95
    }]);
    assert(playerSetup?.ok, 'Failed to set up fake Tencent player.', playerSetup);

    await evaluate(
      controller,
      `Promise.all([
        chrome.scripting.insertCSS({ target: { tabId: ${JSON.stringify(tab.id)} }, files: ['content.css'] }),
        chrome.scripting.executeScript({ target: { tabId: ${JSON.stringify(tab.id)} }, files: ['content.js'] })
      ]).then(() => true)`
    );
    await sendForceSync(controller, tab.id, 'qa-extension:init');

    let renderNudged = false;
    const rendered = await waitFor(async () => {
      const snapshot = await runInTab(controller, tab.id, collectAuraSnapshot, ['render-wait']);
      snapshots.renderWait = snapshot;
      if (!renderNudged && snapshot?.active && snapshot?.state === 'ready') {
        renderNudged = true;
        await setSettings(worker, {
          enabled: true,
          mode: 'standard',
          themeMode: 'manual',
          selectedSkinId: 'cat-suspense-v1'
        });
        await sendForceSync(controller, tab.id, 'qa-extension:init-nudge');
      }
      return snapshot?.state === 'rendered' && snapshot?.visible === '1' ? snapshot : null;
    }, 12000);
    assert(rendered, 'Aura did not render in QA harness.');

    await runInTab(controller, tab.id, setQaPlaybackState, [{ controlsVisible: false, paused: false }]);
    await sleep(1900);
    await sendForceSync(controller, tab.id, 'qa-extension:idle-settle');
    await sleep(220);
    snapshots.idle = await runInTab(controller, tab.id, collectAuraSnapshot, ['idle']);
    await saveOptionalScreenshot(page, screenshots, 'idle.png');

    await runInTab(controller, tab.id, setQaPlaybackState, [{ controlsVisible: false, paused: false }]);
    await dispatchPointerMove(page);
    await sendForceSync(controller, tab.id, 'qa-extension:pointer');
    await sleep(650);
    snapshots.attention = await runInTab(controller, tab.id, collectAuraSnapshot, ['attention']);
    await saveOptionalScreenshot(page, screenshots, 'attention.png');

    await runInTab(controller, tab.id, setQaPlaybackState, [{ controlsVisible: true, paused: false }]);
    await dispatchPointerMove(page);
    await sendForceSync(controller, tab.id, 'qa-extension:controls');
    await sleep(460);
    snapshots.controlsAttention = await runInTab(controller, tab.id, collectAuraSnapshot, ['controls-attention']);

    await runInTab(controller, tab.id, setQaPlaybackState, [{ controlsVisible: false, paused: true }]);
    await dispatchPointerMove(page);
    await sendForceSync(controller, tab.id, 'qa-extension:paused');
    await sleep(650);
    snapshots.paused = await runInTab(controller, tab.id, collectAuraSnapshot, ['paused']);

    await setSettings(worker, {
      enabled: false,
      mode: 'standard',
      themeMode: 'manual',
      selectedSkinId: 'cat-suspense-v1'
    });
    await sendForceSync(controller, tab.id, 'qa-extension:disable');
    await sleep(500);
    snapshots.disabled = await runInTab(controller, tab.id, collectAuraSnapshot, ['disabled']);

    assert(snapshots.idle.skin === 'cat-suspense-v1', 'Suspense skin did not render.', snapshots.idle);
    assert(snapshots.idle.motionPreset === 'watchful', 'Suspense skin should use watchful motion.', snapshots.idle);
    assert(snapshots.idle.motionState === 'idle-watch', 'Idle suspense motion should be visible watch mode.', snapshots.idle);
    assert(
      JSON.stringify(snapshots.idle.baseSize) === JSON.stringify([1536, 1920]),
      'Suspense base frame should use the production 1536x1920 PNG canvas.',
      snapshots.idle
    );
    assert(
      snapshots.attention.motionState === 'idle-watch',
      'Pointer attention should keep suspense on the single-image watch path.',
      snapshots.attention
    );
    assert(
      ['idle-watch', 'controls-softened'].includes(snapshots.controlsAttention.motionState),
      'Visible controls should keep suspense on the single-image path.',
      snapshots.controlsAttention
    );
    assert(
      ['paused-still', 'controls-softened'].includes(snapshots.paused.motionState),
      'Paused suspense motion should keep the single-image path.',
      snapshots.paused
    );
    assert(snapshots.disabled.state === 'disabled', 'Disabled setting should update runtime state.', snapshots.disabled);
    assert(snapshots.disabled.root === false, 'Disabled setting should remove overlay root.', snapshots.disabled);

    await setSettings(worker, {
      enabled: true,
      mode: 'standard',
      themeMode: 'manual',
      selectedSkinId: 'cat-rain-detective-v1'
    });
    await runInTab(controller, tab.id, setupFakeTencentPlayer, [{
      title: '雨夜谜案 黑猫侦探',
      paused: false,
      currentTime: 116
    }]);
    await sendForceSync(controller, tab.id, 'qa-extension:rain-detective:init');
    const rainRendered = await waitFor(async () => {
      const snapshot = await runInTab(controller, tab.id, collectAuraSnapshot, ['rain-render-wait']);
      snapshots.rainRenderWait = snapshot;
      return snapshot?.state === 'rendered' && snapshot?.visible === '1' && snapshot?.skin === 'cat-rain-detective-v1'
        ? snapshot
        : null;
    }, 12000);
    assert(rainRendered, 'Rain detective skin did not render in QA harness.');

    await runInTab(controller, tab.id, setQaPlaybackState, [{ controlsVisible: false, paused: false }]);
    await sleep(1200);
    snapshots.rainIdle = await runInTab(controller, tab.id, collectAuraSnapshot, ['rain-idle']);
    await saveOptionalScreenshot(page, screenshots, 'rain-detective-idle.png');

    await dispatchPointerMove(page);
    await sendForceSync(controller, tab.id, 'qa-extension:rain-detective:pointer');
    await sleep(420);
    snapshots.rainAttention = await runInTab(controller, tab.id, collectAuraSnapshot, ['rain-attention']);
    await saveOptionalScreenshot(page, screenshots, 'rain-detective-attention.png');

    await runInTab(controller, tab.id, setQaPlaybackState, [{ controlsVisible: false, paused: true }]);
    await sendForceSync(controller, tab.id, 'qa-extension:rain-detective:paused');
    await sleep(520);
    snapshots.rainPaused = await runInTab(controller, tab.id, collectAuraSnapshot, ['rain-paused']);

    assert(snapshots.rainIdle.skin === 'cat-rain-detective-v1', 'Rain detective skin did not render.', snapshots.rainIdle);
    assert(snapshots.rainIdle.motionPreset === 'detective-cat', 'Rain detective should use detective-cat motion.', snapshots.rainIdle);
    assert(snapshots.rainIdle.motionState === 'idle-watch', 'Rain detective should not inherit stale pointer attention on first render.', snapshots.rainIdle);
    assert(
      JSON.stringify(snapshots.rainIdle.baseSize) === JSON.stringify([1536, 1920]),
      'Rain detective base frame should use the production 1536x1920 PNG canvas.',
      snapshots.rainIdle
    );
    assert(snapshots.rainAttention.motionState === 'idle-watch', 'Rain detective pointer attention should keep the single-image watch path.', snapshots.rainAttention);
    assert(
      ['paused-still', 'controls-softened'].includes(snapshots.rainPaused.motionState),
      'Rain detective paused motion should keep the single-image path.',
      snapshots.rainPaused
    );

    await setSettings(worker, {
      enabled: true,
      mode: 'standard',
      themeMode: 'manual',
      selectedSkinId: 'general-peach-guard-v1'
    });
    await runInTab(controller, tab.id, setupFakeTencentPlayer, [{
      title: '桃林权谋 将军守望',
      paused: false,
      currentTime: 128
    }]);
    await dispatchPointerMove(page, { x: 10, y: 10 });
    await sendForceSync(controller, tab.id, 'qa-extension:peach-guard:init');
    const peachRendered = await waitFor(async () => {
      const snapshot = await runInTab(controller, tab.id, collectAuraSnapshot, ['peach-render-wait']);
      snapshots.peachRenderWait = snapshot;
      return snapshot?.state === 'rendered' && snapshot?.visible === '1' && snapshot?.skin === 'general-peach-guard-v1'
        ? snapshot
        : null;
    }, 12000);
    assert(peachRendered, 'Peach guard skin did not render in QA harness.');

    const peachIdle = await waitFor(async () => {
      const snapshot = await runInTab(controller, tab.id, collectAuraSnapshot, ['peach-idle']);
      snapshots.peachIdle = snapshot;
      return snapshot?.motionState === 'idle-soft' ? snapshot : null;
    }, 5000);
    assert(peachIdle, 'Peach guard idle should settle after prior pointer attention expires.', snapshots.peachIdle);
    await saveOptionalScreenshot(page, screenshots, 'peach-guard-idle.png');

    assert(
      snapshots.peachIdle.companionHotspotExists === true && snapshots.peachIdle.companionHotspotPointerEvents === 'auto',
      'Peach guard should expose a right-bottom hover hotspot for companion actions.',
      snapshots.peachIdle
    );
    assert(snapshots.peachIdle.companionPanelButtonCount === 4, 'Peach guard companion panel should include the replay action in the stable markup.', snapshots.peachIdle);
    assert(snapshots.peachIdle.companionPanelVisibleButtonCount === 3, 'Peach guard should hide replay until a recent mark exists.', snapshots.peachIdle);
    assert(snapshots.peachIdle.canMarkMoment === '1', 'Peach guard should expose mark only when playback time is readable.', snapshots.peachIdle);
    assert(snapshots.peachIdle.canReplayLatestMark === '0', 'Peach guard should hide replay until both a mark and seek capability exist.', snapshots.peachIdle);
    assert(snapshots.peachIdle.companionPanelIconCount === 4, 'Peach guard companion actions should render as icon buttons.', snapshots.peachIdle);
    assert(
      snapshots.peachIdle.companionPanelText.replace(/\s/g, '') === '标记此刻回看最近标记调整挂件大小暂时隐藏Aura',
      'Companion icon buttons should keep accessible labels without extra visible copy.',
      snapshots.peachIdle
    );
    if (snapshots.peachIdle.companionHotspotRect) {
      await dispatchPointerMove(page, {
        x: snapshots.peachIdle.companionHotspotRect.centerX,
        y: snapshots.peachIdle.companionHotspotRect.centerY
      });
      const peachPanelHover = await waitFor(async () => {
        const snapshot = await runInTab(controller, tab.id, collectAuraSnapshot, ['peach-panel-hover']);
        snapshots.peachPanelHover = snapshot;
        return snapshot?.companionPanelOpen === '1' && Number(snapshot?.companionPanelOpacity || 0) > 0.85
          ? snapshot
          : null;
      }, 2500);
      assert(peachPanelHover, 'Peach guard hover should reveal the companion action panel.', snapshots.peachPanelHover);
      assert(snapshots.peachPanelHover.companionPanelOpen === '1', 'Peach guard hover should open the companion panel state.', snapshots.peachPanelHover);
      assert(Number(snapshots.peachPanelHover.companionPanelOpacity) > 0.85, 'Peach guard hover should reveal the companion action panel.', snapshots.peachPanelHover);
      assert(snapshots.peachPanelHover.companionPanelPointerEvents === 'auto', 'Visible companion panel should be clickable.', snapshots.peachPanelHover);
      assert(snapshots.peachPanelHover.companionPanelRect, 'Visible companion panel should expose a stable hover target rect.', snapshots.peachPanelHover);
      await dispatchPointerMove(page, {
        x: snapshots.peachPanelHover.companionPanelRect.centerX,
        y: snapshots.peachPanelHover.companionPanelRect.centerY
      });
      await sleep(300);
      snapshots.peachPanelBridge = await runInTab(controller, tab.id, collectAuraSnapshot, ['peach-panel-bridge']);
      assert(snapshots.peachPanelBridge.companionPanelOpen === '1', 'Companion panel should stay open when moving from companion to panel.', snapshots.peachPanelBridge);
      assert(Number(snapshots.peachPanelBridge.companionPanelOpacity) > 0.85, 'Companion panel should not disappear while the pointer is over it.', snapshots.peachPanelBridge);
    }

    const overlayMarkClick = await runInTab(controller, tab.id, clickAuraPanelAction, ['mark']);
    assert(overlayMarkClick?.ok, 'Companion panel mark action should be wired to the runtime.', overlayMarkClick);
    const peachMarkFeedback = await waitFor(async () => {
      const snapshot = await runInTab(controller, tab.id, collectAuraSnapshot, ['peach-mark-feedback']);
      snapshots.peachMarkFeedback = snapshot;
      return snapshot?.feedbackVisible === '1' ? snapshot : null;
    }, 4000);
    assert(peachMarkFeedback, 'Mark feedback should appear near the right-bottom companion.', snapshots.peachMarkFeedback);
    assert(snapshots.peachMarkFeedback.latestMarkLabel === '02:08', 'Mark action should expose the latest mark for replay.', snapshots.peachMarkFeedback);
    assert(snapshots.peachMarkFeedback.companionPanelVisibleButtonCount === 4, 'Replay action should appear after saving a mark.', snapshots.peachMarkFeedback);
    assert(snapshots.peachMarkFeedback.canReplayLatestMark === '1', 'Replay action should only appear when the current player can seek.', snapshots.peachMarkFeedback);
    assert(
      rectsOverlap(snapshots.peachMarkFeedback.feedbackRect, snapshots.peachMarkFeedback.companionPanelRect) === false,
      'Mark feedback should not overlap the open companion panel.',
      snapshots.peachMarkFeedback
    );

    await runInTab(controller, tab.id, () => {
      window.__AURA_QA_TIME__ = 188;
      return window.__AURA_QA_TIME__;
    });
    const overlayReplayClick = await runInTab(controller, tab.id, clickAuraPanelAction, ['replay']);
    assert(overlayReplayClick?.ok, 'Companion panel replay action should be wired to the runtime.', overlayReplayClick);
    const peachReplayFeedback = await waitFor(async () => {
      const snapshot = await runInTab(controller, tab.id, collectAuraSnapshot, ['peach-replay-feedback']);
      snapshots.peachReplayFeedback = snapshot;
      return /回到 02:08/.test(snapshot?.feedbackText || '') ? snapshot : null;
    }, 4000);
    assert(peachReplayFeedback, 'Replay action should show a return-to-mark feedback toast.', snapshots.peachReplayFeedback);
    const replayedTime = await runInTab(controller, tab.id, () => window.__AURA_QA_TIME__);
    assert(Number(replayedTime) === 128, 'Replay action should seek the player to the latest mark time.', { replayedTime });

    const overlaySizeClick = await runInTab(controller, tab.id, clickAuraPanelAction, ['size']);
    assert(overlaySizeClick?.ok, 'Companion panel size action should be wired to the runtime.', overlaySizeClick);
    const peachSizeFeedback = await waitFor(async () => {
      const snapshot = await runInTab(controller, tab.id, collectAuraSnapshot, ['peach-size-feedback']);
      snapshots.peachSizeFeedback = snapshot;
      return /大小/.test(snapshot?.feedbackText || '') ? snapshot : null;
    }, 4000);
    assert(peachSizeFeedback, 'Size action should show a visible scale feedback toast.', snapshots.peachSizeFeedback);
    assert(
      rectsOverlap(snapshots.peachSizeFeedback.feedbackRect, snapshots.peachSizeFeedback.companionPanelRect) === false,
      'Size feedback should not overlap the companion action panel.',
      snapshots.peachSizeFeedback
    );

    await runInTab(controller, tab.id, setQaPlaybackState, [{ controlsVisible: false, paused: false }]);
    await dispatchPointerMove(page);
    await sendForceSync(controller, tab.id, 'qa-extension:peach-guard:pointer');
    await sleep(560);
    snapshots.peachAttention = await runInTab(controller, tab.id, collectAuraSnapshot, ['peach-attention']);
    await saveOptionalScreenshot(page, screenshots, 'peach-guard-attention.png');

    await runInTab(controller, tab.id, setQaPlaybackState, [{ controlsVisible: true, paused: false }]);
    await dispatchPointerMove(page);
    await sendForceSync(controller, tab.id, 'qa-extension:peach-guard:controls');
    await sleep(460);
    snapshots.peachControlsAttention = await runInTab(controller, tab.id, collectAuraSnapshot, ['peach-controls-attention']);

    await runInTab(controller, tab.id, setQaPlaybackState, [{ controlsVisible: false, paused: true }]);
    await dispatchPointerMove(page);
    await sendForceSync(controller, tab.id, 'qa-extension:peach-guard:paused');
    await sleep(650);
    snapshots.peachPaused = await runInTab(controller, tab.id, collectAuraSnapshot, ['peach-paused']);

    await runInTab(controller, tab.id, setupFakeTencentPlayer, [{
      title: '桃林权谋 将军守望',
      paused: false,
      currentTime: 218,
      noVideo: true
    }]);
    await sendForceSync(controller, tab.id, 'qa-extension:peach-guard:no-video');
    const peachNoVideo = await waitFor(async () => {
      const snapshot = await runInTab(controller, tab.id, collectAuraSnapshot, ['peach-no-video']);
      snapshots.peachNoVideo = snapshot;
      return snapshot?.state === 'rendered' && snapshot?.skin === 'general-peach-guard-v1' ? snapshot : null;
    }, 6000);
    assert(peachNoVideo, 'Peach guard should still render when only a player shell is available.', snapshots.peachNoVideo);
    assert(snapshots.peachNoVideo.playbackControlReason === 'no-video', 'No-video shell should report missing playback control capability.', snapshots.peachNoVideo);
    assert(snapshots.peachNoVideo.canMarkMoment === '0', 'Mark action should be hidden when playback time cannot be read.', snapshots.peachNoVideo);
    assert(snapshots.peachNoVideo.canReplayLatestMark === '0', 'Replay action should be hidden when the player cannot seek.', snapshots.peachNoVideo);
    assert(snapshots.peachNoVideo.companionPanelVisibleButtonCount === 2, 'Only size and hide should remain visible without playback control.', snapshots.peachNoVideo);

    await setSettings(worker, {
      enabled: false,
      mode: 'standard',
      themeMode: 'manual',
      selectedSkinId: 'general-peach-guard-v1'
    });
    await sendForceSync(controller, tab.id, 'qa-extension:peach-guard:disable');
    await sleep(500);
    snapshots.peachDisabled = await runInTab(controller, tab.id, collectAuraSnapshot, ['peach-disabled']);

    assert(snapshots.peachIdle.skin === 'general-peach-guard-v1', 'Peach guard skin did not render.', snapshots.peachIdle);
    assert(snapshots.peachIdle.motionPreset === 'poetic-guard', 'Peach guard should use poetic-guard motion.', snapshots.peachIdle);
    assert(!String(snapshots.peachIdle.motionState || '').startsWith('action-'), 'Peach guard should not expose retired action motion states.', snapshots.peachIdle);
    assert(snapshots.peachIdle.motionState === 'idle-soft', 'Peach guard idle should stay on the single-image soft path.', snapshots.peachIdle);
    assert(snapshots.peachIdle.bottomBodyAnimationName.includes('auraBottomStillBreathe'), 'Peach guard should use still-breathe motion instead of drift/tilt animation.', snapshots.peachIdle);
    assert(snapshots.peachIdle.bottomProbeX === '0px', 'Peach guard should not probe sideways in idle motion.', snapshots.peachIdle);
    assert(snapshots.peachIdle.bottomDrift === '0px', 'Peach guard should not drift vertically in idle motion.', snapshots.peachIdle);
    assert(snapshots.peachIdle.bottomLift === '0px', 'Peach guard should not lift the whole companion in idle motion.', snapshots.peachIdle);
    assert(snapshots.peachIdle.bottomTilt === '0deg', 'Peach guard should not rotate in idle motion.', snapshots.peachIdle);
    assert(snapshots.peachIdle.bottomHaloExists === true, 'Peach guard should render the companion halo layer.', snapshots.peachIdle);
    assert(snapshots.peachIdle.bottomHaloAnimationName.includes('auraCompanionHalo'), 'Peach guard halo should use the restrained halo animation.', snapshots.peachIdle);
    assert(Number(snapshots.peachIdle.companionHaloOpacity) > 0, 'Peach guard should keep a subtle idle halo.', snapshots.peachIdle);
    assert(Number(snapshots.peachIdle.companionHaloOpacity) < 0.3, 'Peach guard idle halo should stay subtle.', snapshots.peachIdle);
    assert(Number(snapshots.peachIdle.bottomScalePeak) > 1, 'Peach guard should keep a subtle breathing scale.', snapshots.peachIdle);
    assert(Number(snapshots.peachIdle.bottomScalePeak) <= 1.02, 'Peach guard breathing scale should stay restrained.', snapshots.peachIdle);
    assert(snapshots.peachIdle.topInfoExists === false, 'Top-left overlay must not render text chips over the native player title.', snapshots.peachIdle);
    assert(snapshots.peachIdle.atmosphereDisplay === 'none', 'Character skins should keep the retired left-top particle layer hidden.', snapshots.peachIdle);
    assert(
      JSON.stringify(snapshots.peachIdle.baseSize) === JSON.stringify([1024, 1280]),
      'Peach guard base frame should be 1024x1280.',
      snapshots.peachIdle
    );
    assert(snapshots.peachMarkFeedback.feedbackVisible === '1', 'Mark feedback should appear near the right-bottom companion.', snapshots.peachMarkFeedback);
    assert(/回看点已存/.test(snapshots.peachMarkFeedback.feedbackText), 'Mark feedback copy should use the right-bottom toast wording.', snapshots.peachMarkFeedback);
    assert(
      !String(snapshots.peachAttention.motionState || '').startsWith('action-'),
      'Peach guard pointer attention should stay on the stable non-action motion path.',
      snapshots.peachAttention
    );
    assert(snapshots.peachAttention.motionState === 'attention-soft', 'Peach guard pointer attention should expose a soft interaction state.', snapshots.peachAttention);
    assert(snapshots.peachAttention.attention === '1', 'Peach guard pointer attention should mark root attention state.', snapshots.peachAttention);
    assert(snapshots.peachAttention.pointerAccepted === '1', 'Peach guard pointer should be accepted by playback-surface trigger logic.', snapshots.peachAttention);
    assert(
      ['container-rect', 'video-rect', 'event-path', 'elements-from-point', 'no-observed-target'].includes(snapshots.peachAttention.pointerReason),
      'Peach guard pointer should expose the accepted trigger source.',
      snapshots.peachAttention
    );
    assert(
      Number(snapshots.peachAttention.companionHaloOpacity) > Number(snapshots.peachIdle.companionHaloOpacity),
      'Peach guard pointer attention should strengthen the companion halo.',
      snapshots.peachAttention
    );
    assert(
      Number(snapshots.peachAttention.bottomScalePeak) > Number(snapshots.peachIdle.bottomScalePeak),
      'Peach guard pointer attention should make the single-image breathing slightly more visible.',
      snapshots.peachAttention
    );
    if (snapshots.peachControlsAttention.controlsVisible === true) {
      assert(
        ['attention-soft', 'controls-softened'].includes(snapshots.peachControlsAttention.motionState),
        'Visible controls should either keep soft attention or fall back to softened controls.',
        snapshots.peachControlsAttention
      );
    } else {
      assert(
        !String(snapshots.peachControlsAttention.motionState || '').startsWith('action-'),
        'Peach guard controls fallback should still avoid retired replacement-frame states.',
        snapshots.peachControlsAttention
      );
    }
    assert(
      ['paused-still', 'controls-softened'].includes(snapshots.peachPaused.motionState),
      'Peach guard paused/controls motion should keep the single-image path.',
      snapshots.peachPaused
    );
    assert(snapshots.peachDisabled.state === 'disabled', 'Peach guard disabled setting should update runtime state.', snapshots.peachDisabled);
    assert(snapshots.peachDisabled.root === false, 'Peach guard disabled setting should remove overlay root.', snapshots.peachDisabled);

    const reportPath = resolve(outputDir, 'report.json');
    writeFileSync(reportPath, JSON.stringify({
      ok: true,
      targetUrl,
      chrome: basename(chromeBinary),
      screenshots,
      snapshots
    }, null, 2));

    console.log('Aura extension QA passed');
    console.log(`- report: ${reportPath}`);
    for (const path of screenshots) console.log(`- screenshot: ${path}`);
  } catch (error) {
    const reportPath = resolve(outputDir, 'report.json');
    writeFileSync(reportPath, JSON.stringify({
      ok: false,
      message: error.message,
      detail: error.detail || null,
      snapshots
    }, null, 2));
    console.error('Aura extension QA failed');
    console.error(`- report: ${reportPath}`);
    console.error(error.message);
    if (error.detail) console.error(JSON.stringify(error.detail, null, 2));
    process.exitCode = 1;
  } finally {
    page?.close?.();
    controller?.close?.();
    worker?.close?.();
    browser?.close?.();
    chrome.kill('SIGTERM');
    await localTencent.close();
    await sleep(700);
    try {
      rmSync(userDataDir, {
        recursive: true,
        force: true,
        maxRetries: 4,
        retryDelay: 120
      });
    } catch (error) {
      console.warn(`Aura QA temp cleanup skipped: ${error.message}`);
    }
  }
}

await main();
