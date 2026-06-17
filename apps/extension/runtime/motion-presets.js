import {
  getCharacterMotionPatch,
  getCharacterMotionPreset,
  getCharacterMotionSignature
} from './character-theme.js';

const DEFAULT_MOTION_PRESET = 'soft';

const BASE_PRESET_PROFILES = {
  soft: {
    root: {
      speedMultiplier: 1,
      sparkleOpacity: 0.66,
      sparkleScale: 1,
      backdropOpacity: 0.62
    },
    topLeft: {
      driftPx: 2,
      tiltDeg: -1.2,
      glintStrength: 1
    },
    bottomRight: {
      driftPx: 4,
      tiltDeg: 1,
      liftPx: 0,
      scaleFrom: 0.992,
      scalePeak: 1.008,
      probeXPx: 0.8,
      mistShiftPx: 4
    },
    stateModifiers: {
      attention: {
        root: {
          sparkleOpacity: 1.04,
          sparkleScale: 1.02
        },
        topLeft: {
          driftPx: 1.08,
          glintStrength: 1.08
        },
        bottomRight: {
          driftPx: 0.62,
          probeXPx: 0.36,
          scalePeak: 1.006
        }
      },
      paused: {
        root: {
          speedMultiplier: 0.96,
          sparkleOpacity: 0.82
        },
        bottomRight: {
          driftPx: 0.82,
          probeXPx: 0.2
        }
      },
      controlsVisible: {
        root: {
          sparkleOpacity: 0.72
        },
        bottomRight: {
          driftPx: 0.68,
          probeXPx: 0.42
        }
      },
      adActive: {
        root: {
          sparkleOpacity: 0.42,
          sparkleScale: 0.94,
          backdropOpacity: 0.8
        },
        bottomRight: {
          driftPx: 0.56,
          probeXPx: 0
        }
      }
    }
  },
  watchful: {
    root: {
      speedMultiplier: 0.92,
      sparkleOpacity: 0.56,
      sparkleScale: 0.96,
      backdropOpacity: 0.64
    },
    topLeft: {
      driftPx: 2.8,
      tiltDeg: -0.9,
      glintStrength: 1.04
    },
    bottomRight: {
      driftPx: 3.6,
      tiltDeg: 0.62,
      liftPx: 0,
      scaleFrom: 0.994,
      scalePeak: 1.008,
      probeXPx: 0.9,
      mistShiftPx: 7
    },
    stateModifiers: {
      attention: {
        root: {
          sparkleOpacity: 1.08,
          sparkleScale: 1
        },
        bottomRight: {
          driftPx: 0.5,
          probeXPx: 0.28,
          scalePeak: 1.006
        }
      },
      paused: {
        root: {
          speedMultiplier: 0.94,
          sparkleOpacity: 0.62
        },
        topLeft: {
          driftPx: 0.7
        },
        bottomRight: {
          driftPx: 0.34,
          probeXPx: 0.1,
          mistShiftPx: 0.44
        }
      },
      controlsVisible: {
        root: {
          sparkleOpacity: 0.56,
          backdropOpacity: 0.82
        },
        bottomRight: {
          driftPx: 0.46,
          probeXPx: 0.22,
          mistShiftPx: 0.48
        }
      },
      adActive: {
        root: {
          sparkleOpacity: 0.3,
          sparkleScale: 0.92,
          backdropOpacity: 0.74
        },
        bottomRight: {
          driftPx: 0.36,
          probeXPx: 0,
          mistShiftPx: 0.34
        }
      }
    }
  },
  'detective-cat': {
    root: {
      speedMultiplier: 1.04,
      sparkleOpacity: 0.42,
      sparkleScale: 0.88,
      backdropOpacity: 0.58
    },
    topLeft: {
      driftPx: 2.4,
      tiltDeg: -0.5,
      glintStrength: 0.92
    },
    bottomRight: {
      driftPx: 2.2,
      tiltDeg: 0.28,
      liftPx: -1,
      scaleFrom: 0.994,
      scalePeak: 1.004,
      probeXPx: 0.56,
      mistShiftPx: 5
    },
    stateModifiers: {
      attention: {
        root: {
          sparkleOpacity: 1.06,
          sparkleScale: 0.94
        },
        bottomRight: {
          driftPx: 0.42,
          probeXPx: 0.18,
          scalePeak: 1.004
        }
      },
      paused: {
        root: {
          speedMultiplier: 1.08,
          sparkleOpacity: 0.48
        },
        topLeft: {
          driftPx: 0.54
        },
        bottomRight: {
          driftPx: 0.24,
          probeXPx: 0.08,
          mistShiftPx: 0.36
        }
      },
      controlsVisible: {
        root: {
          sparkleOpacity: 0.42,
          backdropOpacity: 0.78
        },
        bottomRight: {
          driftPx: 0.32,
          probeXPx: 0.18,
          mistShiftPx: 0.42
        }
      },
      adActive: {
        root: {
          sparkleOpacity: 0.22,
          sparkleScale: 0.82,
          backdropOpacity: 0.56
        },
        bottomRight: {
          driftPx: 0.22,
          probeXPx: 0,
          mistShiftPx: 0.28
        }
      }
    }
  },
  'poetic-guard': {
    root: {
      speedMultiplier: 1.08,
      sparkleOpacity: 0.18,
      sparkleScale: 0.82,
      backdropOpacity: 0.48
    },
    topLeft: {
      driftPx: 0,
      tiltDeg: 0,
      glintStrength: 0.82
    },
    bottomRight: {
      driftPx: 0,
      tiltDeg: 0,
      liftPx: 0,
      scaleFrom: 1,
      scalePeak: 1.018,
      probeXPx: 0,
      mistShiftPx: 0,
      haloOpacity: 0.26,
      haloScale: 1
    },
    stateModifiers: {
      attention: {
        root: {
          sparkleOpacity: 1.16,
          backdropOpacity: 1.08
        },
        bottomRight: {
          driftPx: 0,
          probeXPx: 0,
          scalePeak: 1.008,
          mistShiftPx: 0,
          haloOpacity: 2.35,
          haloScale: 1.12
        }
      },
      paused: {
        root: {
          speedMultiplier: 1.18,
          sparkleOpacity: 0.82
        },
        bottomRight: {
          driftPx: 0,
          probeXPx: 0,
          scalePeak: 1,
          haloOpacity: 0.82,
          haloScale: 0.96
        }
      },
      controlsVisible: {
        root: {
          sparkleOpacity: 0.68,
          backdropOpacity: 0.78
        },
        bottomRight: {
          driftPx: 0,
          probeXPx: 0,
          scalePeak: 0.992,
          haloOpacity: 0.58,
          haloScale: 0.94
        }
      },
      adActive: {
        root: {
          sparkleOpacity: 0.32,
          sparkleScale: 0.72,
          backdropOpacity: 0.42
        },
        bottomRight: {
          driftPx: 0,
          probeXPx: 0,
          scalePeak: 0.99,
          mistShiftPx: 0,
          haloOpacity: 0,
          haloScale: 0.9
        }
      }
    }
  },
  graceful: {
    root: {
      speedMultiplier: 1.08,
      sparkleOpacity: 0.6,
      sparkleScale: 1.02,
      backdropOpacity: 0.62
    },
    topLeft: {
      driftPx: 2.2,
      tiltDeg: -1.8,
      glintStrength: 1.04
    },
    bottomRight: {
      driftPx: 3.4,
      tiltDeg: 0.62,
      liftPx: -1,
      scaleFrom: 0.994,
      scalePeak: 1.006,
      probeXPx: 0.64,
      mistShiftPx: 4
    },
    stateModifiers: {
      attention: {
        root: {
          sparkleOpacity: 1.04
        },
        bottomRight: {
          driftPx: 0.54,
          probeXPx: 0.28
        }
      },
      paused: {
        bottomRight: {
          driftPx: 0.58,
          probeXPx: 0.12
        }
      },
      controlsVisible: {
        bottomRight: {
          driftPx: 0.54,
          probeXPx: 0.28
        }
      },
      adActive: {
        root: {
          sparkleOpacity: 0.42,
          backdropOpacity: 0.78
        },
        bottomRight: {
          driftPx: 0.46,
          probeXPx: 0
        }
      }
    }
  },
  energetic: {
    root: {
      speedMultiplier: 0.88,
      sparkleOpacity: 0.88,
      sparkleScale: 1.08,
      backdropOpacity: 0.78
    },
    topLeft: {
      driftPx: 2.8,
      tiltDeg: -1.44,
      glintStrength: 1.12
    },
    bottomRight: {
      driftPx: 5.4,
      tiltDeg: 0.92,
      liftPx: -1,
      scaleFrom: 0.992,
      scalePeak: 1.02,
      probeXPx: 2.2,
      mistShiftPx: 5
    },
    stateModifiers: {
      attention: {
        root: {
          sparkleOpacity: 1.08,
          sparkleScale: 1.04
        },
        bottomRight: {
          driftPx: 0.96,
          probeXPx: 0.8
        }
      },
      paused: {
        bottomRight: {
          driftPx: 0.68,
          probeXPx: 0.16
        }
      },
      controlsVisible: {
        bottomRight: {
          driftPx: 0.62,
          probeXPx: 0.34
        }
      },
      adActive: {
        root: {
          sparkleOpacity: 0.46,
          backdropOpacity: 0.78
        },
        bottomRight: {
          driftPx: 0.5,
          probeXPx: 0
        }
      }
    }
  }
};

const MODE_PATCHES = {
  quiet: {
    root: {
      speedMultiplier: 1.24
    },
    topLeft: {
      driftPx: 0.8,
      tiltDeg: 0.86
    },
    bottomRight: {
      driftPx: 0.68,
      tiltDeg: 0.7,
      probeXPx: 0.82,
      scalePeak: 0.992
    }
  },
  standard: {},
  lively: {
    root: {
      speedMultiplier: 0.86,
      sparkleOpacity: 1.08,
      sparkleScale: 1.04
    },
    topLeft: {
      driftPx: 1.18,
      tiltDeg: 1.08,
      glintStrength: 1.08
    },
    bottomRight: {
      driftPx: 1.08,
      tiltDeg: 1.08,
      probeXPx: 1.08,
      scalePeak: 1.008
    }
  }
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function scaleSection(section, patch) {
  if (!(section && patch)) return;

  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'number' && typeof section[key] === 'number') {
      section[key] *= value;
      continue;
    }

    section[key] = value;
  }
}

function applyProfilePatch(profile, patch) {
  if (!patch) return;
  scaleSection(profile.root, patch.root);
  scaleSection(profile.topLeft, patch.topLeft);
  scaleSection(profile.bottomRight, patch.bottomRight);
}

function roundNumber(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function deriveMotionState(profileId, visualState) {
  if (visualState.adActive) return 'ad-muted';
  if (visualState.playbackState === 'paused') return 'paused-still';
  if (profileId === 'poetic-guard' && visualState.attentionActive) return 'attention-soft';
  if (visualState.controlsVisible) return 'controls-softened';
  return ['watchful', 'detective-cat'].includes(profileId) ? 'idle-watch' : 'idle-soft';
}

export function resolveMotionProfile({
  skin = null,
  motionPreset = '',
  mode = 'standard',
  visualState = {}
} = {}) {
  const requestedPreset = getCharacterMotionPreset(skin, motionPreset || DEFAULT_MOTION_PRESET);
  const presetId = BASE_PRESET_PROFILES[requestedPreset] ? requestedPreset : DEFAULT_MOTION_PRESET;
  const profile = deepClone(BASE_PRESET_PROFILES[presetId]);

  applyProfilePatch(profile, MODE_PATCHES[mode] ?? MODE_PATCHES.standard);
  applyProfilePatch(profile, getCharacterMotionPatch(skin));

  if (visualState.controlsVisible) {
    applyProfilePatch(profile, profile.stateModifiers.controlsVisible);
  }
  if (visualState.playbackState === 'paused') {
    applyProfilePatch(profile, profile.stateModifiers.paused);
  }
  if (visualState.attentionActive && visualState.playbackState !== 'paused' && !visualState.adActive) {
    applyProfilePatch(profile, profile.stateModifiers.attention);
  }
  if (visualState.adActive) {
    applyProfilePatch(profile, profile.stateModifiers.adActive);
  }

  profile.id = presetId;
  profile.motionSignature = getCharacterMotionSignature(skin);
  profile.motionState = deriveMotionState(presetId, visualState);

  return profile;
}

export function applyMotionProfile(root, profile) {
  if (!(root instanceof HTMLElement) || !profile) return null;

  const { root: rootMotion, topLeft, bottomRight } = profile;
  const midScale = roundNumber((bottomRight.scaleFrom + bottomRight.scalePeak) / 2, 4);
  const mistOpacity = roundNumber(Math.min(rootMotion.backdropOpacity * 0.92, 0.92), 3);

  root.style.setProperty('--aura-motion-speed', `${rootMotion.speedMultiplier}`);
  root.style.setProperty('--aura-sparkle-opacity', `${rootMotion.sparkleOpacity}`);
  root.style.setProperty('--aura-sparkle-scale', `${rootMotion.sparkleScale}`);
  root.style.setProperty('--aura-backdrop-opacity', `${rootMotion.backdropOpacity}`);
  root.style.setProperty('--aura-top-drift', `${topLeft.driftPx}px`);
  root.style.setProperty('--aura-top-tilt', `${topLeft.tiltDeg}deg`);
  root.style.setProperty('--aura-bottom-drift', `${bottomRight.driftPx}px`);
  root.style.setProperty('--aura-bottom-tilt', `${bottomRight.tiltDeg}deg`);
  root.style.setProperty('--aura-bottom-motion-lift', `${bottomRight.liftPx}px`);
  root.style.setProperty('--aura-bottom-scale-from', `${bottomRight.scaleFrom}`);
  root.style.setProperty('--aura-bottom-scale-mid', `${midScale}`);
  root.style.setProperty('--aura-bottom-scale-peak', `${bottomRight.scalePeak}`);
  root.style.setProperty('--aura-bottom-probe-x', `${bottomRight.probeXPx}px`);
  root.style.setProperty('--aura-bottom-mist-shift', `${bottomRight.mistShiftPx}px`);
  root.style.setProperty('--aura-bottom-mist-opacity', `${mistOpacity}`);
  root.style.setProperty('--aura-companion-halo-opacity', `${bottomRight.haloOpacity ?? 0}`);
  root.style.setProperty('--aura-companion-halo-scale', `${bottomRight.haloScale ?? 1}`);

  root.dataset.motionPreset = profile.id;
  root.dataset.motionState = profile.motionState;
  root.dataset.motionSignature = profile.motionSignature || '';

  return {
    motionPreset: profile.id,
    motionSignature: profile.motionSignature || '',
    motionState: profile.motionState,
    companionHaloOpacity: bottomRight.haloOpacity ?? 0,
    companionHaloScale: bottomRight.haloScale ?? 1
  };
}
