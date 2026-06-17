import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveReactionAction } from '../packages/aura-core/src/reaction-core.js';

const root = resolve(process.cwd());

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const relativePath of [
  'apps/desktop/main.mjs',
  'apps/desktop/preload.cjs',
  'apps/desktop/renderer/index.html',
  'apps/desktop/renderer/app.js',
  'apps/desktop/renderer/styles.css',
  'packages/aura-core/src/reaction-core.js'
]) {
  assert(existsSync(resolve(root, relativePath)), `desktop smoke: missing ${relativePath}`);
}

const registry = JSON.parse(readFileSync(resolve(root, 'themes/manifests/builtin-skins.json'), 'utf8'));
const defaultSkin = registry.skins.find((skin) => skin.id === registry.defaultSkinId);
assert(defaultSkin?.assets?.bottomRight, 'desktop smoke: default skin missing bottom-right asset');
assert(
  existsSync(resolve(root, 'apps/extension', defaultSkin.assets.bottomRight)),
  `desktop smoke: default asset missing ${defaultSkin.assets.bottomRight}`
);

const scare = resolveReactionAction({
  atmosphereState: 'scare',
  intensity: 'standard',
  skinId: defaultSkin.id
});
assert(scare.action === 'short-flinch', 'desktop smoke: scare should resolve to a restrained flinch action');
assert(scare.halo > 0 && scare.halo <= 0.42, 'desktop smoke: halo should stay within visual safety bounds');

console.log('Aura desktop smoke passed.');
