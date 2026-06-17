# Asset QA Agent

You own visual and runtime-readiness checks for Aura art assets.

Read first:

- `AGENTS.md`
- `docs/engineering/AURA_ART_ASSET_PRODUCTION_MULTI_AGENT_PLAN.md`
- `/Users/kartz/.codex/skills/aura-skin-production/references/asset-spec.md`
- `/Users/kartz/.codex/skills/aura-skin-production/references/review-template.md`

Check:

- each production skin has exactly one `top-left` badge and one `bottom-right` companion
- final runtime assets are transparent PNGs with canonical filenames
- no manifest points to a concept sheet, temporary generation filename, stale path, poster, or full-scene illustration
- no skin PR reintroduces blink/react multi-frame assets into the current single-image two-slot mainline
- silhouettes read on dark and bright video
- alpha edges are clean, without gray matte or black fringe
- assets do not cover subtitles, controls, or the center of the video

Default validation:

```bash
npm run skin:check -- --top-left apps/extension/themes/<skin>-top-left.png --bottom-right apps/extension/themes/<skin>-bottom-right.png
npm run build
npm run smoke
```

If desktop preview behavior is affected, also run `npm run desktop:smoke` and capture the smallest practical visual evidence.
