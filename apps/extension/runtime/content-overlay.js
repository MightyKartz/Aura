import { applyLayout } from './layout.js';

export const OVERLAY_ROOT_ID = 'aura-root';

function buildRootMarkup() {
  return `
    <div class="aura-ornament aura-ornament--top-left" data-slot="top-left">
      <img class="aura-ornament__image" data-image="top-left" alt="" />
    </div>
    <div class="aura-ornament aura-ornament--bottom-right" data-slot="bottom-right">
      <img class="aura-ornament__image" data-image="bottom-right" alt="" />
    </div>
  `;
}

export function createOverlayManager({
  getAssetUrl = (path) => chrome.runtime.getURL(path)
} = {}) {
  let activeRoot = null;
  let lockedContainer = null;
  let lockedContainerPreviousPosition = '';

  function releaseContainerLock() {
    if (lockedContainer && lockedContainer.dataset.auraPositionLock === '1') {
      lockedContainer.style.position = lockedContainerPreviousPosition;
      delete lockedContainer.dataset.auraPositionLock;
    }

    lockedContainer = null;
    lockedContainerPreviousPosition = '';
  }

  function releaseAllContainerLocks() {
    for (const element of document.querySelectorAll('[data-aura-position-lock="1"]')) {
      if (!(element instanceof HTMLElement)) continue;
      element.style.position = '';
      delete element.dataset.auraPositionLock;
    }

    releaseContainerLock();
  }

  function ensureContainerLock(container) {
    if (!(container instanceof HTMLElement)) return;

    if (lockedContainer && lockedContainer !== container) {
      releaseContainerLock();
    }

    const computed = window.getComputedStyle(container);
    if (computed.position === 'static' && container.dataset.auraPositionLock !== '1') {
      lockedContainer = container;
      lockedContainerPreviousPosition = container.style.position;
      container.style.position = 'relative';
      container.dataset.auraPositionLock = '1';
    }
  }

  function ensureRoot(container) {
    if (!(container instanceof HTMLElement)) return null;

    for (const legacyRoot of document.querySelectorAll(`#${OVERLAY_ROOT_ID}`)) {
      if (legacyRoot.parentElement !== container) {
        legacyRoot.remove();
      }
    }

    let root = container.querySelector(`#${OVERLAY_ROOT_ID}`);
    if (!(root instanceof HTMLElement)) {
      root = document.createElement('div');
      root.id = OVERLAY_ROOT_ID;
      container.appendChild(root);
    }

    if (!root.querySelector('[data-slot="top-left"]') || !root.querySelector('[data-slot="bottom-right"]')) {
      root.innerHTML = buildRootMarkup();
    }

    activeRoot = root;
    return root;
  }

  function setImageSource(image, assetPath) {
    if (!(image instanceof HTMLImageElement)) return;
    const nextUrl = assetPath ? getAssetUrl(assetPath) : '';
    if (!nextUrl) return;
    if (image.src !== nextUrl) {
      image.src = nextUrl;
    }
  }

  function applySkin(root, skin) {
    if (!(root instanceof HTMLElement) || !(skin && skin.assets)) return;

    setImageSource(root.querySelector('[data-image="top-left"]'), skin.assets.topLeft);
    setImageSource(root.querySelector('[data-image="bottom-right"]'), skin.assets.bottomRight);

    root.style.setProperty('--aura-primary', skin.palette?.primary || '#6dd3ff');
    root.style.setProperty('--aura-accent', skin.palette?.accent || '#ffd166');
    root.style.setProperty('--aura-glow', skin.palette?.glow || '#8ecdf4');
    root.dataset.skin = skin.id;
  }

  function render({ container, skin, layout, visualState, mode }) {
    ensureContainerLock(container);
    const root = ensureRoot(container);
    if (!(root instanceof HTMLElement)) return null;

    applySkin(root, skin);
    applyLayout(root, layout, visualState, mode);
    return root;
  }

  function teardown() {
    for (const root of document.querySelectorAll(`#${OVERLAY_ROOT_ID}`)) {
      root.remove();
    }

    activeRoot = null;
    releaseAllContainerLocks();
  }

  return {
    render,
    teardown,
    getRoot: () => activeRoot
  };
}
