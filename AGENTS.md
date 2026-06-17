# Aura Agent Guide

Aura is moving from a Chrome video ornament extension toward an independent desktop watch companion. Treat the current Chrome extension as a frozen reference baseline unless a task explicitly targets it.

## Product Boundary

- Build Aura as a quiet watch companion, not a generic AI assistant or pet game.
- Do not add chat, long-term memory, LLM commentary, pet rarity, pet evolution, public skin markets, microphone capture, cloud audio upload, or video transcript features.
- The desktop mainline should react to atmosphere signals and system audio features later, but this MVP must not capture microphone audio or upload raw audio.
- Reuse existing Aura skin assets, motion language, and low-distraction companion tone.

## Multi-Agent Roles

- Orchestrator owns task selection, integration, final verification, commit, push, and PR.
- Product Design Agent owns the brief, low-distraction watch-companion UX, and role/skin direction.
- Desktop Shell Agent owns `apps/desktop/**` and desktop-window behavior.
- Reaction Motion Agent owns shared companion state, idle/reaction contracts, cooldowns, and tests.
- Validation PR Agent owns independent verification and PR readiness.

Agents are not alone in this codebase. Never revert unrelated edits, and adapt to concurrent work instead of overwriting it.

## Editing Rules

- Use `apply_patch` for manual edits.
- Keep changes scoped to the requested slice.
- Preserve dirty worktree changes that are unrelated to the task.
- Avoid destructive git commands such as `git reset --hard` or `git checkout --` unless the user explicitly asks.
- Do not commit generated `dist/` outputs.

## Verification

Minimum local gates for desktop-companion work:

```bash
npm test
npm run build
npm run smoke
npm run desktop:smoke
```

If a change touches UI behavior, also run the smallest practical visual check. For the Electron desktop app, document any reason a live screenshot could not be captured in the current environment.

## Git And PR

- Use branch prefix `codex/`.
- For this line, prefer `codex/desktop-companion-mvp`.
- Create a draft PR after verification.
- PR descriptions must include scope, affected files, validation, risks, and explicit non-goals.
- Do not merge without user approval.
