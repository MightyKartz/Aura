const ALLOWED_THEME_LAYERS = new Set(['base', 'genre', 'mapped']);
const ALLOWED_MICROCOPY_TONES = new Set(['gentle', 'restrained', 'cool', 'playful']);
const CHARACTER_ARCHETYPE_PRESETS = {
  'ancient-general': 'poetic-guard',
  'ancient-lady': 'graceful'
};
const CHARACTER_ARCHETYPE_PATCHES = {
  'ancient-general': {
    root: {
      backdropOpacity: 0.96,
      sparkleOpacity: 0.88,
      sparkleScale: 0.94
    }
  },
  'ancient-lady': {
    root: {
      speedMultiplier: 1.04,
      sparkleOpacity: 0.96
    },
    topLeft: {
      driftPx: 0.92,
      tiltDeg: 0.92
    },
    bottomRight: {
      driftPx: 0.9,
      scalePeak: 0.996
    }
  }
};
const MOTION_LANGUAGE_PATCHES = {
  '视线轻偏': {
    bottomRight: {
      probeXPx: 1.12,
      tiltDeg: 1.04
    }
  },
  '披风边微动': {
    root: {
      sparkleOpacity: 0.96
    },
    bottomRight: {
      driftPx: 1.06,
      mistShiftPx: 1.22
    }
  },
  '扇面微移': {
    bottomRight: {
      driftPx: 0.88,
      probeXPx: 0.72,
      scalePeak: 0.992
    }
  },
  '珠钗轻晃': {
    root: {
      sparkleScale: 1.03
    },
    topLeft: {
      driftPx: 0.94,
      glintStrength: 1.14
    }
  }
};

function asText(value = '') {
  return String(value || '').trim();
}

function asList(values) {
  return Array.isArray(values)
    ? values.map((value) => asText(value)).filter(Boolean)
    : [];
}

export function normalizeCharacterTheme(theme = null) {
  if (!theme || typeof theme !== 'object') return null;

  const topLeftAtmosphere = theme.topLeftAtmosphere && typeof theme.topLeftAtmosphere === 'object'
    ? {
        motifs: asList(theme.topLeftAtmosphere.motifs),
        semanticHint: asText(theme.topLeftAtmosphere.semanticHint)
      }
    : { motifs: [], semanticHint: '' };

  const bottomRightCharacter = theme.bottomRightCharacter && typeof theme.bottomRightCharacter === 'object'
    ? {
        role: asText(theme.bottomRightCharacter.role),
        pose: asText(theme.bottomRightCharacter.pose),
        prop: asText(theme.bottomRightCharacter.prop)
      }
    : { role: '', pose: '', prop: '' };

  const motionLanguage = theme.motionLanguage && typeof theme.motionLanguage === 'object'
    ? {
        focus: asText(theme.motionLanguage.focus),
        accent: asText(theme.motionLanguage.accent)
      }
    : { focus: '', accent: '' };

  const layer = asText(theme.layer);
  const microcopyTone = asText(theme.microcopyTone);

  return {
    layer,
    archetype: asText(theme.archetype),
    themeName: asText(theme.themeName),
    themeSlug: asText(theme.themeSlug),
    topLeftAtmosphere,
    bottomRightCharacter,
    motionLanguage,
    microcopyTone: ALLOWED_MICROCOPY_TONES.has(microcopyTone) ? microcopyTone : ''
  };
}

export function isValidCharacterTheme(theme) {
  const normalized = normalizeCharacterTheme(theme);
  if (!normalized) return false;

  return ALLOWED_THEME_LAYERS.has(normalized.layer)
    && Boolean(normalized.archetype)
    && Boolean(normalized.themeName)
    && Boolean(normalized.themeSlug)
    && Boolean(normalized.topLeftAtmosphere.semanticHint)
    && normalized.topLeftAtmosphere.motifs.length > 0
    && Boolean(normalized.bottomRightCharacter.role)
    && Boolean(normalized.bottomRightCharacter.pose)
    && Boolean(normalized.bottomRightCharacter.prop)
    && Boolean(normalized.motionLanguage.focus)
    && Boolean(normalized.motionLanguage.accent)
    && Boolean(normalized.microcopyTone);
}

export function getCharacterTheme(skin = null) {
  return normalizeCharacterTheme(skin?.characterTheme);
}

export function getCharacterThemeSemanticHint(skin = null) {
  return getCharacterTheme(skin)?.topLeftAtmosphere.semanticHint || '';
}

export function getCharacterThemeAtmosphereLabel(skin = null) {
  const motifs = getCharacterTheme(skin)?.topLeftAtmosphere.motifs || [];
  return motifs.slice(0, 2).join(' · ');
}

export function getCharacterThemeNarrativeLabel(skin = null) {
  const theme = getCharacterTheme(skin);
  if (!theme) return '';

  const role = theme.bottomRightCharacter.role;
  const prop = theme.bottomRightCharacter.prop;
  return [role, prop].filter(Boolean).join(' · ');
}

export function getMicrocopyTone(skin = null, fallback = 'gentle') {
  return getCharacterTheme(skin)?.microcopyTone || fallback;
}

export function getMicrocopyCountLabel(tone = 'gentle', count = 0) {
  const normalizedCount = Number(count || 0);
  if (normalizedCount <= 0) return '';

  switch (tone) {
    case 'restrained':
      return `已藏 ${normalizedCount} 处`;
    case 'cool':
      return `记录 ${normalizedCount} 处`;
    case 'playful':
      return `收好 ${normalizedCount} 处`;
    case 'gentle':
    default:
      return `已标记 ${normalizedCount} 处`;
  }
}

export function getMicrocopyResumeLabel(tone = 'gentle', value = '') {
  const text = asText(value);
  if (!text) return '';

  switch (tone) {
    case 'restrained':
      return `回看点 ${text}`;
    case 'cool':
      return `续看 ${text}`;
    case 'playful':
      return `接着看 ${text}`;
    case 'gentle':
    default:
      return `回看 ${text}`;
  }
}

export function getMicrocopyRecentLabel(tone = 'gentle', value = '') {
  const text = asText(value);
  if (!text) return '';

  switch (tone) {
    case 'restrained':
      return `片刻 ${text}`;
    case 'cool':
      return `最近 ${text}`;
    case 'playful':
      return `刚收下 ${text}`;
    case 'gentle':
    default:
      return `最近 ${text}`;
  }
}

function mergeMotionPatch(target, source) {
  if (!(target && source)) return target;

  for (const [sectionKey, sectionValue] of Object.entries(source)) {
    if (!(sectionValue && typeof sectionValue === 'object' && !Array.isArray(sectionValue))) {
      target[sectionKey] = sectionValue;
      continue;
    }

    const targetSection = target[sectionKey] && typeof target[sectionKey] === 'object' && !Array.isArray(target[sectionKey])
      ? target[sectionKey]
      : {};

    for (const [propertyKey, propertyValue] of Object.entries(sectionValue)) {
      targetSection[propertyKey] = propertyValue;
    }

    target[sectionKey] = targetSection;
  }

  return target;
}

export function getCharacterMotionPreset(skin = null, fallbackPreset = '') {
  const theme = getCharacterTheme(skin);
  return skin?.motionPreset
    || CHARACTER_ARCHETYPE_PRESETS[theme?.archetype]
    || fallbackPreset;
}

export function getCharacterMotionPatch(skin = null) {
  const theme = getCharacterTheme(skin);
  if (!theme) return null;

  const patch = mergeMotionPatch({}, CHARACTER_ARCHETYPE_PATCHES[theme.archetype]);
  mergeMotionPatch(patch, MOTION_LANGUAGE_PATCHES[theme.motionLanguage.focus]);
  mergeMotionPatch(patch, MOTION_LANGUAGE_PATCHES[theme.motionLanguage.accent]);
  return Object.keys(patch).length > 0 ? patch : null;
}

export function getCharacterMotionSignature(skin = null) {
  const theme = getCharacterTheme(skin);
  if (!theme) return '';

  return [theme.archetype, theme.motionLanguage.focus, theme.motionLanguage.accent]
    .map((value) => asText(value))
    .filter(Boolean)
    .join(' / ');
}

export function scoreSkinMatch(skin = null, text = '') {
  const normalizedText = asText(text);
  if (!normalizedText) return 0;

  const keywords = asList(skin?.match?.keywords);
  const theme = getCharacterTheme(skin);
  const weightedSignals = [
    ...keywords.map((keyword) => ({ token: keyword, weight: 1 })),
    { token: theme?.themeName, weight: 3 },
    { token: theme?.topLeftAtmosphere.semanticHint, weight: 3 },
    { token: theme?.bottomRightCharacter.role, weight: 2 },
    { token: theme?.bottomRightCharacter.pose, weight: 1 },
    { token: theme?.bottomRightCharacter.prop, weight: 1 },
    { token: theme?.archetype?.replaceAll('-', ' '), weight: 1 }
  ].filter(({ token }) => Boolean(asText(token)));

  return weightedSignals.reduce((sum, { token, weight }) => (
    normalizedText.includes(asText(token)) ? sum + weight : sum
  ), 0);
}

export function getThemeLayer(skin = null) {
  return getCharacterTheme(skin)?.layer || '';
}
