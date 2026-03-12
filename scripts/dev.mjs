import { watch } from 'node:fs';
import { spawnSync } from 'node:child_process';

function build() {
  spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
}

build();
console.log('Watching for changes...');
watch('apps', { recursive: true }, () => build());
watch('packages', { recursive: true }, () => build());
watch('themes', { recursive: true }, () => build());
