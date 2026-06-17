# Aura Art Asset Production Multi-Agent Plan

> Status: art-led execution plan
> Product line: silent desktop watch companion

## Product Thesis

Yes: art and assets should carry most of Aura's next phase. The product's magic is not speech or AI text. It is whether the companion looks like it belongs beside a movie for two hours: charming, readable, quiet, and emotionally tuned.

Target allocation for the next phase:

- 60-70% art direction, role-pack design, prompt/candidate iteration, cleanup, and visual QA
- 20-25% desktop reliability and integration polish
- 10-15% reaction-state logic and fixture tooling

## Asset Model

Every production skin ships as a role pack:

| Slot | Purpose | Preferred Size | Rules |
| --- | --- | --- | --- |
| `top-left` | genre or brand badge | `1536 x 1536` PNG | compact signal, not a second character |
| `bottom-right` | companion character | `1536 x 1920` PNG | peeking or perched character, open upper-left space |

Each role pack must include:

- emotional target and viewing context
- palette and silhouette notes
- top-left prompt or source brief
- bottom-right prompt or source brief
- motion personality notes for idle and reactions
- failure risks and candidate review criteria
- QA notes for dark scene, bright scene, controls visible, paused, and fullscreen/compact states

## Non-Negotiables

- No voice interaction, TTS, chat, narration, subtitle analysis, transcripts, or LLM commentary.
- No concept sheet wired into runtime.
- No poster layout, full-scene illustration, watermark, text label, gray matte, black fringe, or crowded multi-character composition.
- No blink/react multi-frame asset packs in this phase; keep the current single-image two-slot mainline unless a separate migration PR is approved.
- No broad marketplace before Aura proves a small set of excellent role packs.
- No runtime integration until assets pass visual review and canonical path checks.

## Multi-Agent Map

| Agent | Ownership | Deliverable |
| --- | --- | --- |
| Orchestrator | integration, branch, PR, validation | scoped PR and validation handoff |
| Product Design Agent | viewing experience and role strategy | prioritized role packs and low-distraction rules |
| Role Pack Brief Agent | role-pack source of truth | V1 briefs, prompt pairs, motion notes, and review criteria |
| Art Production Agent | art briefs, prompts, candidate review | two-slot prompt packs and review notes |
| Asset QA Agent | runtime asset readiness | transparency/readability/path QA |
| Desktop Shell Agent | desktop preview and placement | evidence that assets do not block playback |
| Reaction Motion Agent | personality-to-motion mapping | role-aware visual-only reaction presets |
| Validation PR Agent | independent gatekeeping | pass/blocked verdict |

## Role-Pack Roadmap

1. `default-calm`: official Aura mascot, warm and reassuring.
2. `suspense-detective`: observant, clever, cool blue, never horror-like.
3. `ancient-romance-moon`: graceful, soft, pale gold and warm pink.
4. `hotblood-spark`: energetic action companion, bright but not noisy.
5. `night-comfort`: late-night quiet mode, low luminance, minimal glow.

Ship fewer packs if quality is weak. A single excellent default pack is more valuable than five noisy skins.

## PR Ladder

1. `codex/art-asset-production-plan`: document art-led pipeline, agents, role packs, validation, and reusable prompt.
2. `codex/role-pack-briefs-v1-plan`: add detailed briefs and generation prompts for the first 3 role packs.
3. `codex/asset-candidate-review-v1`: review generated candidates, pick winners, and record revise/reject rationale.
4. `codex/runtime-asset-integration-v1`: integrate approved PNGs using canonical paths and registry updates.
5. `codex/asset-visual-qa-v1`: add Skin Studio and desktop visual evidence for dark/bright/fullscreen/compact cases.

## Validation

Always run:

```bash
npm test
npm run build
npm run smoke
npm run desktop:smoke
```

For skin or asset work, also run:

```bash
npm run skin:check -- --top-left apps/extension/themes/<skin>-top-left.png --bottom-right apps/extension/themes/<skin>-bottom-right.png
```

Silent-watch guardrail:

```bash
rg -n "\b(getUserMedia|SpeechRecognition|webkitSpeechRecognition|speechSynthesis|SpeechSynthesis|microphone|mic|transcript|whisper|TTS|tts|voice|LLM|chat|commentary)\b|subtitle analysis|dialogue classification" apps packages scripts docs .codex AGENTS.md
```

Matches are allowed only when they document non-goals or validation guardrails.

## Reusable Prompt

```text
在 /Users/kartz/Development/Aura 中用 goal 模式执行 Aura 下一阶段“美术/素材占大头”的静默陪看落地。先用 Product Design get-context 做 brief gate：Aura 的核心不是语音或 AI 评论，而是长时间陪看的角色美术、两槽位皮肤资产、静默动作和视觉 QA。使用 aura-skin-production skill：每套 skin 必须拆成 top-left badge 与 bottom-right companion，透明 PNG、干净 alpha、暗场/亮场可读，不得把 concept sheet、海报、临时文件或文字水印接入 runtime。使用 multi-agent：Orchestrator 集成/PR；Product Design Agent 定义低打扰角色体验和优先 role packs；Art Production Agent 产出情绪目标、palette、两槽位 prompts、候选图 review；Asset QA Agent 检查透明度、轮廓、路径、manifest、Skin Studio/desktop 视觉证据；Reaction Motion Agent 只把角色性格映射到 visual-only idle/reaction/cooldown/reduced-motion；Validation PR Agent 做只读边界和命令验证。禁止语音互动、TTS、麦克风、聊天、LLM 评论、剧情总结、字幕/转写理解、宠物养成和公开市场。保留用户未提交改动。验证运行 npm test、npm run build、npm run smoke、npm run desktop:smoke；资产相关用 npm run skin:check -- --top-left <png> --bottom-right <png>；用 rg 扫描 voice/chat/mic/LLM 相关词只出现在 non-goal 或 guardrail。创建 codex/art-asset-production-plan 分支，提交、push、开 draft PR；PR 写 scope、files、validation、risks、non-goals、handoff。完成后 update_goal complete。
```
