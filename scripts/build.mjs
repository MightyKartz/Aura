import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const dist = resolve(root, 'dist');
const extensionSrc = resolve(root, 'apps/extension');
const themeRegistrySrc = resolve(root, 'packages/theme-registry/src');
const themeRegistryDist = resolve(dist, 'theme-registry');
const themeManifestSrc = resolve(root, 'themes/manifests/builtin-themes.json');
const themeManifestDist = resolve(themeRegistryDist, 'builtin-themes.json');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(extensionSrc, dist, { recursive: true });
mkdirSync(themeRegistryDist, { recursive: true });
cpSync(themeRegistrySrc, themeRegistryDist, { recursive: true });
cpSync(themeManifestSrc, themeManifestDist);

console.log('Aura build complete -> dist/');
