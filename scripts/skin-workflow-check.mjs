import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const root = resolve(process.cwd());

function usage() {
  return `Usage:
  npm run skin:check -- --top-left <png> --bottom-right <png>

Checks image2/Aura skin candidate assets before manifest integration:
  - PNG signature
  - RGBA color type
  - top-left atmosphere is square or a safe landscape strip
  - bottom-right companion uses an Aura-safe portrait ratio
  - runtime skin candidates stay on the single-image MVP contract`;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readPngInfo(inputPath) {
  const absolutePath = resolve(root, inputPath);
  assert(existsSync(absolutePath), `${inputPath}: file does not exist`);
  const bytes = readFileSync(absolutePath);
  assert(bytes.length >= 33, `${inputPath}: file is too small to be a PNG`);
  assert(bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', `${inputPath}: expected PNG signature`);
  assert(bytes.subarray(12, 16).toString('ascii') === 'IHDR', `${inputPath}: missing IHDR chunk`);

  return {
    path: inputPath,
    name: basename(inputPath),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25]
  };
}

function ratioClose(width, height, expectedWidth, expectedHeight, tolerance = 0.018) {
  return Math.abs((width / height) - (expectedWidth / expectedHeight)) <= tolerance;
}

function validateRgba(info) {
  assert(info.colorType === 6, `${info.path}: expected RGBA PNG color type 6, got ${info.colorType}`);
  assert(info.bitDepth === 8, `${info.path}: expected 8-bit PNG, got bit depth ${info.bitDepth}`);
}

function validateTopLeft(info) {
  validateRgba(info);
  const isSquare = ratioClose(info.width, info.height, 1, 1);
  const isLandscapeAtmosphere =
    ratioClose(info.width, info.height, 3, 2)
    || ratioClose(info.width, info.height, 16, 9);
  assert(
    isSquare || isLandscapeAtmosphere,
    `${info.path}: top-left atmosphere should be 1:1, 3:2, or 16:9; got ${info.width}x${info.height}`
  );
  assert(info.width >= 1024 && info.height >= 576, `${info.path}: top-left atmosphere is too small for integration`);
  return isSquare ? 'square badge' : 'landscape atmosphere';
}

function validateBottomRight(info) {
  validateRgba(info);
  assert(info.width >= 1024 && info.height >= 1280, `${info.path}: bottom-right companion should be at least 1024x1280 before integration`);

  const isPreferred = ratioClose(info.width, info.height, 4, 5);
  const isAccepted = isPreferred
    || ratioClose(info.width, info.height, 3, 4)
    || ratioClose(info.width, info.height, 2, 3);
  assert(
    isAccepted,
    `${info.path}: bottom-right companion should be 4:5 preferred, 3:4 or 2:3 accepted with Skin Studio QA; got ${info.width}x${info.height}`
  );
  return isPreferred ? 'preferred 4:5' : 'accepted non-preferred portrait ratio';
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  assert(options['top-left'], 'Missing --top-left');
  assert(options['bottom-right'], 'Missing --bottom-right');

  const topLeft = readPngInfo(options['top-left']);
  const bottomRight = readPngInfo(options['bottom-right']);
  const topLeftStatus = validateTopLeft(topLeft);
  const bottomRatioStatus = validateBottomRight(bottomRight);

  assert(!options.blink && !options.react, 'Runtime skin candidates should not include retired blink/react replacement frames');

  console.log('Aura skin candidate check passed');
  console.log(`- top-left: ${topLeft.name} ${topLeft.width}x${topLeft.height} RGBA (${topLeftStatus})`);
  console.log(`- bottom-right: ${bottomRight.name} ${bottomRight.width}x${bottomRight.height} RGBA (${bottomRatioStatus})`);
  console.log('- motion: single-image companion, atmosphere handled by runtime effects');
  console.log('- next: visual alpha edge review in Skin Studio is still required');
}

try {
  main();
} catch (error) {
  console.error(`Aura skin candidate check failed: ${error.message}`);
  console.error('');
  console.error(usage());
  process.exit(1);
}
