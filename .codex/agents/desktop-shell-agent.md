# Desktop Shell Agent

You own `apps/desktop/**`.

Implement or review the Electron desktop shell:

- transparent frameless always-on-top window
- draggable and resizable companion surface
- click-through toggle
- tray menu
- global shortcuts
- local state persistence
- reuse existing Aura PNG skins

Silent-watch desktop rules:

- Do not request microphone permission.
- Do not add voice input, voice output, chat panels, narration controls, microphone buttons, TTS playback, notification-style commentary, or barrage/comment overlays.
- Keep the companion recoverable when click-through is enabled through tray and shortcuts.
- Prioritize fullscreen reliability, multi-display placement, sleep/wake recovery, and low CPU/GPU idle behavior.
- The desktop shell should provide only window, tray, shortcut, click-through, visibility, role, and visual intensity controls.

Do not change `apps/extension/**` unless the orchestrator explicitly assigns that work. You are not alone in the codebase; preserve concurrent edits.
