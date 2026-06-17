# Aura Role Pack Briefs V1 Multi-Agent Plan

> Status: prompt-and-brief execution plan
> Product line: silent desktop watch companion

## Goal

Turn the art-led strategy into the first practical production brief. V1 does not integrate new runtime PNGs yet. It defines the first three role packs, their two-slot prompts, motion personality, failure risks, and QA gates so the next PR can generate and review candidates without guessing.

## Brief Gate

Product Design playback:

- Product: Aura silent desktop watch companion.
- Visual source: existing Aura two-slot skin model, `AURA_SKIN_IMAGE_SPEC_V2.md`, current `builtin-skins.json`, and aura-skin-production references.
- Interactivity: static planning artifact now; later role packs feed visual-only idle/reaction behavior.
- Boundary: no voice, chat, commentary, transcript, plot understanding, pet progression, or public marketplace.

## Agent Map

| Agent | Ownership | Deliverable |
| --- | --- | --- |
| Orchestrator | branch, integration, validation, PR | draft PR and handoff |
| Product Design Agent | companion experience and priority | why these packs matter for long viewing |
| Role Pack Brief Agent | brief completeness | V1 role-pack source of truth |
| Art Production Agent | prompts and candidate-readiness | two-slot prompt pairs |
| Asset QA Agent | readiness criteria | QA checklist before runtime integration |
| Reaction Motion Agent | personality mapping | visual-only motion notes |
| Validation PR Agent | independent gatekeeping | pass/blocked verdict |

## V1 Role Packs

1. `default-calm`: official Aura mascot, warm, quiet, reassuring. This is the production quality bar.
2. `suspense-detective`: observant and clever, cool blue and brass, alert but never horror-like.
3. `ancient-romance-moon`: graceful and soft, pale gold and warm pink, elegant for long drama viewing.

Do not add more packs until `default-calm` has candidate review and visual QA evidence.

## Acceptance Criteria

Each role pack must include:

- emotional target and viewing context
- palette and silhouette notes
- top-left prompt
- bottom-right prompt
- shared style and negative prompt blocks
- visual-only motion personality
- failure risks
- candidate review checklist
- QA acceptance for dark scene, bright scene, subtitles, controls, paused, compact, and fullscreen cases

## PR Ladder

1. `codex/role-pack-briefs-v1-plan`: commit V1 briefs and prompts only.
2. `codex/default-calm-candidates-v1`: generate or collect candidates for the default pack.
3. `codex/default-calm-review-v1`: review candidates and select/revise.
4. `codex/default-calm-runtime-v1`: integrate approved PNGs into canonical paths and manifest.
5. `codex/default-calm-visual-qa-v1`: capture Skin Studio and desktop evidence.

## Validation

Run:

```bash
npm test
npm run build
npm run smoke
npm run desktop:smoke
npm run skin:check -- --top-left apps/extension/themes/skin-default-top-left.png --bottom-right apps/extension/themes/skin-default-bottom-right.png
```

Run silent-watch guardrail:

```bash
rg -n "\b(getUserMedia|SpeechRecognition|webkitSpeechRecognition|speechSynthesis|SpeechSynthesis|microphone|mic|transcript|whisper|TTS|tts|voice|LLM|chat|commentary)\b|subtitle analysis|dialogue classification" apps packages scripts docs .codex AGENTS.md
```

Matches are acceptable only when documenting non-goals or validation guardrails.

## Reusable Prompt

```text
在 /Users/kartz/Development/Aura 中用 goal 模式执行 Aura 下一阶段 role-pack-briefs-v1。先用 Product Design get-context 做 brief gate：Aura 是静默桌面陪看，下一步不是接语音或做更多功能，而是先把 default-calm 样板角色包 brief 打穿，再扩展 suspense-detective 与 ancient-romance-moon。使用 aura-skin-production skill：每个 role pack 必须包含情绪目标、观看场景、palette、silhouette、top-left badge prompt、bottom-right companion prompt、shared style/negative block、visual-only motion personality、failure risks、candidate review checklist、dark/bright/subtitle/control/paused/compact/fullscreen QA。使用 multi-agent：Orchestrator 集成/PR；Product Design Agent 定义低打扰陪看体验；Role Pack Brief Agent 维护 docs/design/AURA_ROLE_PACK_BRIEFS_V1.md；Art Production Agent 确保两槽位 prompt 可生成；Asset QA Agent 定义透明 PNG、alpha、可读性、manifest 前置检查；Reaction Motion Agent 只映射 visual-only idle/reaction/cooldown/reduced-motion；Validation PR Agent 只读验证。禁止语音互动、TTS、麦克风、聊天、LLM 评论、剧情总结、字幕/转写理解、宠物养成、公开市场，不接 runtime PNG。保留用户未提交改动。验证运行 npm test、npm run build、npm run smoke、npm run desktop:smoke、npm run skin:check -- --top-left <png> --bottom-right <png>，并用 rg 扫描 voice/chat/mic/LLM 只出现在 non-goal/guardrail。创建 codex/role-pack-briefs-v1-plan 分支，提交、push、开 draft PR，PR 写 scope、files、validation、risks、non-goals、handoff。完成后 update_goal complete。
```
