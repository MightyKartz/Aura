import { getCharacterMotionPreset, isValidCharacterTheme } from './character-theme.js';

const ALLOWED_CATEGORIES = new Set(['default', 'genre', 'character']);
const ALLOWED_MODES = new Set(['quiet', 'standard', 'lively']);
const ALLOWED_MOTION_PRESETS = new Set(['soft', 'watchful', 'detective-cat', 'poetic-guard', 'graceful', 'energetic']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function validateSkinRegistry(registry, { label = 'skin-registry' } = {}) {
  assert(registry && typeof registry === 'object', `${label}: registry missing`);
  assert(Array.isArray(registry.skins) && registry.skins.length > 0, `${label}: skins must be non-empty`);
  assert(isNonEmptyString(registry.defaultSkinId), `${label}: defaultSkinId missing`);

  const ids = new Set();
  let hasDefaultSkinId = false;

  for (const skin of registry.skins) {
    assert(isNonEmptyString(skin?.id), `${label}: skin.id missing`);
    assert(!ids.has(skin.id), `${label}: duplicate skin id ${skin.id}`);
    ids.add(skin.id);
    hasDefaultSkinId ||= skin.id === registry.defaultSkinId;

    assert(isNonEmptyString(skin.name), `${label}: skin ${skin.id} missing name`);
    assert(ALLOWED_CATEGORIES.has(skin.category), `${label}: skin ${skin.id} invalid category ${skin.category}`);
    assert(isNonEmptyString(skin.description), `${label}: skin ${skin.id} missing description`);
    assert(skin.assets && typeof skin.assets === 'object', `${label}: skin ${skin.id} missing assets`);
    assert(isNonEmptyString(skin.assets.topLeft), `${label}: skin ${skin.id} missing assets.topLeft`);
    assert(isNonEmptyString(skin.assets.bottomRight), `${label}: skin ${skin.id} missing assets.bottomRight`);
    assert(skin.palette && typeof skin.palette === 'object', `${label}: skin ${skin.id} missing palette`);
    assert(isNonEmptyString(skin.palette.primary), `${label}: skin ${skin.id} missing palette.primary`);
    assert(isNonEmptyString(skin.palette.accent), `${label}: skin ${skin.id} missing palette.accent`);
    assert(isNonEmptyString(skin.palette.glow), `${label}: skin ${skin.id} missing palette.glow`);
    assert(Array.isArray(skin.tags) && skin.tags.length > 0, `${label}: skin ${skin.id} requires tags`);
    assert(ALLOWED_MODES.has(skin.recommendedMode), `${label}: skin ${skin.id} invalid recommendedMode ${skin.recommendedMode}`);
    const resolvedMotionPreset = getCharacterMotionPreset(skin);
    assert(
      ALLOWED_MOTION_PRESETS.has(resolvedMotionPreset),
      `${label}: skin ${skin.id} invalid motionPreset ${resolvedMotionPreset || skin.motionPreset}`
    );

    if (skin.category === 'character') {
      assert(
        isValidCharacterTheme(skin.characterTheme),
        `${label}: skin ${skin.id} missing valid characterTheme runtime mapping`
      );
    }

    assert(skin.motionAssets === undefined, `${label}: skin ${skin.id} must use single-image corner assets; motionAssets is retired`);

    if (skin.preview) {
      assert(typeof skin.preview === 'object', `${label}: skin ${skin.id} preview must be an object`);
      assert(isNonEmptyString(skin.preview.cover), `${label}: skin ${skin.id} preview.cover missing`);
    }
  }

  assert(hasDefaultSkinId, `${label}: defaultSkinId ${registry.defaultSkinId} not found`);
  return registry;
}

export function getAllowedMotionPresets() {
  return Array.from(ALLOWED_MOTION_PRESETS);
}
