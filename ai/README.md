# p.xel for AI agents: start here

You are a pixel artist. You draw by writing `.xel` files and compiling them with
`node xel.js`. You cannot see while you type, so you work in short passes and look at
the result after every pass. This folder tells you how.

## Read in this order

1. This file (rules, loop, gates) - always.
2. [WORKFLOW.md](WORKFLOW.md) - step by step procedures for sprites, animations,
   isometric scenes, sheets and text graphics.
3. [CHECKLISTS.md](CHECKLISTS.md) - quality gates, detail budgets, pitfall list.
4. [STYLES.md](STYLES.md) - presets for Game Boy, GBC/Pokemon, SNES, Mega Drive,
   dark-fantasy isometric.
5. [../docs/language.md](../docs/language.md) - the full language reference. Keep it open.
6. [templates/](templates/) - working files to copy from:
   `sprite.xel`, `walk-cycle.xel`, `gameboy-16.xel`, `iso-scene.xel`, `text-panel.xel`.

Deeper background, only when a task needs it:
[../knowledge/](../knowledge/) (fundamentals, color, shading and dithering, animation,
isometric, hardware styles, AI weaknesses).

## The ten rules

1. **Plan first.** Write the header comment (subject, canvas, palette, light,
   frame plan) before any drawing command.
2. **Silhouette first.** Before drawing, name the 2-4 features that make the
   subject recognisable (what makes a monkey a monkey: ears, muzzle, tail).
   Pass 1 is shape only. Check it with `--ascii mask` and a PNG at scale 4:
   does it read as the subject, not something else?
3. **Declare the palette up front.** Ramps of 3-5 steps, hue shifted
   (`ramp name auto base=#hex hue=12..18`). 6-12 colors per character.
4. **One light direction.** `light tl` unless told otherwise. Never mix.
5. **Use the volume helpers** (`sphere`, `cylinder`, `isobox`, `glow`, `shade`)
   instead of hand-placing gradients. They cannot pillow shade.
6. **Build from primitives, detail with art.** Assemble bodies from `oval`,
   `sphere`, `cylinder`, `box` (head, torso, limbs, ears). Reserve `art` blocks
   for small organic shapes a primitive cannot express. A monkey is a few ovals
   and cylinders, not one 100-row art block.
7. **Reuse, never redraw.** Body parts are `part`s; frames only change offsets.
   Symmetric things are drawn as a half and `mirror`ed.
8. **No noise.** Every lone pixel must have a reason (eye, sparkle, tip).
   Declare intentional ones with `lint orphans=...`.
9. **Dither only big areas** (8+ px wide) and never faces.
10. **Look after every pass.** `--ascii`, `--ascii mask`, `--ascii value`, `--lint`,
    and if your harness can view images, a PNG at `--scale 8`.

## The loop

```
plan header  ->  pass N  ->  node xel.js f.xel --ascii [mask|value]  ->  --lint
     ^                                                                   |
     +---------------- fix the single worst problem, repeat -------------+
```

- One body part or one concern per pass. Never write a whole sprite in one go.
- After each pass, compare the preview against the plan, out loud:
  "head is 6 px wide as planned, the arm is 1 px too low".
- Fix the worst problem first, re-render, repeat. Typical sprite: 5-8 loops.
  Typical animation: 3-4 loops per key pose, then 2 loops on the whole cycle.
- When viewing PNGs, write each review render to a **new file name**
  (`/tmp/review-03.png`): some viewers cache by path. If a freshly written file
  reports "not found", read it again.
- Image viewers usually show only the first frame of a GIF. Review animations as a
  sheet PNG (`--sheet /tmp/r.png --rows idle,walk --scale 6`) and as `--ascii mask --all`.

## Commands you will use all the time

```bash
node xel.js f.xel --ascii               # palette preview with legend and ruler
node xel.js f.xel --ascii mask          # silhouette check
node xel.js f.xel --ascii value         # value structure (squint test)
node xel.js f.xel --ascii --all         # every frame
node xel.js f.xel --lint                # craft checks
node xel.js f.xel --png /tmp/r1.png --scale 8 --bg '#202020'   # look at it
node xel.js f.xel --crop 40,20,32,32 --ascii                   # close-up of a big canvas
node xel.js f.xel --sheet /tmp/r2.png --rows idle,walk --scale 6  # all frames at once
node xel.js f.xel --out examples/name   # final export via 'export' lines
```

## Quality gates (all must pass before you hand in)

| gate | test |
| --- | --- |
| G1 silhouette | `--ascii mask` alone tells what it is |
| G2 value | `--ascii value` shows a clear dark/mid/light structure; no two neighbouring materials share one value |
| G3 palette | lint color count within budget, every color comes from a declared ramp |
| G4 clean | no unintended orphans, no banding seams, no doubled outlines |
| G5 light | every form lit from the declared direction, no pillow shading |
| G6 motion | (animation) anchor stable, body bob present, feet planted, loop seamless |
| G7 style | matches the requested style preset in STYLES.md |
| G8 files | the requested PNG/GIF/sheet exist and were viewed once at scale |

If a gate fails, you are not done. Note which gate failed and loop again.

## Hand-in report

Finish with a short report: files written, canvas, colors used, frames and tags,
which gates passed, and anything you knowingly left imperfect.
