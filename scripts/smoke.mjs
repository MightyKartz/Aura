import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  assert(registry && typeof registry === 'object', `${label}: registry missing`);
  assert(Array.isArray(registry.skins) && registry.skins.length > 0, `${label}: registry.skins must be non-empty`);
  assert(typeof registry.defaultSkinId === 'string' && registry.defaultSkinId, `${label}: defaultSkinId missing`);

  const ids = new Set();
  let hasDefault = false;

  for (const skin of registry.skins) {
    assert(typeof skin.id === 'string' && skin.id, `${label}: skin.id missing`);
    assert(!ids.has(skin.id), `${label}: duplicate skin id ${skin.id}`);
    ids.add(skin.id);
    if (skin.id === registry.defaultSkinId) hasDefault = true;

    assert(typeof skin.name === 'string' && skin.name, `${label}: skin ${skin.id} missing name`);
    assert(skin.assets && typeof skin.assets === 'object', `${label}: skin ${skin.id} missing assets`);

    for (const assetKey of ['topLeft', 'bottomRight']) {
      const assetPath = skin.assets[assetKey];
      assert(typeof assetPath === 'string' && assetPath, `${label}: skin ${skin.id} missing ${assetKey} asset`);
      assert(existsSync(resolve(baseDir, assetPath)), `${label}: missing asset ${assetPath} for skin ${skin.id}`);
    }
  }

  assert(hasDefault, `${label}: defaultSkinId ${registry.defaultSkinId} not found in skins`);
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

function validateBuildOutputs() {
  for (const relativePath of [
    'content.js',
    'content.css',
    'popup.js',
    'popup.html',
    'background.js',
    'runtime/settings.js',
    'runtime/skin-registry.js',
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

  for (const [label, source] of [
    ['popup', popupSource],
    ['background', backgroundSource]
  ]) {
    assert(!/const\s+DEFAULT_SETTINGS\s*=/.test(source), `${label}: should import DEFAULT_SETTINGS instead of defining it`);
    assert(!/const\s+LEGACY_SKIN_MAP\s*=/.test(source), `${label}: should not define LEGACY_SKIN_MAP locally`);
    assert(!/function\s+normalizeSettings\s*\(/.test(source), `${label}: should import normalizeSettings helpers instead of redefining them`);
    assert(!/function\s+isTencentPlaybackUrl\s*\(/.test(source), `${label}: should use shared site adapter contract`);
  }
}

const registry = readJson(registryPath);
const manifest = readJson(manifestPath);
const distManifest = readJson(distManifestPath);

validateRegistry(registry, extensionSrc, 'source');
validateRegistry(readJson(resolve(dist, 'theme-registry/builtin-skins.json')), dist, 'dist');
validateManifest(manifest, 'source');
validateManifest(distManifest, 'dist');
validateBuildOutputs();
validateSharedContractImports();

console.log('Aura smoke passed');
console.log(`- skins: ${registry.skins.length}`);
console.log(`- defaultSkinId: ${registry.defaultSkinId}`);
console.log('- build artifacts: ok');
