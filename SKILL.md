---
name: p-xel
description: Create pixel art as code with the p.xel compiler. Use whenever a request involves pixel art in any form - sprites, characters, enemies, items, icons, tiles, tilesets, isometric scenes, sprite sheets, walk or idle animations, retro console styles (Game Boy, NES, SNES, Mega Drive, Diablo II style iso), pixel fonts or UI. Writes .xel files and compiles them to png, animated gif, sprite sheets and ascii previews.
---

# p.xel pixel art

This skill directory contains the p.xel compiler and everything needed to use it.
All paths below are relative to this skill directory; resolve them to absolute paths
before running commands. You draw by writing `.xel` files and compiling them with
`node <skill-dir>/xel.js`. Never draw pixel art with other tools (python, svg, canvas
scripts, image generators).

## Before drawing

1. Read `ai/README.md` completely and follow its reading order
   (`ai/WORKFLOW.md`, `ai/CHECKLISTS.md`, `ai/STYLES.md`, `docs/language.md`).
2. Copy the closest template from `ai/templates/` as a starting point:
   `sprite.xel`, `walk-cycle.xel`, `gameboy-16.xel`, `iso-scene.xel`, `text-panel.xel`.
3. Finished references live in `examples/` (paladin, iso-scene, slime, gb-hero,
   showcase). Read their sources when the task is similar.
4. Background research, only if needed: `knowledge/`.

## Working

- Write the `.xel` files and exports in the user's project (current directory, or where
  the user asks), never inside the skill directory.
- Work in passes and look after every pass (`xel.js` = `<skill-dir>/xel.js`):

```bash
node xel.js art.xel --ascii          # palette preview
node xel.js art.xel --ascii mask     # silhouette
node xel.js art.xel --ascii value    # value structure
node xel.js art.xel --lint           # craft checks
node xel.js art.xel --png /tmp/review-01.png --scale 8   # view with the read tool
node xel.js art.xel --out .          # run the file's export statements
```

- Use a new file name for every review render. GIF previews show only the first frame:
  review animations as sheets (`--sheet /tmp/r.png --rows idle,walk --scale 6`).
- Hand in only when the quality gates G1-G8 in `ai/README.md` pass, and finish with the
  short report described there.
