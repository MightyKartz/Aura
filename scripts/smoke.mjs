import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateSkinRegistry } from '../apps/extension/runtime/skin-contract.js';
import {
  STATUS_KEY,
  createStatusReporter,
  createStatusStorageKey,
  migrateLegacyStatus,
  readStatusForUrl
} from '../apps/extension/runtime/status.js';

const root = resolve(process.cwd());
const dist = resolve(root, 'dist');
const extensionSrc = resolve(root, 'apps/extension');
const registryPath = resolve(root, 'themes/manifests/builtin-skins.json');
const manifestPath = resolve(extensionSrc, 'manifest.json');
const distManifestPath = resolve(dist, 'manifest.json');
const popupPath = resolve(extensionSrc, 'popup.js');
const backgroundPath = resolve(extensionSrc, 'background.js');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateRegistry(registry, baseDir, label) {
  validateSkinRegistry(registry, { label });

  for (const skin of registry.skins) {
    for (const assetKey of ['topLeft', 'bottomRight']) {
      const assetPath = skin.assets[assetKey];
      assert(existsSync(resolve(baseDir, assetPath)), `${label}: missing asset ${assetPath} for skin ${skin.id}`);
    }

    if (skin.preview?.cover) {
      assert(existsSync(resolve(baseDir, skin.preview.cover)), `${label}: missing preview asset ${skin.preview.cover}`);
    }
  }
}

function validateManifest(manifest, label) {
  assert(manifest.manifest_version === 3, `${label}: manifest_version must be 3`);
  assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0, `${label}: content_scripts missing`);
  assert(Array.isArray(manifest.web_accessible_resources) && manifest.web_accessible_resources.length > 0, `${label}: web_accessible_resources missing`);

  const resources = manifest.web_accessible_resources.flatMap((entry) => entry.resources || []);
  for (const required of ['themes/*', 'theme-registry/builtin-skins.json', 'runtime/*.js']) {
    assert(resources.includes(required), `${label}: missing web_accessible resource ${required}`);
  }
}

function validateCharacterSkinProgress(registry, label) {
  const expectedCharacters = [
    {
      id: 'general-peach-guard-v1',
      topLeft: 'themes/skin-peach-guard-top-left.png',
      bottomRight: 'themes/skin-peach-guard-bottom-right.png',
      palette: {
        primary: '#2f4a58',
        accent: '#d2a062',
        glow: '#f3d7c7'
      }
    },
    {
      id: 'lady-moon-fan-v1',
      topLeft: 'themes/skin-moon-fan-top-left.png',
      bottomRight: 'themes/skin-moon-fan-bottom-right.png',
      palette: {
        primary: '#5b4d7a',
        accent: '#d9c0a8',
        glow: '#f3dff7'
      }
    }
  ];

  for (const expected of expectedCharacters) {
    const skin = registry.skins.find((entry) => entry.id === expected.id);
    assert(skin, `${label}: missing skin ${expected.id}`);
    assert(skin.assets.topLeft === expected.topLeft, `${label}: ${expected.id} topLeft should use dedicated PNG asset`);
    assert(skin.assets.bottomRight === expected.bottomRight, `${label}: ${expected.id} bottomRight should use dedicated PNG asset`);
    assert(skin.motionAssets === undefined, `${label}: ${expected.id} should stay on the single-image runtime path`);
    assert(!skin.assets.topLeft.includes('skin-ancient'), `${label}: ${expected.id} topLeft must not regress to ancient placeholder art`);
    assert(!skin.assets.bottomRight.includes('skin-ancient'), `${label}: ${expected.id} bottomRight must not regress to ancient placeholder art`);
    assert(
      JSON.stringify(skin.palette) === JSON.stringify(expected.palette),
      `${label}: ${expected.id} palette should stay aligned with approved production values`
    );
  }
}

function validateRetiredMotionFrameAssets(baseDir, label) {
  const themesDir = resolve(baseDir, 'themes');
  const retiredFrames = readdirSync(themesDir).filter((fileName) => /bottom-right-(blink|react)\.png$/.test(fileName));
  assert(
    retiredFrames.length === 0,
    `${label}: retired right-bottom replacement frames should not ship: ${retiredFrames.join(', ')}`
  );
}

function validateProductionSkinAssets(registry, label) {
  for (const skin of registry.skins) {
    for (const assetKey of ['topLeft', 'bottomRight']) {
      const assetPath = skin.assets?.[assetKey] || '';
      assert(assetPath.endsWith('.png'), `${label}: ${skin.id} ${assetKey} should use production PNG asset`);
      assert(!assetPath.includes('skin-ancient'), `${label}: ${skin.id} ${assetKey} must not use retired ancient placeholder art`);
    }
  }
}

function validateBuildOutputs() {
  for (const relativePath of [
    'content.js',
    'content.css',
    'popup.js',
    'popup.html',
    'background.js',
    'skin-studio.html',
    'skin-studio.css',
    'skin-studio.js',
    'runtime/settings.js',
    'runtime/skin-contract.js',
    'runtime/character-theme.js',
    'runtime/skin-registry.js',
    'runtime/motion-presets.js',
    'runtime/url-resolver.js',
    'runtime/tencent-detect.js',
    'runtime/layout.js',
    'runtime/status.js',
    'runtime/site-adapters.js',
    'runtime/messages.js',
    'runtime/content-overlay.js',
    'runtime/content-lifecycle.js',
    'runtime/content-controller.js',
    'theme-registry/builtin-skins.json'
  ]) {
    assert(existsSync(resolve(dist, relativePath)), `dist missing ${relativePath}`);
  }
}

function validateSharedContractImports() {
  const popupSource = readFileSync(popupPath, 'utf8');
  const backgroundSource = readFileSync(backgroundPath, 'utf8');
  const controllerSource = readFileSync(resolve(extensionSrc, 'runtime/content-controller.js'), 'utf8');

  for (const [label, source] of [
    ['popup', popupSource],
    ['background', backgroundSource]
  ]) {
    assert(!/const\s+DEFAULT_SETTINGS\s*=/.test(source), `${label}: should import DEFAULT_SETTINGS instead of defining it`);
    assert(!/const\s+LEGACY_SKIN_MAP\s*=/.test(source), `${label}: should not define LEGACY_SKIN_MAP locally`);
    assert(!/function\s+normalizeSettings\s*\(/.test(source), `${label}: should import normalizeSettings helpers instead of redefining them`);
    assert(!/function\s+isTencentPlaybackUrl\s*\(/.test(source), `${label}: should use shared site adapter contract`);
  }

  assert(
    /removeCSS\s*\(/.test(backgroundSource),
    'background: programmatic CSS injection must remove the previous stylesheet first'
  );
  assert(
    !/onStartup/.test(backgroundSource) && !/query\(\{\s*url:\s*AURA_URL_PATTERNS\s*\}\)/.test(backgroundSource),
    'background: extension reload/startup must not scan and reinject existing video tabs'
  );
  assert(
    /LOW_SIGNAL_SYNC_REASONS[\s\S]*asset-ready/.test(controllerSource),
    'content-controller: asset-ready must be treated as a low-signal sync reason'
  );
  assert(
    /'asset-ready':\s*650/.test(controllerSource),
    'content-controller: asset-ready must be throttled during extension reload asset bursts'
  );
}

async function validateScopedStatusContract() {
  const memory = {
    [STATUS_KEY]: {
      frameId: 'legacy-frame',
      pageUrl: 'https://v.qq.com/x/cover/legacy.html#hash',
      updatedAt: 10,
      state: 'rendered',
      renderActive: true
    }
  };

  const storageArea = {
    async get(key) {
      if (key === null) return { ...memory };
      return { [key]: memory[key] ?? null };
    },
    async set(payload) {
      Object.assign(memory, payload);
    },
    async remove(key) {
      delete memory[key];
    }
  };

  const migrated = await migrateLegacyStatus(storageArea);
  assert(migrated === true, 'status: legacy payload should migrate');
  assert(!(STATUS_KEY in memory), 'status: legacy key should be removed after migration');

  const migratedStatus = await readStatusForUrl('https://v.qq.com/x/cover/legacy.html', storageArea);
  assert(migratedStatus?.frameId === 'legacy-frame', 'status: migrated payload should be readable by normalized url');

  const reporterA = createStatusReporter({
    frameId: 'frame-a',
    getPageUrl: () => 'https://v.qq.com/x/cover/a.html#foo',
    writeStatus: (payload) => storageArea.set(payload),
    migrateLegacy: () => Promise.resolve(false)
  });
  const reporterB = createStatusReporter({
    frameId: 'frame-b',
    getPageUrl: () => 'https://v.qq.com/x/cover/b.html',
    writeStatus: (payload) => storageArea.set(payload),
    migrateLegacy: () => Promise.resolve(false)
  });

  reporterA.commitStatus({ state: 'rendered', renderActive: true, enabled: true, mode: 'standard' });
  reporterB.commitStatus({ state: 'idle', renderActive: false, enabled: true, mode: 'standard' });
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));

  const statusA = await readStatusForUrl('https://v.qq.com/x/cover/a.html', storageArea);
  const statusB = await readStatusForUrl('https://v.qq.com/x/cover/b.html', storageArea);
  assert(statusA?.frameId === 'frame-a', 'status: scoped status for page A should be preserved');
  assert(statusB?.frameId === 'frame-b', 'status: scoped status for page B should be preserved');

  for (const url of [
    'https://v.qq.com/x/cover/legacy.html',
    'https://v.qq.com/x/cover/a.html',
    'https://v.qq.com/x/cover/b.html'
  ]) {
    const key = createStatusStorageKey(url);
    assert(Boolean(key), `status: storage key should be generated for ${url}`);
    assert(memory[key], `status: storage area missing scoped key for ${url}`);
  }
}

const registry = readJson(registryPath);
const manifest = readJson(manifestPath);
const distManifest = readJson(distManifestPath);

validateRegistry(registry, extensionSrc, 'source');
validateRegistry(readJson(resolve(dist, 'theme-registry/builtin-skins.json')), dist, 'dist');
validateCharacterSkinProgress(registry, 'source');
validateCharacterSkinProgress(readJson(resolve(dist, 'theme-registry/builtin-skins.json')), 'dist');
validateProductionSkinAssets(registry, 'source');
validateProductionSkinAssets(readJson(resolve(dist, 'theme-registry/builtin-skins.json')), 'dist');
validateRetiredMotionFrameAssets(extensionSrc, 'source');
validateRetiredMotionFrameAssets(dist, 'dist');
validateManifest(manifest, 'source');
validateManifest(distManifest, 'dist');
validateBuildOutputs();
validateSharedContractImports();
await validateScopedStatusContract();

console.log('Aura smoke passed');
console.log(`- skins: ${registry.skins.length}`);
console.log(`- defaultSkinId: ${registry.defaultSkinId}`);
console.log('- skin studio: ok');
console.log('- build artifacts: ok');
console.log('- scoped status: ok');
