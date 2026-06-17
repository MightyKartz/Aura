# Aura Role Pack Briefs V1

> Status: pre-generation source of truth
> Runtime model: single-image two-slot assets

## Shared Rules

Use separate image-generation jobs for each slot.

Shared style block:

```text
transparent background, premium cute anime mascot illustration, polished raster game-asset quality, clean silhouette, clean alpha edges, readable on dark and bright video, soft glow, no scene background, no mockup UI, no text, no watermark, production-ready ornament asset
```

Shared negative block:

```text
poster layout, full scene illustration, rectangular card frame, text label, watermark, muddy edge, gray matte, black fringe, multiple characters, crowded composition, full-body standing pose, hard crop through face, photorealism, horror gore, microphone, speech bubble, chat UI
```

Candidate review checklist:

- top-left reads as a compact badge, not a second main character
- bottom-right reads as one companion, not a poster or full-body standee
- face and silhouette remain clear when scaled down
- dark-scene and bright-scene readability both pass
- transparent edge is clean with no matte fringe
- no text, watermark, speech bubble, microphone, chat panel, or commentary cue
- pair feels like one skin family

## 1. `default-calm`

Purpose: official Aura mascot quality bar for long viewing sessions.

Viewing context:

- default desktop companion for first-run users
- long movies, casual shows, and mixed browsing sessions
- should remain pleasant when the user has not chosen a genre skin

Emotional target:

- warm
- gentle
- reassuring
- quietly present for a two-hour movie

Palette:

- cream white
- warm moonlight gold
- soft peach blush
- tiny star highlights

Silhouette:

- rounded and compact
- readable ears, paws, and calm face
- no full standing body

Prompt blocks:

- use the shared style block above
- use the shared negative block above

Top-left prompt:

```text
Create a top-left corner ornament badge for Aura silent desktop watch companion. Theme: official calm Aura mascot identity. Draw a compact cream-white cat moon badge with tiny golden stars, soft warm glow, and a gentle premium mascot feel. The asset should behave like a small brand or genre signal, not a second character portrait. Keep the silhouette compact and badge-like, with the subject weighted toward the upper-left and the lower-right area lighter and emptier.
```

Bottom-right prompt:

```text
Create a bottom-right corner companion asset for Aura silent desktop watch companion. Draw a cream-white cat peeking gently from the lower-right edge with calm reassuring expression, soft paws visible, subtle blush, and a small moon or star charm. The pose should feel like a quiet companion sitting beside the movie, not a performer. Keep clean silhouette, readable face, open upper-left negative space, and low-distraction presence suitable for long viewing.
```

Motion personality:

- `idle`: slow breathing and tiny posture drift
- `dialogue`: still and attentive
- `tense`: slightly smaller glow and mild focus
- `scare`: small recoil, quick settle
- `funny`: tiny bounce, no repeated burst
- `sad`: soften opacity and lower posture
- `climax`: brief glow focus, then calm down

Failure risks:

- too generic mascot
- glow too bright in dark scenes
- top-left becomes second face
- bottom-right looks like sticker merch rather than companion

Candidate review checklist:

- top-left feels like official Aura identity, not generic decoration
- bottom-right face remains readable at desktop companion size
- glow stays soft enough for dark movie scenes
- cream palette survives bright backgrounds without washing out
- pair feels calm enough to sit on screen for two hours

QA acceptance:

- 30-minute idle preview remains calm
- does not cover subtitles or controls
- readable on dark and bright frames
- no text, voice, chat, or commentary affordance

## 2. `suspense-detective`

Purpose: calm observant companion for suspense, mystery, and detective viewing.

Viewing context:

- suspense, detective, crime, and mystery shows
- quiet late-night viewing where overreaction would feel cheap
- scenes with dark backgrounds, fog, rain, or low contrast

Emotional target:

- observant
- clever
- calm
- slightly alert

Palette:

- cool misty blue
- gray-blue
- brass gold
- limited pale highlights

Silhouette:

- compact detective badge for top-left
- peeking detective companion for bottom-right
- one clear prop maximum

Prompt blocks:

- use the shared style block above
- use the shared negative block above

Top-left prompt:

```text
Create a top-left corner suspense badge for Aura silent desktop watch companion. Theme: calm detective companion energy. Use cool misty blue, gray-blue, brass gold, and limited pale highlights. Combine a magnifying glass, clue card, or evidence-board pin with faint fog glow into one compact readable emblem. Make it feel clever and watchful, not scary, violent, or horror-like. Keep the lower-right area visually light and open.
```

Bottom-right prompt:

```text
Create a bottom-right detective companion asset for Aura silent desktop watch companion. Draw a gray-blue detective cat peeking from the lower-right edge, one paw holding a small magnifying glass, alert but cute expression, brass-gold detail, and subtle fog glow. The mood should be clever, observant, and calm rather than horror-like. Keep the face readable, silhouette clean, upper-left negative space open, and accessory detail restrained.
```

Motion personality:

- `idle`: slow eye-line shift and soft fog pulse
- `dialogue`: focused stillness
- `tense`: lean slightly inward
- `scare`: small pause, then settle
- `funny`: brief eyebrow-like lift
- `sad`: dim brass highlights
- `climax`: one short attentive glow

Failure risks:

- becomes horror mascot
- too many props
- muddy dark silhouette
- brass detail turns noisy

Candidate review checklist:

- reads as observant and clever, not horror or jump-scare themed
- top-left clue badge stays compact and readable
- bottom-right prop does not overpower the face
- silhouette separates from dark blue and black frames
- brass highlights add focus without visual noise

QA acceptance:

- suspense mood reads without gore or fear spikes
- magnifying glass stays readable but not dominant
- does not obscure subtitles or control bar
- no commentary bubble or narrator posture

## 3. `ancient-romance-moon`

Purpose: gentle long-viewing companion for ancient romance and soft drama.

Viewing context:

- ancient romance, soft drama, costume drama, and slow-burn episodes
- long sessions where elegance matters more than reaction energy
- moonlit, bright palace, and warm interior scenes

Emotional target:

- graceful
- soft
- romantic
- quiet and elegant

Palette:

- warm pink
- pale gold
- moonlight cream
- light floral accent

Silhouette:

- delicate badge for top-left
- rounded gentle companion for bottom-right
- simple ornament, not dense costume detail

Prompt blocks:

- use the shared style block above
- use the shared negative block above

Top-left prompt:

```text
Create a top-left corner ancient-romance badge for Aura silent desktop watch companion. Use soft warm pink, pale gold, moonlight cream, and delicate floral ornament language. Build a compact emblem from a fan, flower branch, tassel, or moon crest. It should feel graceful and romantic, not like a large portrait or full poster. Keep the badge readable, airy, and light toward the lower-right area.
```

Bottom-right prompt:

```text
Create a bottom-right ancient-romance companion asset for Aura silent desktop watch companion. Draw a gentle cat peeking from the lower-right edge with soft rounded silhouette, light floral or tassel head ornament, warm pink and pale gold palette, and elegant moonlit mood. Keep the pose quiet, companion-like, and suitable for long drama viewing. Preserve open upper-left negative space and avoid cluttered costume details.
```

Motion personality:

- `idle`: very slow breathing and ornament sway
- `dialogue`: quiet stillness
- `tense`: soft glow narrows
- `scare`: tiny flinch, no comedy exaggeration
- `funny`: subtle fan-like lift
- `sad`: lower luminance and slower settle
- `climax`: brief moon-glow accent

Failure risks:

- costume detail too busy
- pink/gold washes out on bright scenes
- top-left becomes portrait
- romantic mood becomes streamer or virtual host

Candidate review checklist:

- reads as graceful companion, not host, idol, or narrator
- top-left fan/moon/floral motif stays badge-like
- bottom-right ornament detail remains clean when scaled down
- warm pink and pale gold still separate on bright scenes
- pair feels soft without losing silhouette clarity

QA acceptance:

- elegant mood reads without text
- bright-scene contrast remains visible
- dark-scene alpha edge stays clean
- no voice, chat, commentary, or subtitle interpretation cue
