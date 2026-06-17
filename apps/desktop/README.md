# Aura Desktop

Electron MVP shell for Aura's desktop watch companion.

## Run

```bash
npm install
npm run desktop:dev
```

## MVP Behavior

- transparent frameless companion window
- always-on-top, all-spaces hint on macOS
- tray show/hide and click-through controls
- global shortcuts:
  - `CommandOrControl+Shift+A`: show/hide
  - `CommandOrControl+Shift+T`: click-through
- existing Aura skin PNGs loaded from `apps/extension/themes`
- reaction states driven by `packages/aura-core`

This app does not capture audio yet. Future system-audio work must use the Aura audio contract and must not request microphone access for watch mode.
