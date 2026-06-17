import {
  createCompanionSeed,
  createReactionController
} from '../../../packages/aura-core/src/reaction-core.js';

function createPreviewBridge() {
  const listeners = new Set();
  let previewState = {
    skinId: 'cat-default-v1',
    intensity: 'standard',
    clickThrough: false,
    visible: true
  };

  function emit() {
    for (const listener of listeners) {
      listener(previewState);
    }
  }

  return {
    getState: async () => previewState,
    getSkinRegistry: async () => {
      const response = await fetch('../../../themes/manifests/builtin-skins.json');
      return response.json();
    },
    resolveAssetUrl: async (assetPath) => `../../../apps/extension/${assetPath}`,
    setClickThrough: async (enabled) => {
      previewState = { ...previewState, clickThrough: Boolean(enabled) };
      emit();
    },
    setIntensity: async (intensity) => {
      previewState = { ...previewState, intensity };
      emit();
    },
    setSkin: async (skinId) => {
      previewState = { ...previewState, skinId };
      emit();
    },
    hide: async () => {
      previewState = { ...previewState, visible: false };
      emit();
    },
    onState: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }
  };
}

const desktopBridge = window.auraDesktop ?? createPreviewBridge();
const shell = document.querySelector('.companion-shell');
const image = document.querySelector('[data-companion-image]');
const controls = document.querySelector('.companion-controls');
const atmospheres = ['idle', 'dialogue', 'tense', 'scare', 'funny', 'action', 'sad', 'climax'];
const intensities = ['quiet', 'standard', 'lively'];

let registry = null;
let state = null;
let skins = [];
let skinIndex = 0;
let atmosphereIndex = 0;
let controller = createReactionController();

function applyPalette(skin) {
  shell.style.setProperty('--aura-primary', skin?.palette?.primary || '#fff1cf');
  shell.style.setProperty('--aura-accent', skin?.palette?.accent || '#ffd45f');
  shell.style.setProperty('--aura-glow', skin?.palette?.glow || '#ffcf5a');
}

async function applySkin(skin) {
  if (!skin) return;
  applyPalette(skin);
  image.src = await desktopBridge.resolveAssetUrl(skin.assets.bottomRight);
  image.dataset.skin = skin.id;
}

function buildController() {
  const skin = skins[skinIndex];
  controller = createReactionController({
    skinId: skin?.id || state?.skinId || '',
    intensity: state?.intensity || 'standard',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    now: () => performance.now()
  });
}

function applyReaction(atmosphereState) {
  const visual = controller.next(atmosphereState);
  shell.dataset.mood = visual.mood;
  shell.dataset.motion = visual.motion;
  shell.style.setProperty('--aura-halo-opacity', String(visual.halo));
  shell.style.setProperty('--aura-tempo', visual.restrained ? '10.5s' : visual.preferWatchful ? '9.4s' : '8s');
}

async function syncState(nextState) {
  state = { ...(state || {}), ...(nextState || {}) };
  registry ||= await desktopBridge.getSkinRegistry();
  skins = registry.skins || [];
  skinIndex = Math.max(0, skins.findIndex((skin) => skin.id === state.skinId));
  if (skinIndex < 0) skinIndex = 0;
  buildController();
  await applySkin(skins[skinIndex]);
  applyReaction(atmospheres[atmosphereIndex]);
}

controls.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;

  if (action === 'skin') {
    skinIndex = (skinIndex + 1) % skins.length;
    await desktopBridge.setSkin(skins[skinIndex].id);
    return;
  }

  if (action === 'intensity') {
    const current = intensities.indexOf(state?.intensity || 'standard');
    await desktopBridge.setIntensity(intensities[(current + 1) % intensities.length]);
    return;
  }

  if (action === 'reaction') {
    atmosphereIndex = (atmosphereIndex + 1) % atmospheres.length;
    applyReaction(atmospheres[atmosphereIndex]);
    return;
  }

  if (action === 'click-through') {
    await desktopBridge.setClickThrough(!state?.clickThrough);
    return;
  }

  if (action === 'hide') {
    await desktopBridge.hide();
  }
});

desktopBridge.onState((nextState) => {
  void syncState(nextState);
});

void syncState(await desktopBridge.getState());

const seed = createCompanionSeed(navigator.userAgent);
window.setInterval(() => {
  if (!document.hasFocus()) return;
  if (seed % 3 === 0 && atmosphereIndex === 0) {
    applyReaction('calm');
    window.setTimeout(() => applyReaction('idle'), 2200);
  }
}, 14000);
