import { normalizeSizeScale, SIZE_SCALE_MAX, SIZE_SCALE_MIN } from './settings.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getSkinLayoutProfile(skin) {
  if (skin?.category === 'character') {
    return {
      topInsetBoost: 34,
      bottomInsetBoost: 0,
      topWidthBounds: [176, 330],
      bottomWidthRatio: { windowed: 0.158, compact: 0.172 },
      bottomWidthBounds: [168, 252],
      topWidthToBottomWidth: 1.28,
      bottomOffsetRatio: { windowed: 0.082, compact: 0.096 },
      bottomOffsetBounds: { idle: [48, 82], controls: [98, 126], ad: [60, 88] }
    };
  }

  return {
    topInsetBoost: 28,
    bottomInsetBoost: 0,
    topWidthBounds: [124, 240],
    bottomWidthRatio: { windowed: 0.14, compact: 0.15 },
    bottomWidthBounds: [130, 220],
    topWidthToBottomWidth: 0.96,
    bottomOffsetRatio: { windowed: 0.078, compact: 0.094 },
    bottomOffsetBounds: { idle: [40, 64], controls: [92, 116], ad: [54, 82] }
  };
}

export function computeLayout(containerRect, visualState, skin = null, settings = {}) {
  const compact = visualState.playbackMode !== 'windowed';
  const profile = getSkinLayoutProfile(skin);
  const sizeScale = normalizeSizeScale(settings.sizeScale);
  const baseInset = Math.round(clamp(containerRect.width * 0.018, 14, 20));
  const topInset = baseInset + profile.topInsetBoost;
  const topLeftInset = Math.round(clamp(containerRect.width * 0.001, 0, 2));
  const bottomInset = Math.round(clamp(
    containerRect.width * 0.001
      + profile.bottomInsetBoost
      + (visualState.adActive ? 2 : 0),
    0,
    6
  ));
  const bottomWidth = Math.round(clamp(
    containerRect.width * (compact ? profile.bottomWidthRatio.compact : profile.bottomWidthRatio.windowed) * sizeScale,
    Math.round(profile.bottomWidthBounds[0] * SIZE_SCALE_MIN),
    Math.round(profile.bottomWidthBounds[1] * SIZE_SCALE_MAX)
  ));
  const topWidth = Math.round(clamp(
    bottomWidth * profile.topWidthToBottomWidth,
    Math.round(profile.topWidthBounds[0] * SIZE_SCALE_MIN),
    Math.round(profile.topWidthBounds[1] * SIZE_SCALE_MAX)
  ));

  let bottomOffset = Math.round(clamp(
    visualState.controlsVisible
      ? containerRect.height * 0.18
      : compact
        ? containerRect.height * profile.bottomOffsetRatio.compact
        : containerRect.height * profile.bottomOffsetRatio.windowed,
    ...(visualState.controlsVisible ? profile.bottomOffsetBounds.controls : profile.bottomOffsetBounds.idle)
  ));

  if (visualState.adActive) {
    bottomOffset = Math.max(
      bottomOffset,
      Math.round(clamp(containerRect.height * 0.115, ...profile.bottomOffsetBounds.ad))
    );
  }

  return {
    topInset,
    topLeftInset,
    bottomInset,
    topWidth,
    bottomWidth,
    bottomOffset
  };
}

export function computeStatePresentation(visualState, skin = null) {
  const isCharacterSkin = skin?.category === 'character';
  let bottomLayoutScale = isCharacterSkin ? 0.95 : 0.98;
  let bottomLayoutLift = 0;
  let imageBrightness = isCharacterSkin ? 0.94 : 1;

  if (visualState.controlsVisible) {
    bottomLayoutScale = isCharacterSkin ? 0.92 : 0.95;
    bottomLayoutLift = -6;
  }

  if (visualState.playbackState === 'paused') {
    imageBrightness = isCharacterSkin ? 0.92 : 0.99;
  }

  if (visualState.adActive) {
    bottomLayoutScale = Math.min(bottomLayoutScale, isCharacterSkin ? 0.91 : 0.95);
    bottomLayoutLift = Math.min(bottomLayoutLift, -4);
    imageBrightness = isCharacterSkin ? Math.min(imageBrightness, 0.9) : Math.max(imageBrightness, 1.03);
  }

  return {
    bottomLayoutScale,
    bottomLayoutLift,
    imageBrightness
  };
}

export function applyLayout(root, layout, visualState, skin = null) {
  if (!(root instanceof HTMLElement)) return;

  const presentation = computeStatePresentation(visualState, skin);
  root.style.setProperty('--aura-top-inset', `${layout.topInset}px`);
  root.style.setProperty('--aura-top-left-inset', `${layout.topLeftInset ?? layout.topInset}px`);
  root.style.setProperty('--aura-bottom-inset', `${layout.bottomInset}px`);
  root.style.setProperty('--aura-top-width', `${layout.topWidth}px`);
  root.style.setProperty('--aura-bottom-width', `${layout.bottomWidth}px`);
  root.style.setProperty('--aura-bottom-offset', `${layout.bottomOffset}px`);
  root.style.setProperty('--aura-bottom-layout-scale', `${presentation.bottomLayoutScale}`);
  root.style.setProperty('--aura-bottom-layout-lift', `${presentation.bottomLayoutLift}px`);
  root.style.setProperty('--aura-image-brightness', `${presentation.imageBrightness}`);

  root.dataset.visible = '1';
}
