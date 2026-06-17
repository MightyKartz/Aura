# Aura Agent Guide

Aura is moving from a Chrome video ornament extension toward an independent desktop watch companion. Treat the current Chrome extension as a frozen reference baseline unless a task explicitly targets it.

## Product Boundary

- Build Aura as a quiet watch companion, not a generic AI assistant or pet game.
- Do not add chat, voice interaction, TTS, speech recognition, long-term memory, LLM commentary, pet rarity, pet evolution, public skin markets, microphone capture, cloud audio upload, or video transcript features.
- During viewing, Aura must stay silent. It may react visually to atmosphere, but it must not speak, ask questions, narrate, summarize, or comment on the show.
- The desktop mainline may later consume local non-content atmosphere signals, but must not capture microphone audio, transcribe speech, identify dialogue, or generate commentary during viewing.
- Reuse existing Aura skin assets, motion language, and low-distraction companion tone.

## Silent Watch Companion Contract

- During viewing, Aura must be silent: no voice input, voice output, TTS, spoken prompts, companion sound effects, or speech recognition.
- No chat UI, text input, comment bubbles, plot summaries, subtitle analysis, transcript generation, dialogue classification, or LLM commentary.
- Companion reactions must be visual-only: pose, idle motion, facial/state changes, halo, opacity, scale, timing, and restrained transitions.
- Future audio work must be local-only, opt-in, non-persistent, and limited to non-content atmosphere features. No speech recognition or content reconstruction.
- Any post-viewing recap or conversational feature must live outside the persistent desktop watch companion mainline.

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

Silent-watch guardrail for every PR:

```bash
rg -n "\b(getUserMedia|SpeechRecognition|webkitSpeechRecognition|speechSynthesis|SpeechSynthesis|microphone|mic|transcript|whisper|TTS|tts|voice|LLM|chat|commentary)\b|subtitle analysis|dialogue classification" apps packages scripts docs .codex AGENTS.md
```

Any match must either be an explicit non-goal/boundary or be removed before PR.

## Git And PR

- Use branch prefix `codex/`.
- For this line, prefer `codex/desktop-companion-mvp`.
- For follow-up silent-watch planning, prefer `codex/silent-watch-agent-plan`.
- Create a draft PR after verification.
- PR descriptions must include scope, affected files, validation, risks, and explicit non-goals.
- Do not merge without user approval.
