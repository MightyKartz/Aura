# Aura Silent Watch Multi-Agent Rollout

> Status: next-phase execution plan
> Product line: silent desktop watch companion

## Product Decision

Aura should not use voice interaction during viewing. Voice, TTS, speech recognition, and chat change the product from a companion into an interruption layer. The correct product shape is:陪看，不陪聊；共情，不解说；反应，不打断。

## Target Experience

Aura stays visible for a whole viewing session without asking for attention. The companion should:

- remain on top across normal desktop and fullscreen viewing contexts
- stay easy to hide, recover, move, resize, and click through
- express atmosphere visually through low-frequency motion and light
- avoid subtitles, player controls, and central video content
- never speak, narrate, summarize, ask questions, or comment during playback
- avoid companion sound effects and notification-style interruptions

## Multi-Agent Implementation Plan

| Phase | Agent | Write Scope | Deliverable | Exit Criteria |
| --- | --- | --- | --- | --- |
| 1 | Orchestrator | docs, PR metadata | Stacked PR plan and handoff | Diff contains only intended files |
| 2 | Desktop Shell Agent | `apps/desktop/**` | Reliability pass for fullscreen, multi-display, tray, shortcuts | Manual QA checklist updated and smoke passes |
| 3 | Product Design Agent | docs/design, docs/engineering | Silent companion UX rules and role mood map | No voice/chat/commentary affordances |
| 4 | Reaction Motion Agent | `packages/aura-core/**`, tests | Fixture mood engine and reaction tuning | Mood states tested with cooldown and reduced motion |
| 5 | Validation PR Agent | read-only | Independent boundary and verification report | `Merge candidate` or clear blocker |

## PR Sequence

1. `codex/silent-watch-agent-plan`: document no-voice doctrine, agent responsibilities, validation scan, and next-phase prompts.
2. `codex/desktop-reliability-pass`: harden window behavior, recovery paths, and fullscreen/multi-display QA.
3. `codex/silent-companion-ux`: add role mood map, intensity copy, and visual-only interaction model.
4. `codex/fixture-mood-engine`: add fixture atmosphere events and reaction previews with tests.
5. `codex/system-audio-atmosphere-spike`: local audio-feature spike only if privacy boundaries remain intact.

## Non-Goals

- Voice input or output during viewing
- TTS, speech recognition, microphone fallback, spoken prompts, companion sound effects, or audio prompts
- Chat, LLM commentary, plot summaries, or subtitle/dialogue understanding
- Text-entry affordances, "ask Aura" UI, comment bubbles, transcripts, whisper-style dependencies, or recap features inside the persistent companion
- Pet rarity, hatching, growth stats, public marketplace loops
- Cloud audio processing, raw audio persistence, or uploaded media

## Validation

Run the normal project gates:

```bash
npm test
npm run build
npm run smoke
npm run desktop:smoke
```

Run the silent-watch scan:

```bash
rg -n "\b(getUserMedia|SpeechRecognition|webkitSpeechRecognition|speechSynthesis|SpeechSynthesis|microphone|mic|transcript|whisper|TTS|tts|voice|LLM|chat|commentary)\b|subtitle analysis|dialogue classification" apps packages scripts docs .codex AGENTS.md
```

Matches are allowed only when they document prohibited behavior, non-goals, or validation guardrails.

## Reusable Prompt

```text
在 /Users/kartz/Development/Aura 中用 goal 模式执行 Aura 下一阶段“静默陪看氛围组”落地。先用 Product Design get-context 做 brief gate：Aura 是观影陪伴，不是语音助手、聊天桌宠或 AI 评论员；观影中禁止语音互动、TTS、麦克风、SpeechRecognition、LLM 评论、剧情总结和聊天面板。使用 multi-agent：Orchestrator 负责集成/PR；Product Design Agent 负责低打扰陪看体验和角色/皮肤方向；Desktop Shell Agent 负责 apps/desktop 的透明置顶、全屏可靠性、点击穿透、托盘、快捷键、多显示器和恢复路径；Reaction Motion Agent 负责 aura-core 的 visual-only mood/reaction/cooldown/reduced-motion；Validation PR Agent 只读验证边界、命令和 PR 描述。小步 PR，不破坏 apps/extension 冻结基线，不引入云端音频、麦克风、宠物养成或公开市场。保留用户未提交改动。验证运行 npm test、npm run build、npm run smoke、npm run desktop:smoke，并用 rg 扫描 voice/chat/mic/LLM 相关词，确认只出现在 non-goal 或 guardrail。创建 codex/ 分支，提交、push、开 draft PR；PR 写 scope、files、validation、risks、non-goals、validation handoff。完成后 update_goal complete。
```
