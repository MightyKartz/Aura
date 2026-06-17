const ATMOSPHERE_STATES = [
  'idle',
  'calm',
  'dialogue',
  'tense',
  'scare',
  'funny',
  'action',
  'sad',
  'climax'
];

const INTENSITY_SCALE = {
  quiet: 0.62,
  standard: 1,
  lively: 1.28
};

const ACTION_CATALOG = {
  idle: {
    action: 'idle-breathe',
    mood: 'idle',
    motion: 'breathe',
    halo: 0.1,
    durationMs: 0,
    cooldownMs: 0
  },
  calm: {
    action: 'soft-nod',
    mood: 'calm',
    motion: 'breathe',
    halo: 0.14,
    durationMs: 2200,
    cooldownMs: 1200
  },
  dialogue: {
    action: 'listen-lean',
    mood: 'listening',
    motion: 'listen',
    halo: 0.12,
    durationMs: 2600,
    cooldownMs: 1600
  },
  tense: {
    action: 'watchful-freeze',
    mood: 'tense',
    motion: 'watchful',
    halo: 0.24,
    durationMs: 3200,
    cooldownMs: 4200
  },
  scare: {
    action: 'short-flinch',
    mood: 'startled',
    motion: 'flinch',
    halo: 0.38,
    durationMs: 900,
    cooldownMs: 9000
  },
  funny: {
    action: 'light-bounce',
    mood: 'bright',
    motion: 'bounce',
    halo: 0.22,
    durationMs: 2000,
    cooldownMs: 3200
  },
  action: {
    action: 'energized-watch',
    mood: 'energized',
    motion: 'energy',
    halo: 0.3,
    durationMs: 2800,
    cooldownMs: 3600
  },
  sad: {
    action: 'dim-still',
    mood: 'soft-sad',
    motion: 'slow',
    halo: 0.08,
    durationMs: 4200,
    cooldownMs: 3200
  },
  climax: {
    action: 'contained-spark',
    mood: 'climax',
    motion: 'spark',
    halo: 0.36,
    durationMs: 2600,
    cooldownMs: 6800
  }
};

const SKIN_PERSONALITY = {
  'cat-default-v1': {
    warmth: 1.08,
    tempo: 0.94
  },
  'cat-suspense-v1': {
    warmth: 0.84,
    tempo: 0.82,
    preferWatchful: true
  },
  'cat-rain-detective-v1': {
    warmth: 0.82,
    tempo: 0.78,
    preferWatchful: true
  },
  'cat-hotblood-v1': {
    warmth: 1.14,
    tempo: 1.18
  },
  'general-peach-guard-v1': {
    warmth: 0.92,
    tempo: 0.72,
    restrained: true
  },
  'lady-moon-fan-v1': {
    warmth: 1.02,
    tempo: 0.76,
    restrained: true
  }
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAtmosphereState(value) {
  return ATMOSPHERE_STATES.includes(value) ? value : 'idle';
}

function normalizeIntensity(value) {
  return Object.hasOwn(INTENSITY_SCALE, value) ? value : 'standard';
}

function getSkinPersonality(skinId) {
  return SKIN_PERSONALITY[skinId] ?? { warmth: 1, tempo: 1 };
}

export function createCompanionSeed(input = 'aura') {
  let hash = 2166136261;
  const text = String(input || 'aura');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveReactionAction({
  atmosphereState = 'idle',
  intensity = 'standard',
  skinId = '',
  reducedMotion = false
} = {}) {
  const normalizedAtmosphere = normalizeAtmosphereState(atmosphereState);
  const normalizedIntensity = normalizeIntensity(intensity);
  const base = ACTION_CATALOG[normalizedAtmosphere];
  const personality = getSkinPersonality(skinId);
  const scale = reducedMotion ? 0.34 : INTENSITY_SCALE[normalizedIntensity];
  const tempo = personality.tempo ?? 1;
  const halo = clamp(base.halo * scale * (personality.warmth ?? 1), 0, 0.42);
  const durationMs = Math.round(base.durationMs / Math.max(tempo, 0.2));
  const cooldownMs = Math.round(base.cooldownMs / Math.max(scale, 0.2));

  return {
    atmosphereState: normalizedAtmosphere,
    intensity: normalizedIntensity,
    skinId,
    action: base.action,
    mood: base.mood,
    motion: reducedMotion ? 'reduced' : base.motion,
    halo,
    durationMs,
    cooldownMs,
    restrained: personality.restrained === true,
    preferWatchful: personality.preferWatchful === true
  };
}

export function createReactionController({
  skinId = '',
  intensity = 'standard',
  reducedMotion = false,
  now = () => Date.now()
} = {}) {
  let active = resolveReactionAction({ atmosphereState: 'idle', intensity, skinId, reducedMotion });
  let cooldownUntilMs = 0;

  return {
    next(atmosphereState) {
      const timestamp = now();
      const requested = resolveReactionAction({
        atmosphereState,
        intensity,
        skinId,
        reducedMotion
      });

      if (requested.atmosphereState !== 'idle' && timestamp < cooldownUntilMs) {
        return {
          ...active,
          heldByCooldown: true,
          cooldownUntilMs
        };
      }

      active = requested;
      cooldownUntilMs = timestamp + requested.cooldownMs;

      return {
        ...active,
        heldByCooldown: false,
        cooldownUntilMs
      };
    },
    getState() {
      return {
        ...active,
        cooldownUntilMs
      };
    }
  };
}

export {
  ACTION_CATALOG,
  ATMOSPHERE_STATES,
  INTENSITY_SCALE,
  SKIN_PERSONALITY
};
