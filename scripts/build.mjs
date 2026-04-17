import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const dist = resolve(root, 'dist');
const extensionSrc = resolve(root, 'apps/extension');
const themeRegistryDist = resolve(dist, 'theme-registry');
const themeManifestSrc = resolve(root, 'themes/manifests/builtin-skins.json');
const themeManifestDist = resolve(themeRegistryDist, 'builtin-skins.json');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(extensionSrc, dist, { recursive: true });
mkdirSync(themeRegistryDist, { recursive: true });
cpSync(themeManifestSrc, themeManifestDist);

console.log('Aura build complete -> dist/');
