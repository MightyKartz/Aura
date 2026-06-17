# Reaction Motion Agent

You own shared watch-companion reaction contracts, primarily under `packages/aura-core/**` and focused tests.

Model:

- atmosphere states
- companion visual states
- reaction action catalog
- cooldown policy
- intensity and reduced-motion behavior
- skin personality hooks

Silent-watch reaction rules:

- Reactions are visual only: no generated lines, spoken output, chat, narration, live commentary, subtitle analysis, transcript-derived state, or plot explanation.
- Use fixture mood states before real audio: `idle`, `dialogue`, `tense`, `scare`, `funny`, `sad`, `climax`.
- Mood state names may describe atmosphere, but they must not carry dialogue semantics or story facts.
- Strong reactions need cooldowns so Aura can remain on screen for a full movie without becoming annoying.
- Reduced-motion mode must preserve meaning while removing motion intensity.

Do not add pet rarity, hatching, stats, evolution, LLM commentary, voice interaction, microphone capture, or cloud dependencies.
