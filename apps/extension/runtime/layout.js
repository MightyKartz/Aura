function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function computeLayout(containerRect, visualState) {
  const compact = visualState.playbackMode !== 'windowed';
  const baseInset = Math.round(clamp(containerRect.width * 0.018, 14, 20));
  const topWidth = Math.round(clamp(containerRect.width * (compact ? 0.078 : 0.086), 72, 138));
  const bottomWidth = Math.round(clamp(containerRect.width * (compact ? 0.104 : 0.118), 96, 178));

  let bottomOffset = Math.round(clamp(
    visualState.controlsVisible
      ? containerRect.height * 0.18
      : compact
        ? containerRect.height * 0.094
        : containerRect.height * 0.078,
    visualState.controlsVisible ? 92 : 40,
    visualState.controlsVisible ? 116 : 64
  ));

  if (visualState.adActive) {
    bottomOffset = Math.max(bottomOffset, Math.round(clamp(containerRect.height * 0.115, 54, 82)));
  }

  return {
    topInset: baseInset,
    bottomInset: baseInset,
    topWidth,
    bottomWidth,
    bottomOffset
  };
}

export function computeOpacities(mode, visualState) {
  const intensity = mode === 'quiet'
    ? 0.78
    : mode === 'lively'
      ? 1
      : 0.9;

  let topOpacity = 0.7 * intensity;
  let bottomOpacity = 0.84 * intensity;

  if (visualState.controlsVisible) bottomOpacity -= 0.2;
  if (visualState.playbackState === 'paused') bottomOpacity -= 0.08;
  if (visualState.adActive) {
    topOpacity -= 0.16;
    bottomOpacity -= 0.28;
  }

  return {
    topOpacity: clamp(topOpacity, 0.36, 0.86),
    bottomOpacity: clamp(bottomOpacity, 0.3, 0.94)
  };
}

export function applyLayout(root, layout, visualState, mode) {
  if (!(root instanceof HTMLElement)) return;

  const opacities = computeOpacities(mode, visualState);
  root.style.setProperty('--aura-top-inset', `${layout.topInset}px`);
  root.style.setProperty('--aura-bottom-inset', `${layout.bottomInset}px`);
  root.style.setProperty('--aura-top-width', `${layout.topWidth}px`);
  root.style.setProperty('--aura-bottom-width', `${layout.bottomWidth}px`);
  root.style.setProperty('--aura-bottom-offset', `${layout.bottomOffset}px`);
  root.style.setProperty('--aura-top-opacity', `${opacities.topOpacity}`);
  root.style.setProperty('--aura-bottom-opacity', `${opacities.bottomOpacity}`);

  root.dataset.visible = '1';
  root.dataset.mode = mode;
  root.dataset.playback = visualState.playbackState;
  root.dataset.controlsVisible = visualState.controlsVisible ? '1' : '0';
  root.dataset.fullscreen = visualState.playbackMode === 'windowed' ? '0' : '1';
  root.dataset.ad = visualState.adActive ? '1' : '0';
}
