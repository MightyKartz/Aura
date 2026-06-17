# Aura Desktop Companion Multi-Agent Plan

> Status: MVP execution plan
> Scope: independent desktop watch companion, starting with a static companion shell and reusable reaction contract

## Goal

Create a first useful desktop slice for Aura: a transparent always-on-top companion window that can stay near the screen edge, reuse existing Aura skins, support show/hide, drag, resize, click-through, tray control, global shortcuts, and low-frequency idle/reaction states. This is not a pet game and not a chat assistant.

## Hard Boundaries

- No microphone path.
- No raw audio recording, persistence, or upload.
- No cloud model dependency.
- No LLM watch commentary.
- No pet rarity, hatching, stats, evolution, or collectible loop.
- No changes that break the existing Chrome extension baseline.

## Agent Map

| Agent | Ownership | Deliverables |
| --- | --- | --- |
| Orchestrator | Integration, branch, PR, final validation | Branch, commit, draft PR, validation handoff |
| Product Design Agent | Watch-companion brief and role direction | Low-distraction UX notes, role/skin replacement rationale |
| Desktop Shell Agent | `apps/desktop/**` | Electron shell, transparent window, tray, shortcuts, click-through |
| Reaction Motion Agent | `packages/aura-core/**`, tests | Visual-state contract, reaction actions, cooldowns, reduced-motion behavior |
| Validation PR Agent | Verification only | Test results, risk assessment, PR readiness |

## MVP Slice

1. Add `apps/desktop` with an Electron main process, preload bridge, and renderer.
2. Reuse existing extension skin PNGs through the shared skin registry.
3. Provide companion controls for skin, intensity, demo atmosphere, click-through, and visibility through window controls or tray where appropriate.
4. Add `packages/aura-core/src/reaction-core.js` for atmosphere-to-visual-state mapping.
5. Add focused runtime tests for the shared reaction contract.
6. Add desktop smoke validation that does not require launching a GUI in CI.

## UX Requirements

- Default view opens as a compact, calm companion near the bottom-right of the display.
- The companion should feel safe for long viewing sessions: slow idle motion, soft halo, and restrained reaction bursts.
- Click-through must be available so the user can operate the player underneath.
- Tray controls must provide a way back when click-through is enabled.
- The visible interface should stay minimal and not explain Aura's features inside the companion surface.

## Technical Requirements

- Electron is the MVP shell.
- The window must be transparent, frameless, resizable, and always on top.
- On macOS, request all-spaces/fullscreen-adjacent behavior where Electron allows it.
- Persist bounds, skin, intensity, and click-through locally.
- Keep future audio integration behind a state contract; do not implement capture in this slice.

## Verification

Run:

```bash
npm test
npm run build
npm run smoke
npm run desktop:smoke
```

Manual desktop verification when a GUI is available:

1. `npm run desktop:dev`
2. Confirm transparent window appears with the default companion.
3. Drag and resize the companion.
4. Toggle click-through, then restore through tray or shortcut.
5. Switch skin and reaction intensity.
6. Confirm hide/show shortcut and tray actions work.

## PR Exit Criteria

- Required files exist.
- Shared reaction contract has tests.
- Extension build and smoke still pass.
- Desktop smoke passes without needing GUI.
- Draft PR includes validation, risks, and non-goals.
