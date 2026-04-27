import { applyLayout } from './layout.js';
import { applyMotionProfile, resolveMotionProfile } from './motion-presets.js';
import { resolveRuntimeAssetUrl } from './url-resolver.js';

export const OVERLAY_ROOT_ID = 'aura-root';

function buildRootMarkup() {
  return `
    <div class="aura-ornament aura-ornament--top-left" data-slot="top-left">
      <span class="aura-ornament__backdrop"></span>
      <span class="aura-ornament__atmosphere" aria-hidden="true">
        <span class="aura-ornament__petal aura-ornament__petal--one"></span>
        <span class="aura-ornament__petal aura-ornament__petal--two"></span>
        <span class="aura-ornament__petal aura-ornament__petal--three"></span>
        <span class="aura-ornament__petal aura-ornament__petal--four"></span>
        <span class="aura-ornament__petal aura-ornament__petal--five"></span>
      </span>
      <span class="aura-ornament__body">
        <img class="aura-ornament__image" data-image="top-left" alt="" />
      </span>
    </div>
    <div class="aura-ornament aura-ornament--bottom-right" data-slot="bottom-right">
      <span class="aura-ornament__backdrop"></span>
      <span class="aura-ornament__halo" aria-hidden="true"></span>
      <span class="aura-ornament__spark aura-ornament__spark--alpha"></span>
      <span class="aura-ornament__spark aura-ornament__spark--beta"></span>
      <span class="aura-ornament__spark aura-ornament__spark--gamma"></span>
      <span class="aura-ornament__body aura-ornament__body--bottom-right">
        <span class="aura-ornament__ground" aria-hidden="true"></span>
        <img class="aura-ornament__image aura-ornament__image--base" data-image="bottom-right-base" alt="" />
      </span>
      <span class="aura-companion-hotspot" data-companion-hotspot data-companion-interactive tabindex="0" role="button" aria-label="打开 Aura 挂件快捷操作" aria-expanded="false"></span>
      <span class="aura-companion-panel" data-companion-panel data-companion-interactive role="menu" aria-label="Aura 挂件快捷操作">
        <button class="aura-companion-panel__button aura-companion-panel__button--primary" type="button" data-aura-action="mark" data-tooltip="标记此刻" role="menuitem" aria-label="标记此刻">
          <svg class="aura-companion-panel__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7.25 4.75h9.5v14.5l-4.75-3-4.75 3V4.75Z" />
            <path d="M9.25 8.25h5.5M9.25 11.25h3.75" />
          </svg>
          <span class="aura-sr-only">标记此刻</span>
        </button>
        <button class="aura-companion-panel__button" type="button" data-aura-action="replay" data-tooltip="回看" role="menuitem" aria-label="回看最近标记" hidden disabled>
          <svg class="aura-companion-panel__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10.25 6.25 5.75 10.75l4.5 4.5" />
            <path d="M6.25 10.75H14a4.25 4.25 0 1 1 0 8.5h-1.75" />
            <path d="M14.75 7.25h4.5v4.5" />
          </svg>
          <span class="aura-sr-only">回看最近标记</span>
        </button>
        <button class="aura-companion-panel__button" type="button" data-aura-action="size" data-tooltip="调大小" role="menuitem" aria-label="调整挂件大小">
          <svg class="aura-companion-panel__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5H5v3M16 5h3v3M8 19H5v-3M16 19h3v-3" />
            <path d="M9.25 9.25h5.5v5.5h-5.5z" />
          </svg>
          <span class="aura-sr-only">调整挂件大小</span>
        </button>
        <button class="aura-companion-panel__button aura-companion-panel__button--quiet" type="button" data-aura-action="hide" data-tooltip="暂隐" role="menuitem" aria-label="暂时隐藏 Aura">
          <svg class="aura-companion-panel__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4.75 12s2.5-4.25 7.25-4.25S19.25 12 19.25 12 16.75 16.25 12 16.25 4.75 12 4.75 12Z" />
            <path d="M9.75 14.25 14.25 9.75" />
          </svg>
          <span class="aura-sr-only">暂时隐藏 Aura</span>
        </button>
      </span>
      <span class="aura-ornament__feedback" data-info="feedback" aria-live="polite"></span>
    </div>
  `;
}

export function createOverlayManager({
  getAssetUrl = (path) => resolveRuntimeAssetUrl(path, import.meta.url),
  onAssetReady = null,
  onAction = null
} = {}) {
  let activeRoot = null;
  let lockedContainer = null;
  let lockedContainerPreviousPosition = '';
  let lastMotionDebug = null;
  let panelOpenTimeoutId = 0;
  let panelCloseTimeoutId = 0;

  function clearPanelOpenTimer() {
    if (!panelOpenTimeoutId) return;
    window.clearTimeout(panelOpenTimeoutId);
    panelOpenTimeoutId = 0;
  }

  function clearPanelCloseTimer() {
    if (!panelCloseTimeoutId) return;
    window.clearTimeout(panelCloseTimeoutId);
    panelCloseTimeoutId = 0;
  }

  function setCompanionPanelOpen(root, open, reason = '') {
    if (!(root instanceof HTMLElement)) return;
    clearPanelOpenTimer();
    clearPanelCloseTimer();
    root.dataset.companionPanelOpen = open ? '1' : '0';
    root.dataset.companionPanelReason = reason;
    const hotspot = root.querySelector('[data-companion-hotspot]');
    if (hotspot instanceof HTMLElement) {
      hotspot.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }

  function scheduleCompanionPanelClose(root, reason = 'leave') {
    if (!(root instanceof HTMLElement)) return;
    clearPanelOpenTimer();
    clearPanelCloseTimer();
    panelCloseTimeoutId = window.setTimeout(() => {
      panelCloseTimeoutId = 0;
      setCompanionPanelOpen(root, false, reason);
    }, 520);
  }

  function scheduleCompanionPanelOpen(root, reason = 'intent') {
    if (!(root instanceof HTMLElement)) return;
    clearPanelCloseTimer();
    if (root.dataset.companionPanelOpen === '1') return;
    clearPanelOpenTimer();
    panelOpenTimeoutId = window.setTimeout(() => {
      panelOpenTimeoutId = 0;
      setCompanionPanelOpen(root, true, reason);
    }, 140);
  }

  function isCompanionInteractiveTarget(target) {
    return target?.closest?.('[data-companion-interactive], [data-aura-action]') instanceof HTMLElement;
  }

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

    if (!root.dataset.auraActionBound) {
      root.addEventListener('click', (event) => {
        const actionElement = event.target?.closest?.('[data-aura-action]');
        if (!(actionElement instanceof HTMLElement)) {
          const hotspot = event.target?.closest?.('[data-companion-hotspot]');
          if (hotspot instanceof HTMLElement) {
            event.preventDefault();
            event.stopPropagation();
            setCompanionPanelOpen(root, root.dataset.companionPanelOpen !== '1', 'click');
          }
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        void onAction?.(actionElement.dataset.auraAction || '');
        if (actionElement.dataset.auraAction === 'hide') {
          setCompanionPanelOpen(root, false, 'action-hide');
        }
      });
      root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          setCompanionPanelOpen(root, false, 'escape');
          return;
        }
        const hotspot = event.target?.closest?.('[data-companion-hotspot]');
        if (hotspot instanceof HTMLElement && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          event.stopPropagation();
          setCompanionPanelOpen(root, root.dataset.companionPanelOpen !== '1', 'keyboard');
          return;
        }
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const actionElement = event.target?.closest?.('[data-aura-action]');
        if (!(actionElement instanceof HTMLElement)) return;
        event.preventDefault();
        event.stopPropagation();
        void onAction?.(actionElement.dataset.auraAction || '');
      });
      root.addEventListener('pointerover', (event) => {
        if (!isCompanionInteractiveTarget(event.target)) return;
        scheduleCompanionPanelOpen(root, 'pointer');
      });
      root.addEventListener('pointerout', (event) => {
        if (!isCompanionInteractiveTarget(event.target)) return;
        if (isCompanionInteractiveTarget(event.relatedTarget)) return;
        scheduleCompanionPanelClose(root, 'pointer-leave');
      });
      root.addEventListener('focusin', (event) => {
        if (!isCompanionInteractiveTarget(event.target)) return;
        setCompanionPanelOpen(root, true, 'focus');
      });
      root.addEventListener('focusout', (event) => {
        if (!isCompanionInteractiveTarget(event.target)) return;
        if (isCompanionInteractiveTarget(event.relatedTarget)) return;
        scheduleCompanionPanelClose(root, 'focus-leave');
      });
      root.dataset.auraActionBound = '1';
    }

    if (!root.dataset.companionPanelOpen) {
      setCompanionPanelOpen(root, false, 'init');
    }

    activeRoot = root;
    return root;
  }

  function updateAspectRatio(root, image, aspectVariable) {
    if (!(root instanceof HTMLElement) || !(image instanceof HTMLImageElement) || !aspectVariable) return;
    if (!(image.naturalWidth > 0 && image.naturalHeight > 0)) return;
    root.style.setProperty(aspectVariable, `${image.naturalWidth} / ${image.naturalHeight}`);
  }

  function setImageSource(root, image, assetPath, aspectVariable) {
    if (!(image instanceof HTMLImageElement)) return;
    const nextUrl = assetPath ? getAssetUrl(assetPath) : '';
    if (!nextUrl) {
      image.removeAttribute('src');
      image.dataset.auraAssetPath = '';
      return false;
    }
    image.dataset.auraAspectVariable = aspectVariable || '';

    if (!image.dataset.auraAspectBound) {
      image.addEventListener('load', () => {
        updateAspectRatio(root, image, image.dataset.auraAspectVariable);
        onAssetReady?.({
          imageRole: image.dataset.image || '',
          assetPath: image.dataset.auraAssetPath || '',
          naturalSize: `${image.naturalWidth}x${image.naturalHeight}`
        });
      });
      image.dataset.auraAspectBound = '1';
    }

    if (image.src !== nextUrl) {
      image.src = nextUrl;
    }
    image.dataset.auraAssetPath = assetPath || '';

    if (image.complete) {
      updateAspectRatio(root, image, aspectVariable);
    }

    return true;
  }

  function applySkin(root, skin) {
    if (!(root instanceof HTMLElement) || !(skin && skin.assets)) return;

    setImageSource(root, root.querySelector('[data-image="top-left"]'), skin.assets.topLeft, '--aura-top-aspect');
    setImageSource(root, root.querySelector('[data-image="bottom-right-base"]'), skin.assets.bottomRight, '--aura-bottom-aspect');

    root.style.setProperty('--aura-primary', skin.palette?.primary || '#6dd3ff');
    root.style.setProperty('--aura-accent', skin.palette?.accent || '#ffd166');
    root.style.setProperty('--aura-glow', skin.palette?.glow || '#8ecdf4');
    root.dataset.skin = skin.id;
    root.dataset.skinCategory = skin.category || 'default';
  }

  function updateTextNode(root, selector, value, visibleClass = 'is-visible') {
    const element = root.querySelector(selector);
    if (!(element instanceof HTMLElement)) return;
    const text = String(value || '').trim();
    element.textContent = text;
    element.classList.toggle(visibleClass, Boolean(text));
  }

  function applyInfoLayer(root, infoLayer = {}) {
    if (!(root instanceof HTMLElement)) return;
    const feedbackText = String(infoLayer.feedbackText || '').trim();
    const latestMarkLabel = String(infoLayer.latestMarkLabel || '').trim();
    const latestMarkTimeSec = Number(infoLayer.latestMarkTimeSec);
    const canMarkMoment = infoLayer.canMarkMoment === true;
    const canReplayLatestMark = infoLayer.canReplayLatestMark === true;
    const markButton = root.querySelector('[data-aura-action="mark"]');
    const replayButton = root.querySelector('[data-aura-action="replay"]');
    root.dataset.feedbackType = String(infoLayer.feedbackType || '');
    root.dataset.feedbackVisible = feedbackText ? '1' : '0';
    root.dataset.microcopyTone = String(infoLayer.microcopyTone || 'gentle');
    root.dataset.latestMarkLabel = latestMarkLabel;
    root.dataset.latestMarkTimeSec = Number.isFinite(latestMarkTimeSec) ? String(Math.max(0, Math.floor(latestMarkTimeSec))) : '';
    root.dataset.canMarkMoment = canMarkMoment ? '1' : '0';
    root.dataset.canReplayLatestMark = canReplayLatestMark ? '1' : '0';
    if (markButton instanceof HTMLButtonElement) {
      markButton.hidden = !canMarkMoment;
      markButton.disabled = !canMarkMoment;
    }
    if (replayButton instanceof HTMLButtonElement) {
      replayButton.hidden = !canReplayLatestMark;
      replayButton.disabled = !canReplayLatestMark;
      replayButton.dataset.tooltip = canReplayLatestMark ? `回到 ${latestMarkLabel}` : '回看';
      replayButton.setAttribute('aria-label', canReplayLatestMark ? `回到 ${latestMarkLabel}` : '回看最近标记');
    }
    updateTextNode(root, '[data-info="feedback"]', feedbackText);
  }

  function render({ container, skin, layout, visualState, mode, infoLayer = null }) {
    ensureContainerLock(container);
    const root = ensureRoot(container);
    if (!(root instanceof HTMLElement)) return null;

    applySkin(root, skin);
    const motionProfile = resolveMotionProfile({
      skin,
      mode,
      visualState
    });

    applyLayout(root, layout, visualState, skin);
    applyInfoLayer(root, infoLayer);
    const motionDebug = applyMotionProfile(root, motionProfile);
    root.dataset.attention = visualState.attentionActive ? '1' : '0';
    root.dataset.pointerAccepted = visualState.pointerDebug?.accepted === true ? '1' : '0';
    root.dataset.pointerReason = visualState.pointerDebug?.reason || '';
    root.dataset.motionState = motionProfile.motionState;
    lastMotionDebug = {
      ...(motionDebug || {}),
      motionState: motionProfile.motionState,
      frameStatus: 'base-only'
    };
    return root;
  }

  function teardown() {
    for (const root of document.querySelectorAll(`#${OVERLAY_ROOT_ID}`)) {
      root.remove();
    }

    activeRoot = null;
    lastMotionDebug = null;
    clearPanelOpenTimer();
    clearPanelCloseTimer();
    releaseAllContainerLocks();
  }

  return {
    render,
    teardown,
    getRoot: () => activeRoot,
    getDebugInfo: () => lastMotionDebug
  };
}
