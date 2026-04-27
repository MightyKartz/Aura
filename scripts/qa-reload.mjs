import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const dist = resolve(root, 'dist');
const outputDir = resolve(root, 'output/qa-reload');
const settingsKey = 'aura:mvp:settings';
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

function runBuild() {
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], {
    cwd: root,
    stdio: 'inherit'
  });
  assert(result.status === 0, 'Build failed before reload QA.');
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
  assert(result.status === 0, 'Could not create local HTTPS certificate for v.qq.com reload QA.');
  return { keyPath, certPath };
}

function startLocalTencentServer() {
  const { keyPath, certPath } = ensureQaCertificate();
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>Aura Reload QA - 腾讯视频</title></head><body></body></html>';
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
        send(method, params = {}, timeoutMs = 15000) {
          const id = nextId++;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveCall, rejectCall) => {
            const timeout = setTimeout(() => {
              pending.delete(id);
              rejectCall(new Error(`CDP command timed out: ${method}`));
            }, timeoutMs);
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

async function evaluate(client, expression, timeoutMs = 15000) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  }, timeoutMs);
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
  return evaluate(
    controller,
    `chrome.scripting.executeScript({
      target: { tabId: ${JSON.stringify(tabId)} },
      func: ${func.toString()},
      args: ${JSON.stringify(args)}
    }).then((results) => results?.[0]?.result ?? null)`
  );
}

async function connectWorker(port) {
  const workerTarget = await findTarget(
    port,
    (entry) => entry.type === 'service_worker' && entry.url.endsWith('/background.js'),
    12000
  );
  assert(workerTarget, 'Aura extension service worker was not loaded.');
  const worker = await connectCdp(workerTarget.webSocketDebuggerUrl);
  await worker.send('Runtime.enable');
  return {
    worker,
    extensionId: new URL(workerTarget.url).host
  };
}

async function createController(browser, port, extensionId) {
  const target = await browser.send('Target.createTarget', {
    url: `chrome-extension://${extensionId}/skin-studio.html?qa=reload`,
    active: false
  });
  assert(target?.targetId, 'Could not create extension controller page.');
  const pageTarget = await findTarget(port, (entry) => entry.type === 'page' && entry.id === target.targetId);
  assert(pageTarget, 'Could not find extension controller page target.');
  const controller = await connectCdp(pageTarget.webSocketDebuggerUrl);
  await controller.send('Runtime.enable');
  return controller;
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

function setupFakeTencentPlayer(config = {}) {
  document.title = `${config.title || 'Aura Reload QA'} - 腾讯视频`;
  document.body.style.cssText = 'margin:0;min-height:100vh;overflow:hidden;background:#05070a';
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
    'overflow:hidden',
    'background:linear-gradient(135deg,#07111f,#182a36 54%,#070a0e)',
    'z-index:10'
  ].join(';');

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;background:#102032';
  Object.defineProperty(video, 'paused', {
    configurable: true,
    get: () => false
  });
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => 95
  });
  Object.defineProperty(video, 'readyState', {
    configurable: true,
    get: () => 4
  });

  const title = document.createElement('h1');
  title.setAttribute('data-role', 'video-title');
  title.textContent = config.title || '桃林权谋 将军守望';
  title.style.cssText = 'position:absolute;left:28px;top:24px;margin:0;color:white;font:600 28px sans-serif;z-index:2';

  shell.append(video, title);
  document.body.append(shell);
  return true;
}

function collectReloadSnapshot(label) {
  const root = document.querySelector('#aura-root');
  const roots = document.querySelectorAll('#aura-root');
  const status = globalThis.__AURA_CORNER_DECOR_RUNTIME__ || null;
  return {
    label,
    readyState: document.readyState,
    rootCount: roots.length,
    active: Boolean(globalThis.__AURA_CORNER_DECOR_ACTIVE__),
    state: status?.status?.state || status?.state || '',
    stage: status?.stage || '',
    syncState: status?.syncState || '',
    lastSyncReason: status?.lastSyncReason || '',
    skin: root?.dataset.skin || '',
    visible: root?.dataset.visible || '',
    bodyChildren: document.body.children.length
  };
}

async function main() {
  runBuild();
  mkdirSync(outputDir, { recursive: true });

  const chromeBinary = chromeCandidates.find((candidate) => existsSync(candidate));
  assert(chromeBinary, 'Chrome binary not found.');
  const port = 9800 + Math.floor(Math.random() * 300);
  const userDataDir = resolve(tmpdir(), `aura-extension-reload-qa-${Date.now()}`);
  const localTencent = await startLocalTencentServer();
  targetUrl = `https://v.qq.com:${localTencent.port}/x/cover/aura-reload-qa/aura-reload.html`;
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
  ], { stdio: 'ignore' });

  const snapshots = [];
  let browser = null;
  let page = null;
  let worker = null;
  let controller = null;

  try {
    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
    browser = await connectCdp(version.webSocketDebuggerUrl);

    let workerInfo = await connectWorker(port);
    worker = workerInfo.worker;
    controller = await createController(browser, port, workerInfo.extensionId);

    const tab = await evaluate(
      controller,
      `chrome.tabs.create({ url: ${JSON.stringify(targetUrl)}, active: true }).then((tab) => ({ id: tab.id, url: tab.url }))`
    );
    assert(tab?.id, 'Could not create reload QA tab.', tab);
    const pageTarget = await findTarget(port, (entry) => entry.type === 'page' && String(entry.url || '').startsWith(targetUrl));
    assert(pageTarget, 'Could not find reload QA page target.');
    page = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await page.send('Page.enable');
    await page.send('Runtime.enable');

    await setSettings(worker, {
      enabled: true,
      mode: 'standard',
      themeMode: 'manual',
      selectedSkinId: 'general-peach-guard-v1'
    });
    await runInTab(controller, tab.id, setupFakeTencentPlayer, [{ title: '桃林权谋 将军守望' }]);
    await evaluate(
      controller,
      `Promise.all([
        chrome.scripting.insertCSS({ target: { tabId: ${JSON.stringify(tab.id)} }, files: ['content.css'] }),
        chrome.scripting.executeScript({ target: { tabId: ${JSON.stringify(tab.id)} }, files: ['content.js'] })
      ]).then(() => true)`
    );

    const initial = await waitFor(async () => {
      const snapshot = await evaluate(page, `(${collectReloadSnapshot.toString()})('initial')`, 4000);
      snapshots.push(snapshot);
      return snapshot.rootCount === 1 && snapshot.readyState === 'complete' ? snapshot : null;
    }, 12000);
    assert(initial, 'Initial Aura reload QA render did not settle.', snapshots.at(-1));

    try {
      await evaluate(worker, 'chrome.runtime.reload(); true', 2000);
    } catch {
      // The service worker connection normally closes during extension reload.
    }
    worker.close();
    controller.close();
    worker = null;
    controller = null;

    const responsiveSnapshots = [];
    for (let tick = 1; tick <= 5; tick += 1) {
      await sleep(700);
      const snapshot = await evaluate(page, `(${collectReloadSnapshot.toString()})(${JSON.stringify(`reload-${tick}`)})`, 3000);
      snapshots.push(snapshot);
      responsiveSnapshots.push(snapshot);
      assert(snapshot.readyState === 'complete', `Page did not stay responsive after extension reload tick ${tick}.`, snapshot);
      assert(snapshot.rootCount <= 1, `Aura overlay duplicated after extension reload tick ${tick}.`, snapshot);
    }
    assert(responsiveSnapshots.length === 5, 'Reload QA did not complete all responsiveness checks.');

    const reportPath = resolve(outputDir, 'report.json');
    writeFileSync(reportPath, JSON.stringify({
      ok: true,
      chrome: basename(chromeBinary),
      snapshots
    }, null, 2));
    console.log('Aura reload QA passed');
    console.log(`- report: ${reportPath}`);
  } catch (error) {
    const reportPath = resolve(outputDir, 'report.json');
    writeFileSync(reportPath, JSON.stringify({
      ok: false,
      message: error.message,
      detail: error.detail || null,
      snapshots
    }, null, 2));
    console.error('Aura reload QA failed');
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
    rmSync(userDataDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 120 });
  }
}

await main();
